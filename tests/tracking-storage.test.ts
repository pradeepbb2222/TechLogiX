
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTrackedOrder,
  getTrackedOrders,
} from "../src/features/order-tracking/services/trackingStorage";

test("creates a tracked order using Supabase and its atomic RPC", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  const calls: { url: string; method: string; body?: string }[] = [];

  const transaction = {
    order_id: "ORD-TEST-001",
    product_id: "PROD001",
    product_name: "Wireless Headphones",
    merchant: "Tech Store",
    amount_cents: 7999,
    currency: "USD",
    limit_cents: 100000,
    owner_hash: null,
    user_id: "user-test-001",
    status: "completed",
    note: null,
    capture_id: "CAPTURE-001",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const trackedOrder = {
    order_id: "ORD-TEST-001",
    user_id: "user-test-001",
    tracking_number: "TLX-TEST-001",
    product_id: "PROD001",
    product_name: "Wireless Headphones",
    merchant: "Tech Store",
    amount_cents: 7999,
    currency: "USD",
    status: "ORDER_PLACED",
    estimated_delivery: "2026-01-06T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const trackingEvent = {
    id: "EVENT-001",
    order_id: "ORD-TEST-001",
    status: "ORDER_PLACED",
    title: "Order Placed",
    description: "Your order has been placed.",
    timestamp: "2026-01-01T00:00:00.000Z",
  };

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    calls.push({
      url,
      method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });

    if (url.includes("/transactions?")) {
      return new Response(JSON.stringify([transaction]), {
        status: 200,
      });
    }

    if (url.includes("/tracked_orders?")) {
      return new Response("[]", { status: 200 });
    }

    if (url.includes("/rpc/create_tracked_order_with_event")) {
      return new Response(JSON.stringify([trackedOrder]), {
        status: 200,
      });
    }

    if (url.includes("/tracking_events?")) {
      return new Response(JSON.stringify([trackingEvent]), {
        status: 200,
      });
    }

    return new Response("Unexpected request", { status: 500 });
  }) as typeof fetch;

  try {
    const order = await createTrackedOrder(
      "ORD-TEST-001",
      "user-test-001",
    );

    assert.equal(order.orderId, "ORD-TEST-001");
    assert.equal(order.productName, "Wireless Headphones");
    assert.equal(order.status, "ORDER_PLACED");
    assert.equal(order.events.length, 1);
    assert.equal(order.isSimulated, true);

    const rpcCall = calls.find((call) =>
      call.url.includes("/rpc/create_tracked_order_with_event"),
    );

    assert.ok(rpcCall, "Atomic creation RPC should be called");
    assert.equal(rpcCall.method, "POST");

    const rpcBody = JSON.parse(rpcCall.body ?? "{}");

    assert.equal(rpcBody.p_order_id, "ORD-TEST-001");
    assert.equal(rpcBody.p_user_id, "user-test-001");
    assert.equal(rpcBody.p_amount_cents, 7999);
    assert.equal(rpcBody.p_product_name, "Wireless Headphones");
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  }
});

