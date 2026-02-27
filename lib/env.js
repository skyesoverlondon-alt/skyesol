// Simple environment variable helpers used by legacy functions.

export function bool(name, defaultValue = false) {
  const v = process.env[name];
  if (v == null) return defaultValue;
  return /^(1|true|yes|on)$/i.test(v);
}

export function int(name, defaultValue = 0) {
  const v = process.env[name];
  if (v == null) return defaultValue;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? defaultValue : n;
}
