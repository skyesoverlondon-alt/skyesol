/**
 * defaults.js  —  Hardcoded defaults for non-secret config env vars.
 *
 * Netlify Functions inherit ALL env vars, and the combined size is
 * capped at 4 KB by AWS Lambda.  By hardcoding sensible defaults here
 * and *removing* the matching entries from the Netlify dashboard, we
 * stay well under that limit.
 *
 * Import this file (side-effect) early in any shared module so that
 * process.env is pre-populated before any function reads it.
 * ES-module caching guarantees the block below runs exactly once.
 */

const DEFAULTS = {
  // ── Governance / Billing ────────────────────────────────
  ALLOWED_ORIGINS:                   "*",
  DEFAULT_CUSTOMER_CAP_CENTS:        "2000",
  DEFAULT_RPM_LIMIT:                 "120",
  CAP_WARN_PCT:                      "85",
  USER_SESSION_TTL_SECONDS:          "21600",
  DISABLE_ADMIN_PASSWORD_HEADER:     "false",

  // ── Async-job retention ─────────────────────────────────
  ASYNC_JOB_SUCCESS_RETENTION_DAYS:  "7",
  ASYNC_JOB_RETENTION_DAYS:          "30",

  // ── kAIxuPush (Netlify deploy pipeline) ─────────────────
  PUSH_CHUNK_RETENTION_HOURS:        "48",
  PUSH_NETLIFY_MAX_DEPLOYS_PER_MIN:  "3",
  PUSH_NETLIFY_MAX_DEPLOYS_PER_DAY:  "100",
  PUSH_UPLOAD_INLINE_RETRIES:        "3",
  PUSH_JOB_MAX_ATTEMPTS:             "10",
  PUSH_JOB_RETRY_BASE_MS:            "750",
  PUSH_JOB_RETRY_MAX_MS:             "30000",

  // ── GitHub Push Gateway ─────────────────────────────────
  GITHUB_API_BASE:                   "https://api.github.com",
  GITHUB_API_VERSION:                "2022-11-28",
  GITHUB_PUSH_MAX_FILES:             "3000",
  GITHUB_PUSH_MAX_TOTAL_BYTES:       "104857600",
  GITHUB_PUSH_MAX_FILE_BYTES:        "10485760",
  GITHUB_JOB_MAX_ATTEMPTS:           "10",
  GITHUB_JOB_RETRY_BASE_MS:          "1000",
  GITHUB_JOB_RETRY_MAX_MS:           "60000",
  GITHUB_CHUNK_RETENTION_HOURS:      "48",

  // ── Monitoring / Archive ────────────────────────────────
  MONITOR_ARCHIVE_STORE:             "blobs",
  BLOBS_STORE:                       "sol_growth",
  MONITOR_ARCHIVE_BATCH_SIZE:        "500",
  MONITOR_ARCHIVE_MAX_BATCHES:       "20",
  MONITOR_RETENTION_DAYS:            "30",

  // ── Stripe defaults ─────────────────────────────────────
  STRIPE_CURRENCY:                   "usd",
  PUBLIC_APP_ORIGIN:                 "https://skyesol.netlify.app",

  // ── Voice / Twilio pricing ──────────────────────────────
  VOICE_AI_RELAY_USD_PER_MIN:        "0.07",
  VOICE_TELEPHONY_USD_PER_MIN:       "0.0085",
  VOICE_RECORDING_USD_PER_MIN:       "0.0025",
  VOICE_MARKUP_PCT:                  "31",
  VOICE_FALLBACK_TRANSFER_NUMBER:    "",
};

for (const [key, value] of Object.entries(DEFAULTS)) {
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}
