-- SkyMail mail-platform schema for self-hosted PostgreSQL
-- This is the hosted-mail application schema that replaces the old SkyeDB/Gmail lane.
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  email text unique not null,
  password_hash text not null,
  recovery_enabled boolean not null default false,
  recovery_blob_json text,
  created_at timestamptz not null default now()
);

create table if not exists user_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  version integer not null,
  is_active boolean not null default false,
  rsa_public_key_pem text not null,
  vault_wrap_json text not null,
  created_at timestamptz not null default now(),
  unique(user_id, version)
);
create index if not exists idx_user_keys_user_active on user_keys(user_id, is_active);
create index if not exists idx_user_keys_user_version on user_keys(user_id, version);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text unique not null,
  from_name text,
  from_email text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists idx_threads_user_created on threads(user_id, created_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  thread_id uuid references threads(id) on delete set null,
  from_name text,
  from_email text,
  key_version integer not null,
  encrypted_key_b64 text not null,
  iv_b64 text not null,
  ciphertext_b64 text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_messages_user_created on messages(user_id, created_at desc);
create index if not exists idx_messages_thread_created on messages(thread_id, created_at desc);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  encrypted_key_b64 text not null,
  iv_b64 text not null,
  ciphertext bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_attachments_message on attachments(message_id);

create table if not exists user_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text,
  profile_title text,
  profile_phone text,
  profile_company text,
  profile_website text,
  signature_text text,
  signature_html text,
  preferred_from_alias text,
  vacation_enabled boolean not null default false,
  vacation_subject text,
  vacation_response_text text,
  vacation_response_html text,
  vacation_restrict_contacts boolean not null default false,
  vacation_restrict_domain boolean not null default false,
  vacation_start_at timestamptz,
  vacation_end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mail_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  phone text,
  notes text,
  favorite boolean not null default false,
  source text not null default 'local',
  source_resource_name text,
  source_etag text,
  source_metadata_json text,
  photo_url text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, email)
);
create index if not exists idx_mail_contacts_user_order on mail_contacts(user_id, favorite desc, updated_at desc);
create unique index if not exists idx_mail_contacts_user_email_lower on mail_contacts(user_id, lower(email));
create index if not exists idx_mail_contacts_source on mail_contacts(user_id, source, source_resource_name);

create table if not exists mailbox_accounts (
  user_id uuid primary key references users(id) on delete cascade,
  local_part text not null,
  domain text not null,
  email text not null unique,
  mailbox_password_enc text not null,
  stalwart_principal_id text,
  imap_host text,
  imap_port integer not null default 993,
  imap_secure boolean not null default true,
  smtp_host text,
  smtp_port integer not null default 465,
  smtp_secure boolean not null default true,
  sync_version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(domain, local_part)
);
create unique index if not exists idx_mailbox_accounts_email_lower on mailbox_accounts(lower(email));
create index if not exists idx_mailbox_accounts_domain_local on mailbox_accounts(domain, local_part);
