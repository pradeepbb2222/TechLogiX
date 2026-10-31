import { createHash, randomBytes } from "node:crypto";

/**
 * Interim anonymous browser-session ownership. This is NOT authentication: it only stops one
 * browser from reading or changing another browser's orders. Replace with real auth later.
 * The raw id lives only in an HttpOnly cookie; the database stores only its SHA-256 hash.
 */

export const SESSION_COOKIE = "agentflow_sid";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;

export interface Session {
  id: string;
  hash: string;
}

/** 256 bits of CSPRNG output, base64url (43 chars). */
export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionId(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

export function sessionFromId(id: string): Session {
  return { id, hash: hashSessionId(id) };
}

/** Returns the session from a Cookie header, or null if absent or malformed. */
export function readSession(cookieHeader: string | null | undefined): Session | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return SESSION_ID.test(value) ? sessionFromId(value) : null;
  }
  return null;
}

/** HttpOnly (invisible to frontend JS), SameSite=Lax (sent on the top-level return from PayPal), Secure when served over https. */
export function sessionCookieHeader(id: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`;
}
