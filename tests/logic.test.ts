import assert from "node:assert/strict";
import { test } from "node:test";
import { checkLimit, effectiveLimitCents } from "../src/lib/limits";
import { fromCents, toCents } from "../src/lib/money";
import { verifyCapturedOrder, type PayPalOrder } from "../src/lib/paypal/verify";

const expected = { orderId: "ORD123456789", amountCents: 7999, currency: "USD" };
const goodOrder = (): PayPalOrder => ({
  id: "ORD123456789",
  status: "COMPLETED",
  purchase_units: [{ payments: { captures: [{ id: "CAP1", status: "COMPLETED", amount: { currency_code: "USD", value: "79.99" } }] } }],
});

test("money conversion is exact in cents", () => {
  assert.equal(toCents(79.99), 7999);
  assert.equal(toCents("89.50"), 8950);
  assert.equal(fromCents(4900), "49.00");
});

test("verify accepts a matching completed capture", () => {
  const r = verifyCapturedOrder(goodOrder(), expected);
  assert.deepEqual(r, { ok: true, captureId: "CAP1" });
});

test("verify rejects wrong amount, currency, status, order id", () => {
  const amount = goodOrder();
  amount.purchase_units![0].payments!.captures![0].amount!.value = "1.00";
  assert.equal(verifyCapturedOrder(amount, expected).ok, false);

  const currency = goodOrder();
  currency.purchase_units![0].payments!.captures![0].amount!.currency_code = "EUR";
  assert.equal(verifyCapturedOrder(currency, expected).ok, false);

  assert.equal(verifyCapturedOrder({ ...goodOrder(), status: "APPROVED" }, expected).ok, false);
  assert.equal(verifyCapturedOrder({ ...goodOrder(), id: "OTHER" }, expected).ok, false);

  const pending = goodOrder();
  pending.purchase_units![0].payments!.captures![0].status = "PENDING";
  assert.equal(verifyCapturedOrder(pending, expected).ok, false);
});

test("browser can only lower the spending limit", () => {
  assert.equal(effectiveLimitCents(100_000, 50), 5000);
  assert.equal(effectiveLimitCents(100_000, 999_999), 100_000);
  assert.equal(effectiveLimitCents(100_000, "abc"), 100_000);
  assert.equal(effectiveLimitCents(100_000, -5), 100_000);
});

test("limit check counts already committed spend", () => {
  assert.equal(checkLimit({ limitCents: 10_000, committedCents: 0, amountCents: 10_000 }).ok, true);
  assert.equal(checkLimit({ limitCents: 10_000, committedCents: 5_000, amountCents: 5_001 }).ok, false);
  assert.equal(checkLimit({ limitCents: 10_000, committedCents: 0, amountCents: 0 }).ok, false);
});
