
import { randomUUID } from "node:crypto";
import { getChannel3Product } from "@/lib/channel3";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import {
  planCheckout,
  sweepExpired,
  withCheckoutLock,
} from "@/lib/checkout/logic";
import { fromCents, toCents } from "@/lib/money";
import { createOrder, extractApproveUrl } from "@/lib/paypal/client";
import {
  getMaxPendingOrders,
  getOrderExpiryMs,
  getPayPalConfig,
} from "@/lib/paypal/config";
import {
  errorReply,
  guardMutation,
  reply,
} from "@/lib/paypal/http";
import { getStore } from "@/lib/store";
import { type NewTxRecord } from "@/lib/store/types";
import { getUserSpendingLimitCents } from "@/lib/spending-limits";

export async function POST(request: Request) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;

  const user = await getAuthenticatedUser();

  if (!user) {
    return reply(
      { status: "failed", message: "Please sign in to continue." },
      401,
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        productId?: unknown;
        expectedPrice?: unknown;
        approved?: unknown;
      }
    | null;

  if (body?.approved !== true) {
    return reply(
      { status: "failed", message: "Explicit user approval is required." },
      403,
    );
  }

  const userId = user.id;
  let phase = "initialization";

  try {
    phase = "PayPal configuration";
    const cfg = getPayPalConfig();

    phase = "Channel3 product retrieval";
    const product = await getChannel3Product(
      typeof body.productId === "string" ? body.productId : "",
    );

    if (!product) {
      return reply(
        {
          status: "failed",
          message: "Product is unavailable or no longer in stock.",
        },
        404,
      );
    }

    phase = "price validation";
    const expectedPrice = body.expectedPrice;

    if (
      typeof expectedPrice !== "number" ||
      !Number.isFinite(expectedPrice) ||
      expectedPrice <= 0 ||
      toCents(expectedPrice) !== toCents(product.price)
    ) {
      return reply(
        {
          status: "failed",
          message:
            "The product price has changed or is invalid. Please review the latest price before approving again.",
        },
        409,
      );
    }

    phase = "transaction store initialization";
    const store = getStore();
    phase = "user spending limit retrieval";
    const limitCents = await getUserSpendingLimitCents(userId);

    const outcome = await withCheckoutLock(
      `${userId}:${product.id}`,
      async () => {
        phase = "expired order cleanup";
        await sweepExpired(store, getOrderExpiryMs());

        phase = "checkout planning";
        const plan = await planCheckout(store, {
          userId,
          productId: product.id,
          maxPending: getMaxPendingOrders(),
        });

        if (!plan.ok) {
          return reply(
            { status: "failed", message: plan.message },
            plan.status,
          );
        }

       phase = "checkout amount calculation";
        const amountCents = toCents(product.price);

        phase = "PayPal order creation";
        const order = await createOrder(cfg, {
          requestId: randomUUID(),
          productId: product.id,
          description: `${product.name} (${product.merchant})`,
          amountValue: fromCents(amountCents),
          currency: product.currency,
        });

        phase = "PayPal approval URL validation";
        const approveUrl = extractApproveUrl(order);

        if (!order.id || !approveUrl) {
          return reply(
            {
              status: "failed",
              message: "PayPal did not return a valid approval link.",
            },
            502,
          );
        }

        phase = "transaction persistence";
        const now = new Date().toISOString();

        const record: NewTxRecord = {
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          merchant: product.merchant,
          amountCents,
          currency: product.currency,
          limitCents,
          userId,
          status: "awaiting_approval",
          note: "Waiting for PayPal Sandbox buyer approval",
          createdAt: now,
          updatedAt: now,
        };

        const reservation = await store.reserveCheckout(record);

if (!reservation.reserved) {
  return reply(
    {
      status: "failed",
      message: reservation.message,
    },
    422,
  );
}

        phase = "response preparation";
        return reply(
          {
            status: "awaiting_approval",
            message: "Redirecting to PayPal Sandbox.",
            orderId: order.id,
            approveUrl,
          },
          200,
        );
      },
    );

    if (outcome.locked) {
      return reply(
        {
          status: "failed",
          message:
            "A checkout for this item is already being created. Please wait a moment.",
        },
        409,
      );
    }

    return outcome.value;
  } catch (err) {
    console.error(
      `[agentflow] checkout failed during: ${phase}`,
      err,
    );

    return errorReply(err);
  }
}
