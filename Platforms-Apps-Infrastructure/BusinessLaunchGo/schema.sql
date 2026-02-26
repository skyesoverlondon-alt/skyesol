-- schema.sql — Business Launch Kit (AZ) Pack (P13.1)
-- Target: Neon Postgres
-- Used by: Neon Data API (PostgREST-compatible) + optional traditional DB clients
--
-- Tables:
--  1) blkaz_leads: lead submissions + business inputs + report summary + checklist snapshot
--  2) blkaz_pack_artifacts: optional pointers/metadata for stored ZIP/PDF artifacts (e.g., Netlify Blobs keys)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.blkaz_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT auth.user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),

  lead_name text,
  lead_email text,
  lead_phone text,
  lead_company text,
  lead_message text,

  business_name text NOT NULL,
  city text NOT NULL,
  industry text NOT NULL,
  owners_count int NOT NULL DEFAULT 1,
  hire_employees boolean NOT NULL DEFAULT false,

  report_summary text,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,

  app_build_id text,
  app_version text,
  user_agent text,
  page_href text
);

CREATE INDEX IF NOT EXISTS idx_blkaz_leads_created_at ON public.blkaz_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blkaz_leads_owner_id ON public.blkaz_leads (owner_id);

CREATE TABLE IF NOT EXISTS public.blkaz_pack_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT auth.user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),

  lead_id uuid REFERENCES public.blkaz_leads(id) ON DELETE SET NULL,

  artifact_type text NOT NULL CHECK (artifact_type IN ('zip','pdf')),
  storage_provider text NOT NULL DEFAULT 'netlify_blobs',
  storage_key text NOT NULL,
  content_type text NOT NULL,
  bytes int,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_blkaz_pack_artifacts_created_at ON public.blkaz_pack_artifacts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blkaz_pack_artifacts_owner_id ON public.blkaz_pack_artifacts (owner_id);

ALTER TABLE public.blkaz_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blkaz_pack_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blkaz_leads_owner_all ON public.blkaz_leads;
CREATE POLICY blkaz_leads_owner_all ON public.blkaz_leads
  FOR ALL
  TO authenticated
  USING (owner_id = auth.user_id())
  WITH CHECK (owner_id = auth.user_id());

DROP POLICY IF EXISTS blkaz_pack_artifacts_owner_all ON public.blkaz_pack_artifacts;
CREATE POLICY blkaz_pack_artifacts_owner_all ON public.blkaz_pack_artifacts
  FOR ALL
  TO authenticated
  USING (owner_id = auth.user_id())
  WITH CHECK (owner_id = auth.user_id());

COMMIT;

-- After running this script:
-- 1) Neon Console → Data API → enable Data API for your branch
-- 2) Ensure "Grant public schema access" is ON (or apply equivalent GRANTs manually)
-- 3) Use /rest/v1/blkaz_leads endpoints with Authorization: Bearer <JWT>
