import { q } from "./db.js";

let _Upstash = null;
const _limiterByLimit = new Map();

async function loadUpstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (_Upstash) return _Upstash;

  const [{ Ratelimit }, { Redis }] = await Promise.all([
    import("@upstash/ratelimit"),
    import("@upstash/redis")
  ]);

  _Upstash = { Ratelimit, Redis };
  return _Upstash;
}

function isoReset(reset) {
  if (!reset) return null;
  if (typeof reset === "number") return new Date(reset).toISOString();
  if (reset instanceof Date) return reset.toISOString();
  if (typeof reset === "string") return reset;
  try {
    if (typeof reset?.getTime === "function") return new Date(reset.getTime()).toISOString();
  } catch {}
  return null;
}

/**
 * RPM rate limiting.
 *
 * Priority:
 * 1) Upstash sliding window (if UPSTASH_REDIS_REST_URL/TOKEN present)
 * 2) DB-backed fixed window (simple fallback)
 */
export async function enforceRpm({ customerId, apiKeyId, rpmOverride }) {
  const defaultRpm = parseInt(process.env.DEFAULT_RPM_LIMIT || "120", 10);
  const limit = Number.isFinite(rpmOverride) ? rpmOverride : defaultRpm;

  if (!Number.isFinite(limit) || limit <= 0) {
    return { ok: true, remaining: null, reset: null, mode: "off" };
  }

  const up = await loadUpstash();
  if (up) {
    if (!_limiterByLimit.has(limit)) {
      const redis = up.Redis.fromEnv();
      const rl = new up.Ratelimit({
        redis,
        limiter: up.Ratelimit.slidingWindow(limit, "60 s"),
        prefix: "kaixu:rl"
      });
      _limiterByLimit.set(limit, rl);
    }

    const limiter = _limiterByLimit.get(limit);
    const key = `c${customerId}:k${apiKeyId}`;
    const res = await limiter.limit(key);

    return {
      ok: !!res.success,
      remaining: res.remaining ?? null,
      reset: isoReset(res.reset),
      mode: "upstash"
    };
  }

  // --- DB fallback ---
  const now = Date.now();
  const windowMs = 60_000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const reset = new Date(windowStart.getTime() + windowMs);

  const res = await q(
    `insert into rate_limit_windows(customer_id, api_key_id, window_start, count)
     values ($1,$2,$3,1)
     on conflict (customer_id, api_key_id, window_start)
     do update set count = rate_limit_windows.count + 1
     returning count`,
    [customerId, apiKeyId, windowStart]
  );

  const count = res.rows?.[0]?.count ?? 1;
  const remaining = Math.max(0, limit - count);

  if (Math.random() < 0.01) {
    try {
      await q(`delete from rate_limit_windows where window_start < now() - interval '2 hours'`);
    } catch {}
  }

  return {
    ok: count <= limit,
    remaining,
    reset: reset.toISOString(),
    mode: "db"
  };
}
