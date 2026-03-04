-- Optional: enable Row-Level Security policies.
-- Run after schema.sql and after verifying your app sets app.org_id per request.
-- WARNING: enabling RLS without set_config will break queries (by design).

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_projects_org ON projects
  USING (org_id = current_org_id());

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_project_files_org ON project_files
  USING (org_id = current_org_id());

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_snapshots_org ON snapshots
  USING (org_id = current_org_id());

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_audit_org ON audit_log
  USING (org_id = current_org_id());

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_memberships_org ON memberships
  USING (org_id = current_org_id());

ALTER TABLE scim_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_scim_tokens_org ON scim_tokens
  USING (org_id = current_org_id());

ALTER TABLE scim_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_scim_groups_org ON scim_groups
  USING (org_id = current_org_id());

ALTER TABLE scim_group_members ENABLE ROW LEVEL SECURITY;
-- group members are org-bound through group join (use EXISTS)
CREATE POLICY IF NOT EXISTS p_scim_group_members_org ON scim_group_members
  USING (EXISTS (SELECT 1 FROM scim_groups g WHERE g.id = scim_group_members.group_id AND g.org_id = current_org_id()));

ALTER TABLE user_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_user_emails_org ON user_emails
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = user_emails.user_id AND m.org_id = current_org_id()
  ));

ALTER TABLE siem_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_siem_outbox_org ON siem_outbox
  USING (org_id = current_org_id());

ALTER TABLE org_siem_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_org_siem_configs_org ON org_siem_configs
  USING (org_id = current_org_id());

ALTER TABLE saml_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_saml_configs_org ON saml_configs
  USING (org_id = current_org_id());

ALTER TABLE saml_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS p_saml_sessions_org ON saml_sessions
  USING (org_id = current_org_id());
