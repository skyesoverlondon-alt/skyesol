import test from "node:test";
import assert from "node:assert/strict";

process.env.NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || "postgres://user:pass@localhost:5432/db";
process.env.APP_JWT_SECRET = process.env.APP_JWT_SECRET || "dev_test_secret_change_me";

const mod = await import("../netlify/functions/api.mjs");

test("SAML canonicalization sorts attributes and strips inter-tag whitespace", () => {
  const { samlCanonicalize } = mod.__internal;
  const x = '<A b="2" a="1">  <B> x </B> </A>';
  const c = samlCanonicalize(x);
  assert.ok(c.includes('a="1" b="2"'));
  assert.ok(!c.includes('>  <'));
});

test("SAML digest helper supports SHA-256", () => {
  const { samlDigest } = mod.__internal;
  const d = samlDigest("http://www.w3.org/2001/04/xmlenc#sha256", Buffer.from("abc"));
  assert.ok(typeof d === "string" && d.length > 10);
});
