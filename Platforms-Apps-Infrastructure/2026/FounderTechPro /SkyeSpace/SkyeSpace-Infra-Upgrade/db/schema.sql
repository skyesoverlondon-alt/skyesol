create extension if not exists pgcrypto;

create table if not exists skyespace_profiles (
  id uuid primary key default gen_random_uuid(),
  identity_key text unique,
  handle text unique,
  display_name text not null,
  title text default '',
  bio text default '',
  avatar_url text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists skyespace_districts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  vibe text default '',
  hotspot text default '',
  active_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists skyespace_posts (
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
);

create table if not exists skyespace_listings (
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
);

create table if not exists skyespace_signals (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'medium',
  title text not null,
  detail text default '',
  source_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists skyespace_conversations (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  participant_key text not null,
  created_at timestamptz not null default now(),
  unique(topic, participant_key)
);

create table if not exists skyespace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references skyespace_conversations(id) on delete cascade,
  author_profile_id uuid references skyespace_profiles(id) on delete set null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_skyespace_posts_lane_created on skyespace_posts(lane, created_at desc);
create index if not exists idx_skyespace_listings_created on skyespace_listings(created_at desc);
create index if not exists idx_skyespace_signals_created on skyespace_signals(created_at desc);
create index if not exists idx_skyespace_messages_conversation_created on skyespace_messages(conversation_id, created_at asc);
