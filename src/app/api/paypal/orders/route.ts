import { randomUUID } from "node:crypto";
import { SAMPLE_CATALOG } from "@/lib/catalog";
import { planCheckout, sweepExpired, withCheckoutLock } from "@/lib/checkout/logic";
import { checkLimit, effectiveLimitCents } from "@/lib/limits";
import { fromCents, toCents } from "@/lib/money";
import { createOrder, extractApproveUrl } from "@/lib/paypal/client";
import { getMaxPendingOrders, getOrderExpiryMs, getPayPalConfig, getServerSpendingLimitCents } from "@/lib/paypal/config";
import { errorReply, guardMutation, reply, sessionFromRequest, shouldUseSecureCookies } from "@/lib/paypal/http";
import { newSessionId, sessionCookieHeader, sessionFromId } from "@/lib/security/session";
import { getStore } from "@/lib/store";
import { committedCents, type TxRecord } from "@/lib/store/types";

/**
 * Creates a PayPal Sandbox order. The browser only sends a product id, explicit approval,
 * and an optional (stricter-only) limit hint. Price and currency come from the server catalog.
 * The order is owned by the caller's anonymous session (cookie issued here if missing).
 */
export async function POST(request: Request) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;

  const body = (await request.json().catch(() => null)) as
    | { productId?: unknown; spendingLimit?: unknown; approved?: unknown }
    | null;

  const product = SAMPLE_CATALOG.find((p) => p.id === body?.productId);
  if (!product) return reply({ status: "failed", message: "Unknown product." }, 400);
  if (body?.approved !== true) return reply({ status: "failed", message: "Explicit user approval is required." }, 403);

  const existingSession = sessionFromRequest(request);
  const session = existingSession ?? sessionFromId(newSessionId());
  const cookieHeaders = existingSession ? undefined : { "Set-Cookie": sessionCookieHeader(session.id, shouldUseSecureCookies()) };

  try {
    const cfg = getPayPalConfig();
    const store = getStore();

    // Repeated clicks: only one checkout per session + product may be in progress at a time.
    const outcome = await withCheckoutLock(`${session.hash}:${product.id}`, async () => {
      await sweepExpired(store, getOrderExpiryMs());

      const plan = await planCheckout(store, { ownerHash: session.hash, productId: product.id, maxPending: getMaxPendingOrders() });
      if (!plan.ok) return reply({ status: "failed", message: plan.message }, plan.status, cookieHeaders);

      const amountCents = toCents(product.price);
      const limitCents = effectiveLimitCents(getServerSpendingLimitCents(), body?.spendingLimit);
      const limit = checkLimit({
        limitCents,
        committedCents: committedCents(await store.listByOwner(session.hash)),
        amountCents,
      });
      if (!limit.ok) return reply({ status: "failed", message: limit.message ?? "Spending limit exceeded." }, 422, cookieHeaders);

      const order = await createOrder(cfg, {
        requestId: randomUUID(),
        productId: product.id,
        description: `${product.name} (${product.merchant})`,
        amountValue: fromCents(amountCents),
        currency: product.currency,
      });
      const approveUrl = extractApproveUrl(order);
      if (!order.id || !approveUrl) {
        return reply({ status: "failed", message: "PayPal did not return a valid approval link." }, 502, cookieHeaders);
      }

      const now = new Date().toISOString();
      const record: TxRecord = {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        merchant: product.merchant,
        amountCents,
        currency: product.currency,
        limitCents,
        ownerHash: session.hash,
        status: "awaiting_approval",
        note: "Waiting for PayPal Sandbox buyer approval",
        createdAt: now,
        updatedAt: now,
      };
      await store.create(record);

      return reply(
        { status: "awaiting_approval", message: "Redirecting to PayPal Sandbox.", orderId: order.id, approveUrl },
        200,
        cookieHeaders,
      );
    });

    if (outcome.locked) {
      return reply({ status: "failed", message: "A checkout for this item is already being created. Please wait a moment." }, 409, cookieHeaders);
    }
    return outcome.value;
  } catch (err) {
    return errorReply(err);
  }
}