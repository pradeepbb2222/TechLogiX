
import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrderTrackingHandler } from "../src/features/order-tracking/api/orderTrackingHandler";

function createTestHandler(options?: {
  user?: { id: string } | null;
  error?: Error | null;
}) {
  const received: { orderId?: string; userId?: string } = {};

  const handler = createOrderTrackingHandler({
    getAuthenticatedUser: async () => options?.user === undefined
      ? { id: "user-test-001" }
      : options.user,

    createTrackedOrder: async (orderId, userId) => {
      received.orderId = orderId;
      received.userId = userId;

      if (options?.error) {
        throw options.error;
      }

      return {
        orderId,
        status: "ORDER_PLACED",
      };
    },
  });

  return { handler, received };
}

test("returns 401 when the user is unauthenticated", async () => {
  const { handler } = createTestHandler({ user: null });

  const response = await handler(
    new Request("http://localhost/api/order-tracking", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORD-001" }),
    }),
  );

  assert.equal(response.status, 401);
});

test("returns 400 for invalid JSON", async () => {
  const { handler } = createTestHandler();

  const response = await handler(
    new Request("http://localhost/api/order-tracking", {
      method: "POST",
      body: "{invalid",
    }),
  );

  assert.equal(response.status, 400);
});

test("returns 400 when order ID is missing", async () => {
  const { handler } = createTestHandler();

  const response = await handler(
    new Request("http://localhost/api/order-tracking", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );

  assert.equal(response.status, 400);
});

test("creates tracking using the authenticated user's ID", async () => {
  const { handler, received } = createTestHandler();

  const response = await handler(
    new Request("http://localhost/api/order-tracking", {
      method: "POST",
      body: JSON.stringify({ orderId: " ORD-001 " }),
    }),
  );

  assert.equal(response.status, 201);
  assert.equal(received.orderId, "ORD-001");
  assert.equal(received.userId, "user-test-001");

  const body = await response.json();
  assert.equal(body.order.orderId, "ORD-001");
});

test("returns 404 when the order is not found", async () => {
  const { handler } = createTestHandler({
    error: new Error("Order not found."),
  });

  const response = await handler(
    new Request("http://localhost/api/order-tracking", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORD-001" }),
    }),
  );

  assert.equal(response.status, 404);
});

test("returns 400 when payment is not completed", async () => {
  const { handler } = createTestHandler({
    error: new Error("Order tracking requires successful payment."),
  });

  const response = await handler(
    new Request("http://localhost/api/order-tracking", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORD-001" }),
    }),
  );

  assert.equal(response.status, 400);
});

test("returns 500 for unexpected errors", async () => {
  const { handler } = createTestHandler({
    error: new Error("Unexpected database error."),
  });

  const response = await handler(
    new Request("http://localhost/api/order-tracking", {
      method: "POST",
      body: JSON.stringify({ orderId: "ORD-001" }),
    }),
  );

  assert.equal(response.status, 500);
});
