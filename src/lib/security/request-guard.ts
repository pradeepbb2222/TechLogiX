/** Request checks for payment mutation endpoints (pure, so they can be unit tested). */

export type GuardResult = { ok: true } | { ok: false; status: number; message: string };

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * - Content-Type must be application/json (blocks cross-site "simple" form/text posts).
 * - If an Origin header is present it must be this server's own origin or APP_URL's origin.
 * - Without Origin, a browser-supplied Sec-Fetch-Site must be same-origin/none.
 *   (Non-browser clients send neither header; they still need a valid session cookie.)
 */
export function checkMutationRequest(headers: Pick<Headers, "get">, requestUrl: string, appUrl: string): GuardResult {
  const contentType = headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, status: 415, message: "Content-Type must be application/json." };
  }

  const origin = headers.get("origin");
  if (origin !== null) {
    const allowed = new Set([originOf(requestUrl), originOf(appUrl)].filter((o): o is string => o !== null));
    if (!allowed.has(origin)) return { ok: false, status: 403, message: "Invalid request origin." };
    return { ok: true };
  }

  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return { ok: false, status: 403, message: "Cross-site requests are not allowed." };
  }
  return { ok: true };
}
