
import assert from "node:assert/strict";
import { test } from "node:test";

import type { TxRecord } from "../src/lib/store/types.ts";
import { createTrackedOrder } from "../src/features/order-tracking/services/orderService.ts";
import { advanceOrderStatus } from "../src/features/order-tracking/services/orderProgress.ts";
import { getOrder } from "../src/features/order-tracking/services/orderStorage.ts";

function createTransaction(
  orderId: string,
  status: TxRecord["status"] = "completed"
): TxRecord {
  const now = new Date().toISOString();

  return {
    orderId,
    productId: "PROD001",
    productName: "Wireless Headphones",
    merchant: "Tech Store",
    amountCents: 7999,
    currency: "USD",
    limitCents: 100000,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

test("completed payment creates a tracked order", () => {
  const transaction = createTransaction("TRACK-TEST-001");

  const order = createTrackedOrder(transaction);

  assert.equal(order.orderId, transaction.orderId);
  assert.equal(order.status, "ORDER_PLACED");
  assert.equal(order.events.length, 1);
  assert.equal(order.isSimulated, true);
});

test("unsuccessful payment cannot create a tracked order", () => {
  const transaction = createTransaction(
    "TRACK-TEST-002",
    "failed"
  );

  assert.throws(
    () => createTrackedOrder(transaction),
    /only be created after successful payment/
  );
});

test("creating the same tracked order twice does not duplicate it", () => {
  const transaction = createTransaction("TRACK-TEST-003");

  const firstOrder = createTrackedOrder(transaction);
  const secondOrder = createTrackedOrder(transaction);

  assert.equal(firstOrder.trackingNumber, secondOrder.trackingNumber);
  assert.equal(secondOrder.events.length, 1);
});

test("order progresses through delivery stages", () => {
  const transaction = createTransaction("TRACK-TEST-004");

  createTrackedOrder(transaction);

  const expectedStatuses = [
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ] as const;

  for (const expectedStatus of expectedStatuses) {
    const updatedOrder = advanceOrderStatus(transaction.orderId);

    assert.ok(updatedOrder);
    assert.equal(updatedOrder.status, expectedStatus);
  }

  const finalOrder = getOrder(transaction.orderId);

  assert.equal(finalOrder?.status, "DELIVERED");
  assert.equal(finalOrder?.events.length, 6);
});

test("delivered order cannot progress further", () => {
  const transaction = createTransaction("TRACK-TEST-005");

  createTrackedOrder(transaction);

  for (let i = 0; i < 5; i++) {
    advanceOrderStatus(transaction.orderId);
  }

  const deliveredOrder = advanceOrderStatus(transaction.orderId);

  assert.equal(deliveredOrder?.status, "DELIVERED");
  assert.equal(deliveredOrder?.events.length, 6);
});