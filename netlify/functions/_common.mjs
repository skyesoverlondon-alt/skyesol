import { getStore } from "@netlify/blobs";

const STORE_NAME = process.env.BLOBS_STORE || "sol_growth";

export function store() {
  return getStore(STORE_NAME);
}

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(body ?? null),
  };
}

export function badRequest(message, details) {
  return json(400, { error: message || "Bad request", details });
}

export function unauthorized(message) {
  return json(401, { error: message || "Unauthorized" });
}

export function forbidden(message) {
  return json(403, { error: message || "Forbidden" });
}

export function serverError(message, details) {
  return json(500, { error: message || "Server error", details });
}

export function getUser(context) {
  return context?.clientContext?.user || null;
}

export function userEmail(user) {
  const email = user?.email || user?.user_metadata?.email || "";
  return String(email || "").toLowerCase().trim();
}

export function isAdmin(user) {
  const roles = user?.app_metadata?.roles;
  if (Array.isArray(roles) && roles.includes("admin")) return true;

  // Fallback allowlist (useful while roles propagate)
  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.length) return false;
  return allow.includes(userEmail(user));
}

export function parseJsonBody(event) {
  if (!event?.body) return null;
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function slugify(input) {
  const s = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return s || `item-${Date.now()}`;
}

export async function ensureSeed() {
  const s = store();

  // Blog seed
  const idx = await s.getJSON("blog:index").catch(() => null);
  if (!idx) {
    const now = new Date().toISOString();
    const seedPost = {
      slug: "welcome",
      title: "Field Notes: Welcome to the SOL Growth Platform",
      excerpt:
        "Blog + CMS + Vault + Monitoring are live when Netlify Functions + Blobs are deployed. This seed post proves the pipeline.",
      cover_image: null,
      tags: ["Ops", "Platform"],
      status: "published",
      published_at: now,
      updated_at: now,
      author: "Skyes Over London LC",
      content_md: [
        "## What this enables",
        "",
        "This website ships as a full growth platform:",
        "- **Blog publishing (CMS)** backed by Netlify Blobs",
        "- **Gated Client Vault** (Identity + Functions)",
        "- **Portal Status + Monitoring** backed by a portal inventory",
        "",
        "## Why Blobs",
        "",
        "Blobs gives you a simple key/value store without standing up a database, perfect for content + monitoring artifacts.",
        "",
        "## Next steps",
        "",
        "1) Enable Netlify Identity",
        "2) Set `ADMIN_EMAILS`",
        "3) Deploy Functions via Netlify CLI",
        "",
        "Then open **/admin.html** and start publishing.",
      ].join("\n"),
    };

    await s.setJSON("blog:post:welcome", seedPost);
    await s.setJSON("blog:index", {
      updated_at: now,
      posts: [
        {
          slug: seedPost.slug,
          title: seedPost.title,
          excerpt: seedPost.excerpt,
          cover_image: seedPost.cover_image,
          tags: seedPost.tags,
          status: seedPost.status,
          published_at: seedPost.published_at,
          updated_at: seedPost.updated_at,
          author: seedPost.author,
        },
      ],
    });
  }

  // Portal seed
  const portals = await s.getJSON("portals:list").catch(() => null);
  if (!portals) {
    const seed = [
      {
        id: "sol-gateway",
        name: "SOLEnterprises.org",
        url: "https://solenterprises.org",
        path: "/",
        category: "Gateway",
        public: true,
        notes: "Primary gateway",
      },
      {
        id: "sol-nexusconnect",
        name: "SOL NexusConnect",
        url: "https://solenterprisesnexusconnect.netlify.app/",
        path: "/",
        category: "Hub",
        public: true,
        notes: "Command hub",
      },
      {
        id: "kaixu-ai-division",
        name: "Kaixu AI Division",
        url: "https://solenteaiskyes.netlify.app/",
        path: "/",
        category: "AI",
        public: true,
        notes: "AI platforms",
      },
    ];
    await s.setJSON("portals:list", { updated_at: new Date().toISOString(), portals: seed });
  }

  // Vault seed (minimal)
  const vault = await s.getJSON("vault:index").catch(() => null);
  if (!vault) {
    const now = new Date().toISOString();
    const doc = {
      id: "vault-welcome",
      title: "Client Vault: How to Use This",
      audience: "clients",
      tags: ["onboarding"],
      created_at: now,
      updated_at: now,
      content_md: [
        "## What this is",
        "",
        "The Vault contains gated docs and deliverables. Access is controlled by Identity tokens.",
        "",
        "## What belongs here",
        "",
        "- Proposals and SOWs\n- Architecture notes\n- Evidence packs\n- Operational playbooks",
      ].join("\n"),
    };
    await s.setJSON(`vault:doc:${doc.id}`, doc);
    await s.setJSON("vault:index", { updated_at: now, docs: [{ id: doc.id, title: doc.title, audience: doc.audience, tags: doc.tags }] });
  }
}
