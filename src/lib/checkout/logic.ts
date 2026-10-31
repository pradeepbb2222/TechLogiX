import { timingSafeEqual } from "node:crypto";
import type { PaymentStatus } from "../types";
import type { TxPatch, TxRecord, TxStore } from "../store/types";

/**
 * Pure checkout safety logic: ownership, expiry, supersede/pending-limit planning and the
 * cancel/capture gates. Only type imports from the project, so it is unit-testable in isolation.
 * Every status change goes through the store's atomic conditional `transition`.
 */

export const EXPIRY_NOTE = "Expired: not approved at PayPal within the allowed time. Nothing was charged.";
export const CANCEL_NOTE = "Cancelled at PayPal. Nothing was charged.";
export const SUPERSEDED_NOTE = "Replaced by a newer checkout for the same item. Nothing was charged.";

/* ---------- Ownership ---------- */

/** True only if the record has an owner hash and it equals the caller's session hash. Legacy records never match. */
export function ownsRecord(record: TxRecord, sessionHash: string | null | undefined): boolean {
  if (!record.ownerHash || !sessionHash) return false;
  const a = Buffer.from(record.ownerHash);
  const b = Buffer.from(sessionHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Records visible to a session. No hash means no records; legacy (ownerless) records are never visible. */
export function filterByOwner(records: TxRecord[], ownerHash: string | null | undefined): TxRecord[] {
  if (!ownerHash) return [];
  return records.filter((r) => r.ownerHash === ownerHash);
}

/* ---------- Atomic-update helpers shared by the file store and tests ---------- */

export function applyTransition(
  records: TxRecord[],
  orderId: string,
  from: PaymentStatus[],
  patch: TxPatch,
  nowIso: string,
): { records: TxRecord[]; updated: TxRecord | null } {
  const idx = records.findIndex((r) => r.orderId === orderId);
  if (idx === -1 || !from.includes(records[idx].status)) return { records, updated: null };
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const updated: TxRecord = { ...records[idx], ...defined, updatedAt: nowIso };
  const next = records.slice();
  next[idx] = updated;
  return { records: next, updated };
}

/** Cancels `awaiting_approval` records last touched before `beforeIso`. Never touches any other status. */
export function applyExpiry(
  records: TxRecord[],
  beforeIso: string,
  note: string,
  nowIso: string,
): { records: TxRecord[]; count: number } {
  let count = 0;
  const next = records.map((r) => {
    if (r.status === "awaiting_approval" && r.updatedAt < beforeIso) {
      count++;
      return { ...r, status: "cancelled" as const, note, updatedAt: nowIso };
    }
    return r;
  });
  return { records: next, count };
}

export function isExpired(record: TxRecord, expiryMs: number, now = Date.now()): boolean {
  return record.status === "awaiting_approval" && now - Date.parse(record.updatedAt) > expiryMs;
}

export function sweepExpired(store: TxStore, expiryMs: number, now = Date.now()): Promise<number> {
  return store.expireStale(new Date(now - expiryMs).toISOString(), EXPIRY_NOTE);
}

/* ---------- Gates used by the routes ---------- */

export type CaptureGate =
  | { action: "not_found" }
  | { action: "respond"; record: TxRecord }
  | { action: "proceed"; record: TxRecord };

/** Runs before any capture work: ownership, then expiry. A mismatched owner looks like an unknown order. */
export async function gateCapture(
  store: TxStore,
  orderId: string,
  sessionHash: string | null | undefined,
  expiryMs: number,
  now = Date.now(),
): Promise<CaptureGate> {
  const record = await store.get(orderId);
  if (!record || !ownsRecord(record, sessionHash)) return { action: "not_found" };

  if (isExpired(record, expiryMs, now)) {
    const expired = await store.transition(orderId, ["awaiting_approval"], { status: "cancelled", note: EXPIRY_NOTE });
    // If null, a capture claimed it first; report whatever the record is now.
    return { action: "respond", record: expired ?? (await store.get(orderId)) ?? record };
  }
  return { action: "proceed", record };
}

export type CancelResult = { kind: "not_found" } | { kind: "record"; record: TxRecord };

/** Cancels only an owned, still-pending order. Any other state is returned unchanged. */
export async function cancelPending(store: TxStore, orderId: string, sessionHash: string | null | undefined): Promise<CancelResult> {
  const record = await store.get(orderId);
  if (!record || !ownsRecord(record, sessionHash)) return { kind: "not_found" };
  const cancelled = await store.transition(orderId, ["awaiting_approval"], { status: "cancelled", note: CANCEL_NOTE });
  return { kind: "record", record: cancelled ?? (await store.get(orderId)) ?? record };
}

export type CheckoutPlan = { ok: true } | { ok: false; status: number; message: string };

/**
 * Runs before creating a new PayPal order for this session + product:
 *  - blocks if a payment for the same item is mid-capture (outcome possibly uncertain),
 *  - supersedes earlier pending orders for the same item (this session only),
 *  - enforces the per-session cap on pending orders.
 */
export async function planCheckout(
  store: TxStore,
  args: { ownerHash: string; productId: string; maxPending: number },
): Promise<CheckoutPlan> {
  const inFlight = (rs: TxRecord[]) => rs.some((r) => r.productId === args.productId && r.status === "processing");
  const busy: CheckoutPlan = {
    ok: false,
    status: 409,
    message: "A payment for this item is still being verified with PayPal. Wait for it to finish before starting a new checkout.",
  };

  const mine = await store.listByOwner(args.ownerHash);
  if (inFlight(mine)) return busy;

  for (const r of mine.filter((x) => x.productId === args.productId && x.status === "awaiting_approval")) {
    await store.transition(r.orderId, ["awaiting_approval"], { status: "cancelled", note: SUPERSEDED_NOTE });
  }

  // Re-read: a concurrent capture may have claimed one of those orders in the meantime.
  const after = await store.listByOwner(args.ownerHash);
  if (inFlight(after)) return busy;

  const pending = after.filter((r) => r.status === "awaiting_approval").length;
  if (pending >= args.maxPending) {
    return {
      ok: false,
      status: 429,
      message: `Too many unfinished checkouts (maximum ${args.maxPending}). Complete or cancel one first.`,
    };
  }
  return { ok: true };
}

/* ---------- Duplicate-click protection (per server process) ---------- */

const globalLocks = globalThis as { __agentflowCheckoutLocks?: Set<string> };

/** Runs `fn` unless another call with the same key is already running. */
export async function withCheckoutLock<T>(key: string, fn: () => Promise<T>): Promise<{ locked: true } | { locked: false; value: T }> {
  const locks = (globalLocks.__agentflowCheckoutLocks ??= new Set<string>());
  if (locks.has(key)) return { locked: true };
  locks.add(key);
  try {
    return { locked: false, value: await fn() };
  } finally {
    locks.delete(key);
  }
}
