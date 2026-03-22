
const { Pool } = require('pg');

let pool;
let ensured = false;

function getConnectionString() {
  return process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || '';
}
function getPool() {
  if (!pool) {
    const connectionString = getConnectionString();
    if (!connectionString) throw new Error('Missing NEON_DATABASE_URL or DATABASE_URL');
    pool = new Pool({ connectionString, max: 4, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}
async function ensureSchema() {
  if (ensured) return;
  const db = getPool();
  await db.query(`
    create table if not exists teams (
      id serial primary key,
      team_key text unique not null,
      team_name text not null,
      owner_name text,
      owner_email text,
      owner_role text default 'team_owner',
      market text,
      season_year int default 2026,
      status text default 'active',
      roster_limit int default 15,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists players (
      id serial primary key,
      player_key text unique not null,
      first_name text not null,
      last_name text not null,
      full_name text not null,
      email text,
      phone text,
      entry_lane text default 'open_combine',
      school_level text,
      school_name text,
      city text,
      state text,
      height_inches numeric(5,2),
      position text,
      status text default 'registered',
      combine_score numeric(8,2),
      draft_rank int,
      team_id int references teams(id) on delete set null,
      team_name text,
      identity_email text,
      waiver_signed boolean default false,
      form_source text,
      netlify_submission_id text,
      notes text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists combines (
      id serial primary key,
      event_key text unique not null,
      title text not null,
      location text,
      event_date date,
      checkin_time text,
      status text default 'scheduled',
      notes text,
      created_at timestamptz default now()
    );

    create table if not exists finance_entries (
      id serial primary key,
      entry_key text unique not null,
      category text not null,
      player_id int references players(id) on delete set null,
      team_id int references teams(id) on delete set null,
      description text,
      amount numeric(12,2) not null,
      currency text default 'USD',
      status text default 'open',
      due_date date,
      paid_at timestamptz,
      owner_email text,
      created_at timestamptz default now()
    );

    create table if not exists draft_picks (
      id serial primary key,
      pick_key text unique not null,
      round_no int default 1,
      pick_no int not null,
      team_id int references teams(id) on delete cascade,
      player_id int references players(id) on delete set null,
      player_name text,
      selected_by_email text,
      selected_by_name text,
      notes text,
      created_at timestamptz default now()
    );

    create table if not exists expansion_interest (
      id serial primary key,
      interest_key text unique not null,
      name text,
      email text,
      phone text,
      org_name text,
      lane text,
      city text,
      state text,
      message text,
      created_at timestamptz default now()
    );

    create table if not exists profiles (
      email text primary key,
      display_name text,
      role text,
      team_id int references teams(id) on delete set null,
      player_id int references players(id) on delete set null,
      meta jsonb default '{}'::jsonb,
      updated_at timestamptz default now()
    );

    create index if not exists idx_players_team on players(team_id);
    create index if not exists idx_players_email on players(lower(email));
    create index if not exists idx_finance_status on finance_entries(status);
    create index if not exists idx_draft_team on draft_picks(team_id);
  `);
  ensured = true;
}
function key(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
module.exports = { getPool, ensureSchema, key };
