/** Pure verification of a PayPal order response against our own trusted record. */

export interface PayPalMoney {
  currency_code?: string;
  value?: string;
}

export interface PayPalCapture {
  id?: string;
  status?: string;
  amount?: PayPalMoney;
}

export interface PayPalOrder {
  id?: string;
  status?: string;
  links?: { href: string; rel: string }[];
  purchase_units?: { payments?: { captures?: PayPalCapture[] } }[];
}

export type VerifyResult = { ok: true; captureId: string } | { ok: false; reason: string };

export function verifyCapturedOrder(
  order: PayPalOrder,
  expected: { orderId: string; amountCents: number; currency: string },
): VerifyResult {
  if (order.id !== expected.orderId) return { ok: false, reason: "Order id mismatch." };
  if (order.status !== "COMPLETED") return { ok: false, reason: `Order status is ${order.status ?? "unknown"}.` };

  const captures = (order.purchase_units ?? []).flatMap((u) => u.payments?.captures ?? []);
  const capture = captures.find((c) => c.status === "COMPLETED");
  if (!capture?.id) return { ok: false, reason: "No completed capture found." };

  const cents = Math.round(Number.parseFloat(capture.amount?.value ?? "NaN") * 100);
  if (cents !== expected.amountCents) return { ok: false, reason: "Captured amount does not match the order." };
  if (capture.amount?.currency_code !== expected.currency) return { ok: false, reason: "Captured currency does not match." };

  return { ok: true, captureId: capture.id };
}

/** What PayPal's order data tells us about the payment, independent of how we learned it. */
export type OrderOutcome =
  | { kind: "completed"; captureId: string }
  /** Capture exists but is not final (PayPal capture status PENDING). Keep reconciling. */
  | { kind: "pending"; captureId?: string; reason: string }
  /** PayPal confirms no capture exists and the order is still eligible for capture. */
  | { kind: "not_captured" }
  /** PayPal definitively says the money was not (or cannot be) collected as expected. */
  | { kind: "failed"; reason: string; captureId?: string }
  /** Anything we cannot interpret with certainty. Never treat as failed. */
  | { kind: "unknown"; reason: string };

const CAPTURABLE_ORDER_STATUSES = ["CREATED", "SAVED", "APPROVED", "PAYER_ACTION_REQUIRED"];
const DEAD_CAPTURE_STATUSES = ["DECLINED", "FAILED"];

export function classifyOrder(
  order: PayPalOrder,
  expected: { orderId: string; amountCents: number; currency: string },
): OrderOutcome {
  if (order.id !== expected.orderId) return { kind: "unknown", reason: "PayPal returned a different order id" };

  const captures = (order.purchase_units ?? []).flatMap((u) => u.payments?.captures ?? []);

  const completed = captures.find((c) => c.status === "COMPLETED");
  if (completed) {
    if (order.status !== "COMPLETED") return { kind: "unknown", reason: `capture completed but order status is ${order.status ?? "unknown"}` };
    const v = verifyCapturedOrder(order, expected);
    return v.ok ? { kind: "completed", captureId: v.captureId } : { kind: "failed", reason: `${v.reason} Manual review in PayPal is required`, captureId: completed.id };
  }

  const pending = captures.find((c) => c.status === "PENDING");
  if (pending) return { kind: "pending", captureId: pending.id, reason: "PayPal capture is pending" };

  if (captures.length === 0) {
    if (CAPTURABLE_ORDER_STATUSES.includes(order.status ?? "")) return { kind: "not_captured" };
    if (order.status === "VOIDED") return { kind: "failed", reason: "order was voided" };
    return { kind: "unknown", reason: `order status is ${order.status ?? "unknown"} with no capture data` };
  }

  if (captures.every((c) => DEAD_CAPTURE_STATUSES.includes(c.status ?? ""))) {
    return { kind: "failed", reason: `capture ${captures[0].status?.toLowerCase()}`, captureId: captures[0].id };
  }
  return { kind: "unknown", reason: `unrecognised capture status ${captures[0].status ?? "unknown"}` };
}
