
import {
  captureOrder,
  getOrder,
  PayPalApiError,
  verifyWebhookSignature,
} from "@/lib/paypal/client";
import {
  getPayPalConfig,
  getPayPalWebhookId,
} from "@/lib/paypal/config";
import {
  isStale,
  keepProcessing,
  settleOutcome,
} from "@/lib/paypal/reconcile";
import { classifyOrder } from "@/lib/paypal/verify";
import { checkLimit } from "@/lib/limits";
import { getStore } from "@/lib/store";
import {
  committedCents,
  type TxRecord,
} from "@/lib/store/types";
import { createTrackedOrder } from "@/features/order-tracking/services/trackingStorage";

function ensureTracking(record: TxRecord): Promise<void> {
  if (!record.userId) {
    throw new Error("Missing transaction owner.");
  }

  return createTrackedOrder(record.orderId, record.userId).then(() => {});
}

function response(status: number, message: string) {
  return Response.json({ message }, { status });
}

export async function POST(request: Request) {
  try {
    const event: unknown = await request.json();

    const transmission = {
      authAlgo: request.headers.get("paypal-auth-algo") ?? "",
      certUrl: request.headers.get("paypal-cert-url") ?? "",
      transmissionId:
        request.headers.get("paypal-transmission-id") ?? "",
      transmissionSig:
        request.headers.get("paypal-transmission-sig") ?? "",
      transmissionTime:
        request.headers.get("paypal-transmission-time") ?? "",
    };

    if (Object.values(transmission).some((value) => !value)) {
      return response(400, "Missing PayPal signature headers.");
    }

    const cfg = getPayPalConfig();

    const verified = await verifyWebhookSignature(
      cfg,
      getPayPalWebhookId(),
      transmission,
      event,
    );

    if (!verified) {
      return response(400, "Invalid PayPal webhook signature.");
    }

    if (
      !event ||
      typeof event !== "object" ||
      !("event_type" in event) ||
      !("resource" in event)
    ) {
      return response(400, "Invalid webhook event.");
    }

    const webhookEvent = event as {
      event_type: string;
      resource: { id?: string };
    };

    // Other event types are acknowledged but not processed here.
    if (webhookEvent.event_type !== "CHECKOUT.ORDER.APPROVED") {
      return response(200, "Event acknowledged.");
    }

    const orderId = webhookEvent.resource?.id;

    if (!orderId) {
      return response(400, "Missing PayPal order ID.");
    }

    const store = getStore();
    const record = await store.getByOrderId(orderId);

    if (!record || !record.userId) {
      return response(200, "No eligible transaction found.");
    }

    if (record.status === "completed") {
      await ensureTracking(record);
      return response(200, "Payment already completed.");
    }

    if (record.status === "processing") {
      if (!isStale(record)) {
        return response(
          500,
          "Payment is still processing. Please retry later.",
        );
      }

      const order = await getOrder(cfg, orderId);
      const outcome = classifyOrder(order, {
        orderId,
        amountCents: record.amountCents,
        currency: record.currency,
      });

      const reconciled = await settleOutcome(store, record, outcome, {
        allowRelease: true,
        onCompleted: ensureTracking,
      });

      if (reconciled.status === "processing") {
        return response(500, "Payment is still being verified. Please retry.");
      }

      return response(200, "Payment reconciled.");
    }

    if (record.status !== "awaiting_approval") {
      return response(200, "Transaction is not awaiting approval.");
    }

    // Only one request can claim this transaction for capture.
    const claimed = await store.transition(
      orderId,
      record.userId,
      ["awaiting_approval"],
      {
        status: "processing",
        note: "PayPal approval received. Capturing payment.",
      },
    );

    if (!claimed) {
      return response(200, "Transaction was already claimed.");
    }

    const transactions = await store.listByUser(record.userId);

    const limit = checkLimit({
      limitCents: claimed.limitCents,
      committedCents: committedCents(transactions, orderId),
      amountCents: claimed.amountCents,
    });

    if (!limit.ok) {
      await store.transition(orderId, record.userId, ["processing"], {
        status: "failed",
        note: limit.message ?? "Spending limit exceeded.",
      });

      return response(200, "Transaction exceeded its spending limit.");
    }

    let captureSucceeded = false;

    try {
      await captureOrder(cfg, orderId);
      captureSucceeded = true;
    } catch (err) {
      if (
        err instanceof PayPalApiError &&
        err.issue === "ORDER_NOT_APPROVED"
      ) {
        await store.transition(orderId, record.userId, ["processing"], {
          status: "awaiting_approval",
          note: "PayPal approval is not complete yet.",
        });

        return response(200, "PayPal approval is not complete.");
      }

      console.error(
        "[paypal webhook] Capture request failed; checking PayPal status.",
      );
    }

    // Always verify the final outcome directly with PayPal.
    const order = await getOrder(cfg, orderId);

    const outcome = classifyOrder(order, {
      orderId,
      amountCents: claimed.amountCents,
      currency: claimed.currency,
    });

    const safeOutcome =
      captureSucceeded && outcome.kind === "not_captured"
        ? {
            kind: "unknown" as const,
            reason: "Capture response did not contain verified capture data.",
          }
        : outcome;

    const settled = await settleOutcome(store, claimed, safeOutcome, {
      allowRelease: !captureSucceeded,
      onCompleted: ensureTracking,
    });
    if (settled.status === "processing") {
      return response(500, "Payment is still being verified. Please retry.");
    }

    return response(200, "Payment outcome processed.");
  } catch (err) {
    console.error(
      "[paypal webhook] Processing failed:",
      err instanceof Error ? err.message : "unknown",
    );

    // Ask PayPal to retry transient failures.
    return response(500, "Webhook processing failed.");
  }
}
