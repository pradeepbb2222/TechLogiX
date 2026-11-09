
import type { PaymentStatus } from "../types";
import type { TxPatch, TxRecord, TxStore } from "../store/types";

/**
 * Checkout safety logic: authenticated ownership, expiry, checkout planning,
 * and cancellation/capture gates.
 */

export const EXPIRY_NOTE =
  "Expired: not approved at PayPal within the allowed time. Nothing was charged.";

export const CANCEL_NOTE =
  "Cancelled at PayPal. Nothing was charged.";

export const SUPERSEDED_NOTE =
  "Replaced by a newer checkout for the same item. Nothing was charged.";

/* ---------- Ownership ---------- */

/** A transaction belongs to a user only when both IDs match. */
export function ownsRecord(
  record: TxRecord,
  userId: string | null | undefined,
): boolean {
  return Boolean(userId && record.userId && record.userId === userId);
}

/** Legacy transactions without a user ID are never exposed. */
export function filterByUser(
  records: TxRecord[],
  userId: string | null | undefined,
): TxRecord[] {
  if (!userId) return [];
  return records.filter((record) => record.userId === userId);
}

/* ---------- Atomic-update helpers ---------- */

export function applyTransition(
  records: TxRecord[],
  orderId: string,
  userId: string,
  from: PaymentStatus[],
  patch: TxPatch,
  nowIso: string,
): { records: TxRecord[]; updated: TxRecord | null } {
  const idx = records.findIndex(
    (record) =>
      record.orderId === orderId &&
      record.userId === userId,
  );

  if (idx === -1 || !from.includes(records[idx].status)) {
    return { records, updated: null };
  }

  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );

  const updated: TxRecord = {
    ...records[idx],
    ...defined,
    updatedAt: nowIso,
  };

  const next = records.slice();
  next[idx] = updated;

  return { records: next, updated };
}

/** Global server-side maintenance: only expires stale awaiting-approval records. */
export function applyExpiry(
  records: TxRecord[],
  beforeIso: string,
  note: string,
  nowIso: string,
): { records: TxRecord[]; count: number } {
  let count = 0;

  const next = records.map((record) => {
    if (
      record.status === "awaiting_approval" &&
      record.updatedAt < beforeIso
    ) {
      count++;

      return {
        ...record,
        status: "cancelled" as const,
        note,
        updatedAt: nowIso,
      };
    }

    return record;
  });

  return { records: next, count };
}

export function isExpired(
  record: TxRecord,
  expiryMs: number,
  now = Date.now(),
): boolean {
  return (
    record.status === "awaiting_approval" &&
    now - Date.parse(record.updatedAt) > expiryMs
  );
}

export function sweepExpired(
  store: TxStore,
  expiryMs: number,
  now = Date.now(),
): Promise<number> {
  return store.expireStale(
    new Date(now - expiryMs).toISOString(),
    EXPIRY_NOTE,
  );
}

/* ---------- Capture and cancellation gates ---------- */

export type CaptureGate =
  | { action: "not_found" }
  | { action: "respond"; record: TxRecord }
  | { action: "proceed"; record: TxRecord };

/** An order belonging to another user looks like an unknown order. */
export async function gateCapture(
  store: TxStore,
  orderId: string,
  userId: string,
  expiryMs: number,
  now = Date.now(),
): Promise<CaptureGate> {
  const record = await store.get(orderId, userId);

  if (!record || !ownsRecord(record, userId)) {
    return { action: "not_found" };
  }

  if (isExpired(record, expiryMs, now)) {
    const expired = await store.transition(
      orderId,
      userId,
      ["awaiting_approval"],
      { status: "cancelled", note: EXPIRY_NOTE },
    );

    return {
      action: "respond",
      record: expired ?? (await store.get(orderId, userId)) ?? record,
    };
  }

  return { action: "proceed", record };
}

export type CancelResult =
  | { kind: "not_found" }
  | { kind: "record"; record: TxRecord };

/** Cancels only an authenticated user's still-pending order. */
export async function cancelPending(
  store: TxStore,
  orderId: string,
  userId: string,
): Promise<CancelResult> {
  const record = await store.get(orderId, userId);

  if (!record || !ownsRecord(record, userId)) {
    return { kind: "not_found" };
  }

  const cancelled = await store.transition(
    orderId,
    userId,
    ["awaiting_approval"],
    { status: "cancelled", note: CANCEL_NOTE },
  );

  return {
    kind: "record",
    record: cancelled ?? (await store.get(orderId, userId)) ?? record,
  };
}

export type CheckoutPlan =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * Plans checkout for one authenticated user and product.
 * Prevents overlapping captures, supersedes that user's old pending orders,
 * and enforces that user's pending-order limit.
 */
export async function planCheckout(
  store: TxStore,
  args: { userId: string; productId: string; maxPending: number },
): Promise<CheckoutPlan> {
  const inFlight = (records: TxRecord[]) =>
    records.some(
      (record) =>
        record.productId === args.productId &&
        record.status === "processing",
    );

  const busy: CheckoutPlan = {
    ok: false,
    status: 409,
    message:
      "A payment for this item is still being verified with PayPal. Wait for it to finish before starting a new checkout.",
  };

  const mine = await store.listByUser(args.userId);

  if (inFlight(mine)) return busy;

  for (const record of mine.filter(
    (item) =>
      item.productId === args.productId &&
      item.status === "awaiting_approval",
  )) {
    await store.transition(
      record.orderId,
      args.userId,
      ["awaiting_approval"],
      { status: "cancelled", note: SUPERSEDED_NOTE },
    );
  }

  // Re-read in case a concurrent capture claimed an order.
  const after = await store.listByUser(args.userId);

  if (inFlight(after)) return busy;

  const pending = after.filter(
    (record) => record.status === "awaiting_approval",
  ).length;

  if (pending >= args.maxPending) {
    return {
      ok: false,
      status: 429,
      message: `Too many unfinished checkouts (maximum ${args.maxPending}). Complete or cancel one first.`,
    };
  }

  return { ok: true };
}

/* ---------- Duplicate-click protection ---------- */

const globalLocks = globalThis as {
  __agentflowCheckoutLocks?: Set<string>;
};

/** Supplementary duplicate-click protection within one server process. */
export async function withCheckoutLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<
  { locked: true } | { locked: false; value: T }
> {
  const locks =
    (globalLocks.__agentflowCheckoutLocks ??= new Set<string>());

  if (locks.has(key)) return { locked: true };

  locks.add(key);

  try {
    return { locked: false, value: await fn() };
  } finally {
    locks.delete(key);
  }
}
