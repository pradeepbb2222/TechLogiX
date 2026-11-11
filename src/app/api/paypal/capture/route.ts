import { createTrackedOrder } from "@/features/order-tracking/services/trackingStorage";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { gateCapture } from "@/lib/checkout/logic";
import { checkLimit } from "@/lib/limits";
import { captureOrder, getOrder, PayPalApiError } from "@/lib/paypal/client";
import {
  getOrderExpiryMs,
  getPayPalConfig,
  type PayPalConfig,
} from "@/lib/paypal/config";
import {
  errorReply,
  guardMutation,
  readOrderId,
  reply,
} from "@/lib/paypal/http";
import {
  isStale,
  keepProcessing,
  settleOutcome,
} from "@/lib/paypal/reconcile";
import { classifyOrder, type PayPalOrder } from "@/lib/paypal/verify";
import { getStore } from "@/lib/store";
import {
  committedCents,
  toTransaction,
  type TxRecord,
  type TxStore,
} from "@/lib/store/types";

const VERIFYING =
  "Payment outcome is being verified with PayPal. Do not pay again; check back shortly.";

async function ensureTracking(record: TxRecord): Promise<void> {
  if (!record.userId) {
    throw new Error("Cannot create tracking without an order owner.");
  }

  await createTrackedOrder(record.orderId, record.userId);
}
/**
 * Captures an approved order.
 * Only the authenticated owner can access their transaction.
 *
 * Safety model:
 * - Only one caller can claim the capture.
 * - A capture is never blindly re-issued after an uncertain outcome.
 * - PayPal is queried to reconcile uncertain outcomes.
 * - Completed status requires a verified completed PayPal capture.
 */
export async function POST(request: Request) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;

  const orderId = await readOrderId(request);

  if (!orderId) {
    return reply(
      { status: "failed", message: "Missing or invalid order id." },
      400,
    );
  }

  // Require a valid Supabase-authenticated user.
  const user = await getAuthenticatedUser();

  if (!user) {
    return reply(
      { status: "failed", message: "Authentication required. Please log in again." },
      401,
    );
  }

  let cfg: PayPalConfig;
  let store: TxStore;
  let existing: TxRecord;
  let claimed: TxRecord | null = null;

  try {
    cfg = getPayPalConfig();
    store = getStore();

    // Ownership is checked before expiry or any PayPal operation.
    const gate = await gateCapture(
      store,
      orderId,
      user.id,
      getOrderExpiryMs(),
    );

    if (gate.action === "not_found") {
      return reply(
        { status: "failed", message: "Unknown order." },
        404,
      );
    }

    if (gate.action === "respond") {
      return respond(gate.record);
    }

    existing = gate.record;

    // If a previous capture is still processing, reconcile only if stale.
    if (existing.status === "processing") {
      return respond(
        isStale(existing)
          ? await reconcile(cfg, store, existing)
          : existing,
      );
    }

    if (existing.status !== "awaiting_approval") {
      return respond(existing);
    }

    // Atomically claim the capture for this authenticated user.
    claimed = await store.transition(
      orderId,
      user.id,
      ["awaiting_approval"],
      {
        status: "processing",
        note: "Capturing payment. The outcome is being verified with PayPal.",
      },
    );

    if (!claimed) {
      const latest = await store.get(orderId, user.id);
      return latest ? respond(latest) : respond(existing);
    }
  } catch (err) {
    return errorReply(err);
  }

  if (!claimed) {
    return reply({ status: "failed", message: "Unknown order." }, 404);
  }

  // From this point onward, a capture may have happened.
  // Never claim that no money moved when the outcome is uncertain.
  try {
    const userTransactions = await store.listByUser(user.id);

    const limit = checkLimit({
      limitCents: claimed.limitCents,
      committedCents: committedCents(userTransactions, orderId),
      amountCents: claimed.amountCents,
    });

    if (!limit.ok) {
      const failed = await store.transition(
        orderId,
        user.id,
        ["processing"],
        {
          status: "failed",
          note: limit.message ?? "Spending limit exceeded.",
        },
      );

      return respond(failed ?? claimed);
    }

    let order: PayPalOrder;
    let captureCallSucceeded = false;

    try {
      order = await captureOrder(cfg, orderId);
      captureCallSucceeded = true;
    } catch (err) {
      if (
        err instanceof PayPalApiError &&
        err.issue === "ORDER_NOT_APPROVED"
      ) {
        // Buyer approval is incomplete. Allow another attempt.
        const back = await store.transition(
          orderId,
          user.id,
          ["processing"],
          {
            status: "awaiting_approval",
            note: "PayPal buyer approval not completed yet",
          },
        );

        return respond(back ?? claimed);
      }

      console.error(
        `[paypal] capture error ${
          err instanceof PayPalApiError
            ? `${err.httpStatus} ${err.issue ?? ""} debug_id=${err.debugId ?? "n/a"}`
            : "network/timeout"
        }`,
      );

      // Capture may have succeeded despite the error.
      // Query PayPal instead of issuing another capture.
      const fetched = await getOrder(cfg, orderId).catch(() => null);

      if (!fetched) {
        return respond(
          await keepProcessing(
            store,
            claimed,
            "could not reach PayPal to confirm",
          ),
        );
      }

      order = fetched;
    }

    let outcome = classifyOrder(order, {
      orderId,
      amountCents: claimed.amountCents,
      currency: claimed.currency,
    });

    // A successful capture response without capture data is uncertain.
    const allowRelease = !captureCallSucceeded;

    if (captureCallSucceeded && outcome.kind === "not_captured") {
      outcome = {
        kind: "unknown",
        reason: "PayPal accepted the capture but returned no capture data",
      };
    }

    return respond(
      await settleOutcome(store, claimed, outcome, {
        allowRelease,
        onCompleted: ensureTracking,
      }),
    );
  } catch (err) {
    console.error(
      "[agentflow] capture handling error:",
      err instanceof Error ? err.message : "unknown",
    );

    // Leave the record processing so it can be reconciled safely.
    return reply(
      { status: "processing", message: VERIFYING },
      202,
    );
  }
}

/**
 * Resolves a stuck processing record by reading PayPal.
 * This function never initiates another capture.
 */
async function reconcile(
  cfg: PayPalConfig,
  store: TxStore,
  record: TxRecord,
): Promise<TxRecord> {
  try {
    const order = await getOrder(cfg, record.orderId);

    const outcome = classifyOrder(order, {
      orderId: record.orderId,
      amountCents: record.amountCents,
      currency: record.currency,
    });

    return await settleOutcome(store, record, outcome, {
      allowRelease: true,
      onCompleted: ensureTracking,
    });
  } catch {
    return keepProcessing(
      store,
      record,
      "could not reach PayPal to confirm",
    );
  }
}

function respond(record: TxRecord) {
  return reply({
    status: record.status,
    message: record.note ?? "",
    transaction: toTransaction(record),
  });
}
