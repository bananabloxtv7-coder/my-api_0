/**
 * Error classification: decides whether a failed upstream response should
 * trigger a key rotation / provider failover.
 *
 * Fatal key errors  -> disable key, move on
 * Transient errors   -> cooldown key, move on
 * Provider errors    -> move to next provider
 */

export type KeyHealthAction =
  | "ok" // success, key is healthy
  | "disable" // key is bad (auth) — disable permanently
  | "cooldown" // transient (rate limit) — short cooldown
  | "quota_exhausted" // no balance/credits — medium cooldown, skip to next provider
  | "error" // generic error — minor penalty, keep usable
  | "ignore"; // not a key issue (e.g. 4xx from client body) — don't rotate

export interface ClassifyResult {
  action: KeyHealthAction;
  cooldownMs: number;
  reason: string;
}

const RATE_LIMIT_COOLDOWN = 30_000; // 30s
const QUOTA_COOLDOWN = 5 * 60 * 1000; // 5 min (was 6h — too long, user can't retry after topping up)
const ERROR_COOLDOWN = 3_000; // 3s

/** Match known error signatures in the upstream response body. */
function matchBodyError(text: string): string | null {
  const lower = text.toLowerCase();
  const rules: Array<{ sig: RegExp; reason: string }> = [
    { sig: /quota exceeded|quota_exceeded|quota limit/i, reason: "quota_exceeded" },
    { sig: /rate limit|rate_limit|too many requests/i, reason: "rate_limited" },
    { sig: /billing required|billing_required|insufficient_quota|insufficient balance/i, reason: "billing_required" },
    { sig: /key disabled|key_disabled|api key has been deactivated/i, reason: "key_disabled" },
    { sig: /unauthorized|invalid api key|invalid_api_key|incorrect api key|authentication/i, reason: "unauthorized" },
    { sig: /daily limit|daily_limit|daily usage limit/i, reason: "daily_limit" },
    { sig: /model not found|model_not_found|does not have access/i, reason: "model_unavailable" },
  ];
  for (const r of rules) {
    if (r.sig.test(text) || r.sig.test(lower)) return r.reason;
  }
  return null;
}

/**
 * Classify an upstream response.
 * @param status HTTP status from upstream
 * @param bodyText response body (truncated) for signature matching
 */
export function classifyResponse(
  status: number,
  bodyText: string
): ClassifyResult {
  if (status >= 200 && status < 300) {
    return { action: "ok", cooldownMs: 0, reason: "success" };
  }

  // 4xx that are client mistakes (bad request body) — don't punish the key
  if (status === 400 || status === 404 || status === 422 || status === 413) {
    const bodyReason = matchBodyError(bodyText);
    if (bodyReason === "model_unavailable") {
      // model not supported by this provider — failover to next provider
      return { action: "error", cooldownMs: ERROR_COOLDOWN, reason: "model_unavailable" };
    }
    return { action: "ignore", cooldownMs: 0, reason: "client_error" };
  }

  // Authentication errors — disable the key
  if (status === 401 || status === 403) {
    return { action: "disable", cooldownMs: 0, reason: matchBodyError(bodyText) || "unauthorized" };
  }

  // Payment required — quota/billing (no balance)
  if (status === 402) {
    return { action: "quota_exhausted", cooldownMs: QUOTA_COOLDOWN, reason: "billing_required" };
  }

  // Rate limited
  if (status === 429) {
    return { action: "cooldown", cooldownMs: RATE_LIMIT_COOLDOWN, reason: matchBodyError(bodyText) || "rate_limited" };
  }

  // Body-signature fallback (some providers return 200/500 with quota text)
  const bodyReason = matchBodyError(bodyText);
  if (bodyReason === "quota_exceeded" || bodyReason === "billing_required" || bodyReason === "daily_limit") {
    return { action: "quota_exhausted", cooldownMs: QUOTA_COOLDOWN, reason: bodyReason };
  }
  if (bodyReason === "rate_limited") {
    return { action: "cooldown", cooldownMs: RATE_LIMIT_COOLDOWN, reason: bodyReason };
  }
  if (bodyReason === "unauthorized" || bodyReason === "key_disabled") {
    return { action: "disable", cooldownMs: 0, reason: bodyReason };
  }

  // 5xx — transient provider error (502/503/504 = provider overloaded, NOT key issue)
  // Use a very short cooldown so the key retries quickly. Don't disable —
  // the key itself is fine, the provider just had a hiccup.
  if (status >= 500) {
    return { action: "error", cooldownMs: ERROR_COOLDOWN, reason: `http_${status}` };
  }

  // Anything else — transient
  return { action: "error", cooldownMs: ERROR_COOLDOWN, reason: `http_${status}` };
}
