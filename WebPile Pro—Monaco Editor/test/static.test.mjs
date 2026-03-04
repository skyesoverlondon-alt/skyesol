import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(p){ return fs.readFileSync(p, "utf8"); }

test("Security headers include CSP + HSTS", () => {
  const t = read("netlify.toml");
  assert.match(t, /Content-Security-Policy/i);
  assert.match(t, /Strict-Transport-Security/i);
});

test("Schema includes SCIM + OIDC tables and membership active flag", () => {
  const s = read("schema.sql");
  assert.match(s, /ALTER TABLE memberships ADD COLUMN IF NOT EXISTS active/i);
  assert.match(s, /CREATE TABLE IF NOT EXISTS scim_tokens/i);
  assert.match(s, /CREATE TABLE IF NOT EXISTS oidc_configs/i);
  assert.match(s, /CREATE TABLE IF NOT EXISTS oidc_states/i);
});

test("API includes OIDC + SCIM routes and tenant-safe sync", () => {
  const a = read("netlify/functions/api.mjs");
  assert.match(a, /\/oidc\/start/);
  assert.match(a, /\/oidc\/callback/);
  assert.match(a, /jwks_uri/);
  assert.match(a, /verifyIdToken/);

  assert.match(a, /\/scim\/v2\/Users/);
  assert.match(a, /\/scim\/v2\/Groups/);
  assert.match(a, /\/scim\/v2\/Groups\/[0-9a-fA-F-]{36}\/members/);

  assert.match(a, /\/scim\/v2\/Bulk/);
  // Group members.value filter semantics: parser + group_members join
  assert.match(a, /parseScimGroupFilter/);
  assert.match(a, /scim_group_members/);

  assert.match(a, /ETag/);
  assert.match(a, /If-None-Match/);
  assert.match(a, /scimParseFilter/);
  assert.match(a, /scimCompileFilter/);
  assert.match(a, /user_emails/);
  assert.match(a, /compileBracket/);

  assert.match(a, /scimOrderBy/);
  assert.match(a, /sortBy/);
  assert.match(a, /sortOrder/);



  assert.match(a, /WITH\s+target\s+AS\s*\(/i);
  assert.match(a, /org_id\s*=\s*\$\{ctx\.orgId\}/);
});




test("SCIM user emails pagination endpoint exists", () => {
  const a = read("netlify/functions/api.mjs");
  assert.match(a, /\/scim\/v2\/Users\/[0-9a-fA-F-]{36}\/emails/);
  assert.match(a, /includeEmails/);
  assert.match(a, /emailsStartIndex/);
  assert.match(a, /emailsCount/);
});
