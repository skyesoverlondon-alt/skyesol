import test from "node:test";
import assert from "node:assert/strict";

// Ensure module can load in test context
process.env.NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || "postgres://user:pass@localhost:5432/db";
process.env.APP_JWT_SECRET = process.env.APP_JWT_SECRET || "dev_test_secret_change_me";

const mod = await import("../netlify/functions/api.mjs");
assert.ok(mod.__internal, "api.mjs must export __internal for unit tests");

const {
  isAllowedOrigin,
  requireCsrf,
  validateEmail,
  tokenHash,
  routeFrom,
} = mod.__internal;

test("validateEmail accepts normal email and rejects junk", () => {
  assert.equal(validateEmail("User@Example.com"), "user@example.com");
  assert.equal(validateEmail("nope"), null);
});

test("isAllowedOrigin supports exact and wildcard patterns", () => {
  // Build allowlist by mutating env: (module uses ORIGIN_ALLOWLIST at load time in runtime)
  // Here we test the function behavior directly with patterns.
  // Exact
  assert.equal(isAllowedOrigin("https://example.com", ["https://example.com"]), true);
  assert.equal(isAllowedOrigin("https://evil.com", ["https://example.com"]), false);
  // Wildcard
  assert.equal(isAllowedOrigin("https://a.netlify.app", ["https://*.netlify.app"]), true);
  assert.equal(isAllowedOrigin("https://a.netlify.app.evil.com", ["https://*.netlify.app"]), false);
});

test("requireCsrf fails when header/cookie mismatch", () => {
  const event = {
    httpMethod: "POST",
    headers: { cookie: "wpp_csrf=abc", "x-csrf-token": "nope" }
  };
  assert.equal(requireCsrf(event), false);
});

test("tokenHash is stable and changes with token", () => {
  const a = tokenHash("t1");
  const b = tokenHash("t2");
  assert.notEqual(a, b);
});

test("routeFrom strips /api prefix", () => {
  assert.equal(routeFrom({ path: "/api/projects" }), "/projects");
  assert.equal(routeFrom({ path: "/api/auth/login" }), "/auth/login");
});


import crypto from "node:crypto";
import jwt from "jsonwebtoken";

test("OIDC JWKS verification accepts a valid RS256 id_token", () => {
  const { verifyIdTokenWithJwksObject } = mod.__internal;

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  jwk.use = "sig";
  jwk.kid = "k1";
  const jwks = { keys: [jwk] };

  const issuer = "https://issuer.example";
  const clientId = "client123";

  const token = jwt.sign(
    { iss: issuer, aud: clientId, exp: Math.floor(Date.now()/1000) + 60, email: "alice@example.com" },
    privateKey,
    { algorithm: "RS256", header: { kid: "k1" } }
  );

  const res = verifyIdTokenWithJwksObject(token, issuer, clientId, jwks);
  assert.equal(res.ok, true);
  assert.equal(res.payload.email, "alice@example.com");
});

test("SCIM PATCH parser extracts active and email", () => {
  const { parseScimPatch } = mod.__internal;

  const patch = parseScimPatch({
    Operations: [
      { op: "replace", path: "active", value: false },
      { op: "replace", path: "userName", value: "new@example.com" }
    ]
  });

  assert.equal(patch.active, false);
  assert.equal(patch.email, "new@example.com");
});


test("ETag generator is stable for same inputs", () => {
  const { etagFor } = mod.__internal;
  const a = etagFor("id1", "2026-01-01T00:00:00Z");
  const b = etagFor("id1", "2026-01-01T00:00:00Z");
  assert.equal(a, b);
});


test("SCIM group filter parser extracts members.value", () => {
  const { parseScimGroupFilter } = mod.__internal;
  const f = parseScimGroupFilter('members.value eq "11111111-1111-1111-1111-111111111111"');
  assert.equal(f.memberId, "11111111-1111-1111-1111-111111111111");
});


test("SCIM filter parser supports and/or + contains ops", () => {
  const { scimParseFilter, scimCompileFilter } = mod.__internal;
  const ast = scimParseFilter('userName co "example.com" and active eq true');
  const c = scimCompileFilter(ast, 'users');
  assert.ok(c.sql.includes("u.email"));
  assert.ok(c.sql.includes("m.active"));
  assert.ok(c.params.length >= 2);
});

test("SCIM group filter supports or + members.value", () => {
  const { scimParseFilter, scimCompileFilter } = mod.__internal;
  const ast = scimParseFilter('displayName sw "Admin" or members.value eq "11111111-1111-1111-1111-111111111111"');
  const c = scimCompileFilter(ast, 'groups');
  assert.ok(c.sql.includes("g.display_name"));
  assert.ok(c.sql.includes("scim_group_members"));
});


test("SCIM filter precedence: and binds tighter than or", () => {
  const { scimParseFilter } = mod.__internal;
  const ast = scimParseFilter('userName eq "a" or userName eq "b" and active eq true');
  // Expect: or(left=a, right=and(b, active))
  assert.equal(ast.type, "or");
  assert.equal(ast.right.type, "and");
});

test("SCIM filter supports ne + gt/lt on meta timestamps", () => {
  const { scimParseFilter, scimCompileFilter } = mod.__internal;
  const ast = scimParseFilter('meta.lastModified gt "2025-01-01T00:00:00Z" and userName ne "x@example.com"');
  const c = scimCompileFilter(ast, 'users');
  assert.ok(c.sql.includes("u.updated_at"));
  assert.ok(c.sql.includes("<>") || c.sql.includes("ne"));
});

test("SCIM bracket filter on emails[value co ...] maps to email contains", () => {
  const { scimParseFilter, scimCompileFilter } = mod.__internal;
  const ast = scimParseFilter('emails[value co "example.com"]');
  const c = scimCompileFilter(ast, 'users');
  assert.ok(c.sql.includes("u.email"));
});


test("SCIM bracket filters support emails[type eq ... and value co ...]", () => {
  const { scimParseFilter, scimCompileFilter } = mod.__internal;
  const ast = scimParseFilter('emails[type eq "work" and value co "example.com"]');
  const c = scimCompileFilter(ast, 'users');
  assert.ok(c.sql.includes("u.email"));
});

test("SCIM bracket filter supports emails[type ne \"work\" and value co ...] now that multi-email storage exists", () => {
  const { scimParseFilter, scimCompileFilter } = mod.__internal;
  const ast = scimParseFilter(\'emails[type ne "work" and value co "example.com"]\');
  const c = scimCompileFilter(ast, \'users\');
  assert.ok(c.sql.includes("user_emails"));
});


test("SCIM emails bracket supports OR across multiple emails", () => {
  const { scimParseFilter, scimCompileFilter } = mod.__internal;
  const ast = scimParseFilter('emails[type ne "work" or value co "example.com"]');
  const c = scimCompileFilter(ast, 'users');
  assert.ok(c.sql.includes("user_emails"));
  assert.ok(c.sql.includes("OR"));
});
