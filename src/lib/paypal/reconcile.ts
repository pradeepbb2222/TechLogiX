
import type { TxPatch, TxRecord, TxStore } from "../store/types";
import type { OrderOutcome } from "./verify";

/**
 * Applies a PayPal-derived outcome to a stored transaction.
 *
 * A record only becomes completed from a verified capture.
 * A record only becomes failed when PayPal definitively says so.
 * Uncertain outcomes remain processing.
 *
 * Every read and update is scoped to the authenticated transaction owner.
 */

export const STALE_PROCESSING_MS = 60_000;

export function isStale(record: TxRecord, now = Date.now()): boolean {
  return now - Date.parse(record.updatedAt) > STALE_PROCESSING_MS;
}

export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 200,
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (i < attempts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * 2 ** i),
        );
      }
    }
  }

  throw lastError;
}

async function current(
  store: TxStore,
  record: TxRecord,
): Promise<TxRecord> {
  if (!record.userId) return record;

  return (
    (await retry(() => store.get(record.orderId, record.userId!))) ??
    record
  );
}

/** Conditional update from processing; null means another request moved it. */
async function fromProcessing(
  store: TxStore,
  record: TxRecord,
  patch: TxPatch,
): Promise<TxRecord> {
  if (!record.userId) return record;

  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as TxPatch;

  const updated = await retry(() =>
    store.transition(
      record.orderId,
      record.userId!,
      ["processing"],
      clean,
    ),
  );

  return updated ?? current(store, record);
}

/** Persists the PayPal capture ID immediately; best effort, never throws. */
export async function saveCaptureId(
  store: TxStore,
  record: TxRecord,
  captureId?: string,
): Promise<void> {
  if (!captureId || record.captureId === captureId || !record.userId) {
    return;
  }

  try {
    await retry(() =>
      store.transition(
        record.orderId,
        record.userId!,
        ["processing"],
        { captureId },
      ),
    );
  } catch {
    // The final update below carries the capture ID too.
  }
}

export async function settleOutcome(
  store: TxStore,
  record: TxRecord,
  outcome: OrderOutcome,
  opts: {
    allowRelease: boolean;
    onCompleted?: (record: TxRecord) => Promise<void>;
  },
): Promise<TxRecord> {
  if (!record.userId) return record;

    switch (outcome.kind) {
      case "completed": {
      await saveCaptureId(store, record, outcome.captureId);

      const completed = await fromProcessing(store, record, {
        status: "completed",
        captureId: outcome.captureId,
        note: "Payment captured and verified with PayPal Sandbox.",
      });

      if (completed.status === "completed" && opts.onCompleted) {
        await opts.onCompleted(completed);
      }

      return completed;
    }

    case "pending":
      await saveCaptureId(store, record, outcome.captureId);

      return fromProcessing(store, record, {
        captureId: outcome.captureId,
        note: "The payment outcome is being verified and will be re-checked.",
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

/** Keeps processing and refreshes updatedAt to throttle reconciliation. */
export function keepProcessing(
  store: TxStore,
  record: TxRecord,
  reason: string,
): Promise<TxRecord> {
  return fromProcessing(store, record, {
    note: `Payment outcome is being verified with PayPal (${reason}). Do not pay again; check back shortly.`,
  });
}
