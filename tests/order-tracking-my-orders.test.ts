import assert from "node:assert/strict";
import { test } from "node:test";
import { createMyOrdersHandler } from "../src/features/order-tracking/api/orderTrackingHandler";
import type { TrackedOrder } from "../src/features/order-tracking/types/order.types";
import type { TxRecord } from "../src/lib/store/types";

const userId = "user-tracking-001";

function makeTrackedOrder(): TrackedOrder {
  const timestamp = "2026-11-12T00:00:00.000Z";

  return {
    orderId: "ORDER-TRACKING-001",
    trackingNumber: "TLX-TRACKING-001",
    productId: "PROD001",
    productName: "Wireless Headphones",
    merchant: "Tech Store",
    amountCents: 7999,
    currency: "USD",
    status: "ORDER_PLACED",
    createdAt: timestamp,
    estimatedDelivery: timestamp,
    updatedAt: timestamp,
    events: [],
    isSimulated: true,
  };
}

function makeTransaction(orderId: string): TxRecord {
  const timestamp = "2026-11-12T00:00:00.000Z";

  return {
    orderId,
    productId: "PROD001",
    productName: "Wireless Headphones",
    merchant: "Tech Store",
    amountCents: 7999,
    currency: "USD",
    limitCents: 100000,
    userId,
    status: "completed",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

test("my-orders GET rejects unauthenticated requests before reading orders", async () => {
  let trackingReads = 0;
  let transactionReads = 0;

  const handler = createMyOrdersHandler({
    getAuthenticatedUser: async () => null,
    getTrackedOrders: async () => {
      trackingReads += 1;
      return [];
    },
    listTransactions: async () => {
      transactionReads += 1;
      return [];
    },
    createTrackedOrder: async () => undefined,
  });

  const response = await handler();

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Unauthorized. Please log in.",
  });
  assert.equal(trackingReads, 0);
  assert.equal(transactionReads, 0);
});

test("my-orders GET scopes tracked orders and recovery to the authenticated user", async () => {
  const trackedOrder = makeTrackedOrder();
  const trackedOrderUsers: string[] = [];
  const transactionUsers: string[] = [];
  const created: Array<{ orderId: string; userId: string }> = [];
  let readCount = 0;

  const handler = createMyOrdersHandler({
    getAuthenticatedUser: async () => ({ id: userId }),
    getTrackedOrders: async (requestedUserId) => {
      trackedOrderUsers.push(requestedUserId);
      readCount += 1;
      return readCount === 1 ? [] : [trackedOrder];
    },
    listTransactions: async (requestedUserId) => {
      transactionUsers.push(requestedUserId);
      return [makeTransaction(trackedOrder.orderId)];
    },
    createTrackedOrder: async (orderId, requestedUserId) => {
      created.push({ orderId, userId: requestedUserId });
      return trackedOrder;
    },
  });

  const response = await handler();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.orders, [trackedOrder]);
  assert.deepEqual(trackedOrderUsers, [userId, userId]);
  assert.deepEqual(transactionUsers, [userId]);
  assert.deepEqual(created, [{ orderId: trackedOrder.orderId, userId }]);
});

test("my-orders GET returns a generic 500 response for database errors", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const handler = createMyOrdersHandler({
      getAuthenticatedUser: async () => ({ id: userId }),
      getTrackedOrders: async () => {
        throw new Error("private database detail");
      },
      listTransactions: async () => [],
      createTrackedOrder: async () => undefined,
    });

    const response = await handler();

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "Unable to fetch your tracked orders.",
    });
  } finally {
    console.error = originalConsoleError;
  }
});
