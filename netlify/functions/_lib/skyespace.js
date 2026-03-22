import { q } from "./db.js";
import { getBearer } from "./http.js";
import { resolveAuth } from "./authz.js";

let schemaPromise = null;

const DEFAULT_DISTRICTS = [
  ["downtown-phoenix", "Downtown Phoenix", "High-conviction founder district", "Studio drops and operator dinners", 126],
  ["glendale-west", "Glendale West", "Local commerce and field execution", "Service offers and neighborhood signal", 84],
  ["tempe-campus", "Tempe Campus", "Student creator energy", "Cohorts, workshops, and live builds", 91],
  ["global-network", "Global Network", "Remote operators and digital members", "Messaging, vaults, and advisory lanes", 173]
];

function httpError(status, message, code = "SKYESPACE_ERROR") {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "member";
}

function titleize(value) {
  return String(value || "member")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Member";
}

function displayNameForAuth(auth) {
  const email = String(auth?.customer_email || "").trim().toLowerCase();
  if (email && email.includes("@")) {
    return titleize(email.split("@")[0]);
  }
  if (auth?.label) return String(auth.label).trim();
  return `Member ${auth?.customer_id || ""}`.trim();
}

function handleForAuth(auth) {
  const email = String(auth?.customer_email || "").trim().toLowerCase();
  const base = email && email.includes("@") ? slugify(email.split("@")[0]) : `member-${auth?.customer_id || "guest"}`;
  return `@${base}-${auth?.customer_id || "0"}`;
}

function bioForAuth(auth) {
  const plan = String(auth?.customer_plan_name || "Operator").trim();
  const label = String(auth?.label || "Gateway member").trim();
  return `${plan} account connected through Gateway 13. Primary access label: ${label}.`;
}

export async function ensureSkyespaceSchema() {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const statements = [
      "create extension if not exists pgcrypto;",
      `create table if not exists skyespace_profiles (
        id uuid primary key default gen_random_uuid(),
        identity_key text unique,
        handle text unique,
        display_name text not null,
        title text default '',
        bio text default '',
        avatar_url text default '',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );`,
      `create table if not exists skyespace_districts (
        id uuid primary key default gen_random_uuid(),
        slug text unique not null,
        name text not null,
        vibe text default '',
        hotspot text default '',
        active_count integer not null default 0,
        created_at timestamptz not null default now()
      );`,
      `create table if not exists skyespace_posts (
        id uuid primary key default gen_random_uuid(),
        lane text not null default 'feed',
        category text default '',
        title text not null,
        body text default '',
        district text default '',
        author_profile_id uuid references skyespace_profiles(id) on delete set null,
        author_name text not null,
        author_role text default '',
        created_at timestamptz not null default now()
      );`,
      `create table if not exists skyespace_listings (
        id uuid primary key default gen_random_uuid(),
        title text not null,
        category text default '',
        price_text text default '',
        seller_name text not null,
        eta_text text default '',
        district text default '',
        details text default '',
        author_profile_id uuid references skyespace_profiles(id) on delete set null,
        created_at timestamptz not null default now()
      );`,
      `create table if not exists skyespace_signals (
        id uuid primary key default gen_random_uuid(),
        severity text not null default 'medium',
        title text not null,
        detail text default '',
        source_name text not null,
        created_at timestamptz not null default now()
      );`,
      `create table if not exists skyespace_conversations (
        id uuid primary key default gen_random_uuid(),
        topic text not null,
        participant_key text not null,
        created_at timestamptz not null default now(),
        unique(topic, participant_key)
      );`,
      `create table if not exists skyespace_messages (
        id uuid primary key default gen_random_uuid(),
        conversation_id uuid not null references skyespace_conversations(id) on delete cascade,
        author_profile_id uuid references skyespace_profiles(id) on delete set null,
        author_name text not null,
        body text not null,
        created_at timestamptz not null default now()
      );`,
      `create index if not exists idx_skyespace_posts_lane_created on skyespace_posts(lane, created_at desc);`,
      `create index if not exists idx_skyespace_listings_created on skyespace_listings(created_at desc);`,
      `create index if not exists idx_skyespace_signals_created on skyespace_signals(created_at desc);`,
      `create index if not exists idx_skyespace_messages_conversation_created on skyespace_messages(conversation_id, created_at asc);`
    ];

    for (const statement of statements) {
      await q(statement);
    }

    const districtCount = await q(`select count(*)::int as count from skyespace_districts`);
    const count = districtCount.rows?.[0]?.count || 0;
    if (!count) {
      for (const district of DEFAULT_DISTRICTS) {
        await q(
          `insert into skyespace_districts(slug, name, vibe, hotspot, active_count)
           values ($1,$2,$3,$4,$5)
           on conflict (slug) do nothing`,
          district
        );
      }
    }
  })();

  return schemaPromise;
}

export async function requireSkyespaceAuth(req) {
  await ensureSkyespaceSchema();

  const token = getBearer(req);
  if (!token) throw httpError(401, "SkyeSpace requires a Gateway 13 session or virtual key.", "SKYESPACE_AUTH_REQUIRED");

  const auth = await resolveAuth(token);
  if (!auth) throw httpError(401, "Invalid or revoked Gateway session.", "SKYESPACE_AUTH_INVALID");
  if (!auth.is_active) throw httpError(403, "Gateway account disabled.", "SKYESPACE_AUTH_DISABLED");

  return auth;
}

export async function ensureSkyespaceProfile(auth) {
  await ensureSkyespaceSchema();

  const identityKey = `gateway-customer:${auth.customer_id}`;
  const displayName = displayNameForAuth(auth);
  const handle = handleForAuth(auth);
  const title = String(auth.customer_plan_name || "Gateway Member").trim();
  const bio = bioForAuth(auth);

  const result = await q(
    `insert into skyespace_profiles(identity_key, handle, display_name, title, bio)
     values ($1,$2,$3,$4,$5)
     on conflict (identity_key)
     do update set
       handle = excluded.handle,
       display_name = excluded.display_name,
       title = coalesce(nullif(skyespace_profiles.title, ''), excluded.title),
       bio = case
         when coalesce(skyespace_profiles.bio, '') = '' then excluded.bio
         else skyespace_profiles.bio
       end,
       updated_at = now()
     returning *`,
    [identityKey, handle, displayName, title, bio]
  );

  return result.rows[0];
}

export function mapProfile(row) {
  return {
    id: row.id,
    name: row.display_name,
    handle: row.handle,
    title: row.title,
    bio: row.bio,
    avatarUrl: row.avatar_url || ""
  };
}

export function mapFeedPost(row) {
  return {
    id: row.id,
    lane: row.lane,
    type: row.lane === "feed" ? (row.category || "Post") : row.lane,
    category: row.category,
    title: row.title,
    text: row.body,
    district: row.district,
    author: row.author_name,
    role: row.author_role,
    createdAt: row.created_at
  };
}

export function mapListing(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    price: row.price_text,
    seller: row.seller_name,
    eta: row.eta_text,
    district: row.district,
    details: row.details,
    createdAt: row.created_at
  };
}

export function mapSignal(row) {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    detail: row.detail,
    source: row.source_name,
    age: row.created_at
  };
}

export function mapConversation(row) {
  return {
    id: row.id,
    from: row.participant_key,
    topic: row.topic,
    preview: row.preview,
    updatedAt: row.last_message_at
  };
}

export function mapMessage(row) {
  return {
    id: row.id,
    body: row.body,
    author: row.author_name,
    ts: row.created_at,
    topic: row.topic,
    participant: row.participant_key
  };
}