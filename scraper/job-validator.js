/**
 * Job URL validation primitives — shared by both validators in this repo.
 *
 * - validateByHead(url): fast HEAD check, only HTTP status matters.
 * - validateByContent(url, opts): GET the page and scan body for expiration
 *   keywords (catches soft-404s where status is 200 but the job is gone).
 *
 * Used by:
 *   - tests/validate-epam-jobs.js (CI nightly cleanup) — uses validateByHead
 *   - validate-jobs.js (manual deep checks)            — uses validateByContent
 */

import fetch from "node-fetch";

export const DEFAULT_EXPIRED_KEYWORDS = [
  "sorry, this position is no longer available",
  "position is no longer available",
  "job is no longer available",
  "this vacancy is no longer available",
  "no longer accepting applications",
  "this position has been filled",
  "job expired"
];

const DEFAULT_USER_AGENT = "job_seeker_ro_spider";
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * HEAD-only validator. Returns the URL active if status is 2xx/3xx, expired
 * otherwise. Fast — used by CI nightly cleanup.
 */
export async function validateByHead(url, { userAgent = DEFAULT_USER_AGENT } = {}) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": userAgent },
      redirect: "follow"
    });
    return {
      url,
      status: res.ok ? "active" : "expired",
      httpStatus: res.status,
      title: null,
      error: null
    };
  } catch (err) {
    return { url, status: "error", httpStatus: 0, title: null, error: err.message };
  }
}

/**
 * Full GET + body scan. Slower, but catches soft-404s where the HTTP status is
 * 200 but the page body says "no longer available". Used for manual cleanups.
 */
export async function validateByContent(url, {
  keywords = DEFAULT_EXPIRED_KEYWORDS,
  userAgent = DEFAULT_USER_AGENT,
  timeout = DEFAULT_TIMEOUT_MS
} = {}) {
  try {
    const res = await fetch(url, {
      timeout,
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      },
      redirect: "follow"
    });

    const text = await res.text().catch(() => "");
    const lower = text.toLowerCase();
    const expired = keywords.some(kw => lower.includes(kw));
    const titleMatch = text.match(/<title>([^<]+)<\/title>/i);

    return {
      url,
      status: expired ? "expired" : "active",
      httpStatus: res.status,
      title: titleMatch ? titleMatch[1].trim() : null,
      error: null
    };
  } catch (err) {
    return { url, status: "error", httpStatus: 0, title: null, error: err.message };
  }
}
