import { monthKeyUTC } from "./http.js";

/**
 * Voice pricing is kept separate from LLM token pricing.
 * We model cost in *cents per minute* for simplicity.
 *
 * Defaults (approx):
 * - Twilio ConversationRelay: $0.07/min
 * - Twilio inbound local voice example: $0.0085/min
 * - Recording: $0.0025/min
 *
 * You can override via env.
 */

function num(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function voiceMarkupPct() {
  return num(process.env.VOICE_MARKUP_PCT, 31);
}

export function voiceRateDollarsPerMinute({ ai = true, telephony = true, recording = true } = {}) {
  const relay = num(process.env.VOICE_AI_RELAY_USD_PER_MIN, 0.07);
  const tel = num(process.env.VOICE_TELEPHONY_USD_PER_MIN, 0.0085);
  const rec = num(process.env.VOICE_RECORDING_USD_PER_MIN, 0.0025);
  return (ai ? relay : 0) + (telephony ? tel : 0) + (recording ? rec : 0);
}

export function voiceCostCents(minutes, opts = {}) {
  const rate = voiceRateDollarsPerMinute(opts);
  const cents = Math.round(num(minutes, 0) * rate * 100);
  return Math.max(0, cents);
}

export function voiceBillCents(minutes, opts = {}) {
  const cost = voiceCostCents(minutes, opts);
  const markup = voiceMarkupPct() / 100;
  return Math.round(cost * (1 + markup));
}

export function voiceMonthKeyUTC() {
  return monthKeyUTC();
}
