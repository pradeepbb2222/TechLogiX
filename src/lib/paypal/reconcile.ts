import type { TxPatch, TxRecord, TxStore } from "../store/types";
import type { OrderOutcome } from "./verify";

/**
 * Applies a PayPal-derived outcome to a stored transaction. Dependencies are limited to
 * type imports so this stays unit-testable with an in-memory store.
 *
 * Rules: a record only becomes `completed` from a verified capture, and only becomes
 * `failed` when PayPal definitively says so. Anything uncertain stays `processing`.
 */

/** A `processing` record untouched for longer than this is reconciled with PayPal. */
export const STALE_PROCESSING_MS = 60_000;

export function isStale(record: TxRecord, now = Date.now()): boolean {
  return now - Date.parse(record.updatedAt) > STALE_PROCESSING_MS;
}

export async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 200): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastError;
}

async function current(store: TxStore, record: TxRecord): Promise<TxRecord> {
  return (await retry(() => store.get(record.orderId))) ?? record;
}

/** Conditional update from `processing`; null means someone else already moved it. */
async function fromProcessing(store: TxStore, record: TxRecord, patch: TxPatch): Promise<TxRecord> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as TxPatch;
  const updated = await retry(() => store.transition(record.orderId, ["processing"], clean));
  return updated ?? current(store, record);
}

/** Persists the PayPal capture id immediately; best effort, never throws. */
export async function saveCaptureId(store: TxStore, record: TxRecord, captureId?: string): Promise<void> {
  if (!captureId || record.captureId === captureId) return;
  try {
    await retry(() => store.transition(record.orderId, ["processing"], { captureId }));
  } catch {
    // The final update below carries the capture id too.
  }
}

export async function settleOutcome(
  store: TxStore,
  record: TxRecord,
  outcome: OrderOutcome,
  opts: { allowRelease: boolean },
): Promise<TxRecord> {
  switch (outcome.kind) {
    case "completed":
      await saveCaptureId(store, record, outcome.captureId);
      return fromProcessing(store, record, {
        status: "completed",
        captureId: outcome.captureId,
        note: "Payment captured and verified with PayPal Sandbox.",
      });

    case "pending":
      await saveCaptureId(store, record, outcome.captureId);
      return fromProcessing(store, record, {
        captureId: outcome.captureId,
        note: "PayPal reports the capture as pending. The payment outcome is being verified and will be re-checked.",
      });

    case "failed":
      await saveCaptureId(store, record, outcome.captureId);
      return fromProcessing(store, record, {
        status: "failed",
        captureId: outcome.captureId,
        note: `Payment not completed: ${outcome.reason}.`,
      });

    case "not_captured":
      if (opts.allowRelease) {
        // PayPal confirms nothing was captured: release the claim. A retry reuses the same
        // PayPal-Request-Id, so it cannot create a second capture.
        return fromProcessing(store, record, {
          status: "awaiting_approval",
          note: "PayPal confirmed no capture occurred. Reload this page to retry.",
        });
      }
      return keepProcessing(store, record, "no capture data yet");

    case "unknown":
      return keepProcessing(store, record, outcome.reason);
  }
}

/** Keeps `processing` and refreshes `updatedAt`, which also throttles the next reconciliation. */
export function keepProcessing(store: TxStore, record: TxRecord, reason: string): Promise<TxRecord> {
  return fromProcessing(store, record, {
    note: `Payment outcome is being verified with PayPal (${reason}). Do not pay again; check back shortly.`,
  });
}