test("rejects an order that does not belong to the user", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  globalThis.fetch = (async () => {
    // No transaction matches this order ID and user ID.
    return new Response("[]", { status: 200 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      createTrackedOrder("ORD-TEST-001", "different-user"),
      {
        message: "Order not found.",
      },
    );
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  }
});

test("rejects tracking creation when payment is not completed", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  const transaction = {
  order_id: "ORD-TEST-002",
  product_id: "PROD001",
  product_name: "Wireless Headphones",
  merchant: "Tech Store",
  amount_cents: 7999,
  currency: "USD",
  limit_cents: 100000,
  owner_hash: null,
  user_id: "user-test-001",
  status: "awaiting_approval",
  note: null,
  capture_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

  globalThis.fetch = (async () => {
    return new Response(JSON.stringify([transaction]), {
      status: 200,
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      createTrackedOrder("ORD-TEST-002", "user-test-001"),
      {
        message: "Order tracking requires successful payment.",
      },
    );
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  }
});

test("returns existing tracking without creating a duplicate", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  const calls: string[] = [];

  const transaction = {
    order_id: "ORD-TEST-003",
    product_id: "PROD001",
    product_name: "Wireless Headphones",
    merchant: "Tech Store",
    amount_cents: 7999,
    currency: "USD",
    limit_cents: 100000,
    owner_hash: null,
    user_id: "user-test-001",
    status: "completed",
    note: null,
    capture_id: "CAPTURE-003",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const existingOrder = {
    order_id: "ORD-TEST-003",
    user_id: "user-test-001",
    tracking_number: "TLX-EXISTING-003",
    product_id: "PROD001",
    product_name: "Wireless Headphones",
    merchant: "Tech Store",
    amount_cents: 7999,
    currency: "USD",
    status: "ORDER_PLACED",
    estimated_delivery: "2026-01-06T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const trackingEvent = {
    id: "EVENT-003",
    order_id: "ORD-TEST-003",
    status: "ORDER_PLACED",
    title: "Order Placed",
    description: "Your order has been placed.",
    timestamp: "2026-01-01T00:00:00.000Z",
  };

  globalThis.fetch = (async (input) => {
    const url = String(input);
    calls.push(url);

    if (url.includes("/transactions?")) {
      return new Response(JSON.stringify([transaction]), {
        status: 200,
      });
    }

    if (url.includes("/tracked_orders?")) {
      return new Response(JSON.stringify([existingOrder]), {
        status: 200,
      });
    }

    if (url.includes("/tracking_events?")) {
      return new Response(JSON.stringify([trackingEvent]), {
        status: 200,
      });
    }

    return new Response("Unexpected request", { status: 500 });
  }) as typeof fetch;

  try {
    const order = await createTrackedOrder(
      "ORD-TEST-003",
      "user-test-001",
    );

    assert.equal(order.trackingNumber, "TLX-EXISTING-003");
    assert.equal(order.events.length, 1);

    const rpcCalled = calls.some((url) =>
      url.includes("/rpc/create_tracked_order_with_event"),
    );

    assert.equal(rpcCalled, false);
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  }
});

test("throws an error when the tracking creation RPC fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  const transaction = {
    order_id: "ORD-TEST-004",
    product_id: "PROD001",
    product_name: "Wireless Headphones",
    merchant: "Tech Store",
    amount_cents: 7999,
    currency: "USD",
    limit_cents: 100000,
    owner_hash: null,
    user_id: "user-test-001",
    status: "completed",
    note: null,
    capture_id: "CAPTURE-004",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  globalThis.fetch = (async (input) => {
    const url = String(input);

    if (url.includes("/transactions?")) {
      return new Response(JSON.stringify([transaction]), {
        status: 200,
      });
    }

    if (url.includes("/tracked_orders?")) {
      return new Response("[]", { status: 200 });
    }

    if (url.includes("/rpc/create_tracked_order_with_event")) {
      return new Response(
        JSON.stringify({ message: "Database unavailable." }),
        { status: 500 },
      );
    }

    return new Response("Unexpected request", { status: 500 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      createTrackedOrder("ORD-TEST-004", "user-test-001"),
      {
        message: "Tracking database request failed (500).",
      },
    );
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  }
});

test("throws an error when tracking events cannot be retrieved", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  const transaction = {
    order_id: "ORD-TEST-005",
    product_id: "PROD001",
    product_name: "Wireless Headphones",
    merchant: "Tech Store",
    amount_cents: 7999,
    currency: "USD",
    limit_cents: 100000,
    owner_hash: null,
    user_id: "user-test-001",
    status: "completed",
    note: null,
    capture_id: "CAPTURE-005",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const trackedOrder = {
    order_id: "ORD-TEST-005",
    user_id: "user-test-001",
    tracking_number: "TLX-TEST-005",
    product_id: "PROD001",
    product_name: "Wireless Headphones",
    merchant: "Tech Store",
    amount_cents: 7999,
    currency: "USD",
    status: "ORDER_PLACED",
    estimated_delivery: "2026-01-06T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  globalThis.fetch = (async (input) => {
    const url = String(input);

    if (url.includes("/transactions?")) {
      return new Response(JSON.stringify([transaction]), {
        status: 200,
      });
    }

    if (url.includes("/tracked_orders?")) {
      return new Response("[]", { status: 200 });
    }

    if (url.includes("/rpc/create_tracked_order_with_event")) {
      return new Response(JSON.stringify([trackedOrder]), {
        status: 200,
      });
    }

    if (url.includes("/tracking_events?")) {
      return new Response("Database unavailable.", {
        status: 500,
      });
    }

    return new Response("Unexpected request", { status: 500 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      createTrackedOrder("ORD-TEST-005", "user-test-001"),
      {
        message: "Tracking database request failed (500).",
      },
    );
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  }
});

test("lists only the requested user's tracked orders and their events", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

  const requestUrls: string[] = [];
  const trackedOrder = {
    order_id: "ORD-TEST-006",
    user_id: "user-test-006",
    tracking_number: "TLX-TEST-006",
    product_id: "PROD001",
    product_name: "Wireless Headphones",
    merchant: "Tech Store",
    amount_cents: 7999,
    currency: "USD",
    status: "PROCESSING",
    estimated_delivery: "2026-01-06T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:05:00.000Z",
  };
  const trackingEvent = {
    id: "EVENT-006",
    order_id: "ORD-TEST-006",
    status: "PROCESSING",
    title: "Order processing started",
    description: "Your order is being prepared.",
    timestamp: "2026-01-01T00:05:00.000Z",
  };

  globalThis.fetch = (async (input) => {
    const url = String(input);
    requestUrls.push(url);

    if (url.includes("/tracked_orders?")) {
      return new Response(JSON.stringify([trackedOrder]), { status: 200 });
    }

    if (url.includes("/tracking_events?")) {
      return new Response(JSON.stringify([trackingEvent]), { status: 200 });
    }

    return new Response("Unexpected request", { status: 500 });
  }) as typeof fetch;

  try {
    const orders = await getTrackedOrders("user-test-006");

    assert.equal(orders.length, 1);
    assert.equal(orders[0].orderId, "ORD-TEST-006");
    assert.equal(orders[0].status, "PROCESSING");
    assert.equal(orders[0].events[0].status, "PROCESSING");
    assert.ok(
      requestUrls[0].includes("user_id=eq.user-test-006"),
      "the tracked-orders query should be filtered by the requested user",
    );
    assert.ok(requestUrls[1].includes("order_id=eq.ORD-TEST-006"));
  } finally {
    globalThis.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  }
});
