import { gateCapture } from "@/lib/checkout/logic";
import { checkLimit } from "@/lib/limits";
import { captureOrder, getOrder, PayPalApiError } from "@/lib/paypal/client";
import { getOrderExpiryMs, getPayPalConfig, type PayPalConfig } from "@/lib/paypal/config";
import { errorReply, guardMutation, readOrderId, reply, sessionFromRequest } from "@/lib/paypal/http";
import { isStale, keepProcessing, settleOutcome } from "@/lib/paypal/reconcile";
import { classifyOrder, type PayPalOrder } from "@/lib/paypal/verify";
import { getStore } from "@/lib/store";
import { committedCents, toTransaction, type TxRecord, type TxStore } from "@/lib/store/types";

const VERIFYING = "Payment outcome is being verified with PayPal. Do not pay again; check back shortly.";

/**
 * Captures an approved order. Only an order id is accepted from the browser; amount, currency
 * and status come from our own record and are verified against PayPal's response.
 *
 * Safety model:
 *  - Only one caller can claim the capture (atomic awaiting_approval -> processing).
 *  - A capture is never re-issued because an outcome is uncertain; uncertainty is resolved by
 *    reading the order from PayPal (getOrder).
 *  - `completed` requires a verified COMPLETED capture; `failed` requires a definitive PayPal answer.
 */
export async function POST(request: Request) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;

  const orderId = await readOrderId(request);
  if (!orderId) return reply({ status: "failed", message: "Missing or invalid order id." }, 400);

  let cfg: PayPalConfig;
  let store: TxStore;
  let existing: TxRecord;
  let claimed: TxRecord | null = null;
  try {
    cfg = getPayPalConfig();
    store = getStore();

    // Ownership first (a foreign or legacy order looks unknown), then local expiry. An expired or
    // cancelled order is never captured: the gate cancels it atomically and no PayPal call is made.
    const gate = await gateCapture(store, orderId, sessionFromRequest(request)?.hash, getOrderExpiryMs());
    if (gate.action === "not_found") {
      return reply({ status: "failed", message: "Unknown order, or your browser session has expired." }, 404);
    }
    if (gate.action === "respond") return respond(gate.record);
    existing = gate.record;
    // Final states are returned as-is. In-flight capture: reconcile only if it looks stuck.
    if (existing.status === "processing") {
      return respond(isStale(existing) ? await reconcile(cfg, store, existing) : existing);
    }
    if (existing.status !== "awaiting_approval") return respond(existing);

    claimed = await store.transition(orderId, ["awaiting_approval"], {
      status: "processing",
      note: "Capturing payment. The outcome is being verified with PayPal.",
    });
    if (!claimed) return respond((await store.get(orderId)) ?? existing);
  } catch (err) {
    return errorReply(err); // nothing has been sent to PayPal's capture endpoint yet
  }
  if (!claimed) return reply({ status: "failed", message: "Unknown order." }, 404);

  // From here on a capture may have happened. Never report "no money moved" or failure on errors.
  try {
    const limit = checkLimit({
      limitCents: claimed.limitCents,
      committedCents: committedCents(await store.listByOwner(claimed.ownerHash ?? ""), orderId),
      amountCents: claimed.amountCents,
    });
    if (!limit.ok) {
      // Definitive: the capture call was never made.
      const failed = await store.transition(orderId, ["processing"], { status: "failed", note: limit.message ?? "Spending limit exceeded." });
      return respond(failed ?? claimed);
    }

    let order: PayPalOrder;
    let captureCallSucceeded = false;
    try {
      order = await captureOrder(cfg, orderId); // fixed PayPal-Request-Id => idempotent at PayPal
      captureCallSucceeded = true;
    } catch (err) {
      if (err instanceof PayPalApiError && err.issue === "ORDER_NOT_APPROVED") {
        // Buyer has not approved at PayPal yet: release the claim so they can try again.
        const back = await store.transition(orderId, ["processing"], {
          status: "awaiting_approval",
          note: "PayPal buyer approval not completed yet",
        });
        return respond(back ?? claimed);
      }
      console.error(`[paypal] capture error ${err instanceof PayPalApiError ? `${err.httpStatus} ${err.issue ?? ""} debug_id=${err.debugId ?? "n/a"}` : "network/timeout"}`);
      // The capture may or may not have happened: ask PayPal. Never capture again here.
      const fetched = await getOrder(cfg, orderId).catch(() => null);
      if (!fetched) return respond(await keepProcessing(store, claimed, "could not reach PayPal to confirm"));
      order = fetched;
    }

    let outcome = classifyOrder(order, { orderId, amountCents: claimed.amountCents, currency: claimed.currency });
    // A successful capture response that shows no capture is inconsistent: treat as unknown, not as "retry".
    const allowRelease = !captureCallSucceeded;
    if (captureCallSucceeded && outcome.kind === "not_captured") {
      outcome = { kind: "unknown", reason: "PayPal accepted the capture but returned no capture data" };
    }
    return respond(await settleOutcome(store, claimed, outcome, { allowRelease }));
  } catch (err) {
    console.error("[agentflow] capture handling error:", err instanceof Error ? err.message : "unknown");
    // The record stays `processing` (or its last saved state); recovery will reconcile it with PayPal.
    return reply({ status: "processing", message: VERIFYING }, 202);
  }
}

/** Resolves a stuck `processing` record by reading PayPal. Read-only toward PayPal: never captures. */
async function reconcile(cfg: PayPalConfig, store: TxStore, record: TxRecord): Promise<TxRecord> {
  try {
    const order = await getOrder(cfg, record.orderId);
    const outcome = classifyOrder(order, { orderId: record.orderId, amountCents: record.amountCents, currency: record.currency });
    return await settleOutcome(store, record, outcome, { allowRelease: true });
  } catch {
    return keepProcessing(store, record, "could not reach PayPal to confirm");
  }
}

function respond(record: TxRecord) {
  return reply({ status: record.status, message: record.note ?? "", transaction: toTransaction(record) });
}
