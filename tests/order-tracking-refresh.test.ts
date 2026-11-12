import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import type { TrackedOrder } from "../src/features/order-tracking/types/order.types";
import { OrderTrackingSection } from "../src/features/order-tracking/components/OrderTrackingSection";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: dom.window,
});

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: dom.window.document,
});

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  writable: true,
  value: true,
});

interface ScheduledInterval {
  handle: number;
  callback: () => void;
  delay: number | undefined;
}

const originalFetch = globalThis.fetch;
const originalSetInterval = window.setInterval;
const originalClearInterval = window.clearInterval;
const scheduledIntervals: ScheduledInterval[] = [];
const clearedIntervals: number[] = [];
let nextIntervalHandle = 1;

window.setInterval = ((callback: TimerHandler, delay?: number) => {
  const handle = nextIntervalHandle++;
  scheduledIntervals.push({
    handle,
    callback: typeof callback === "function" ? callback as () => void : () => {},
    delay,
  });
  return handle;
}) as typeof window.setInterval;

window.clearInterval = ((handle?: number) => {
  if (handle !== undefined) clearedIntervals.push(handle);
}) as typeof window.clearInterval;

function makeOrder(status: TrackedOrder["status"]): TrackedOrder {
  const timestamp = "2026-11-12T00:00:00.000Z";
  const statuses: TrackedOrder["status"][] = ["ORDER_PLACED"];

  if (status !== "ORDER_PLACED") statuses.push(status);

  return {
    orderId: "TRACK-REFRESH-001",
    trackingNumber: "TLX-REFRESH-001",
    productId: "PROD001",
    productName: "Wireless Headphones",
    merchant: "Tech Store",
    amountCents: 7999,
    currency: "USD",
    status,
    createdAt: timestamp,
    estimatedDelivery: timestamp,
    updatedAt: timestamp,
    events: statuses.map((eventStatus) => ({
      id: `event-${eventStatus}`,
      status: eventStatus,
      title: eventStatus,
      description: `${eventStatus} update`,
      timestamp,
    })),
    isSimulated: true,
  };
}

function jsonResponse(orders: TrackedOrder[]): Response {
  return {
    ok: true,
    json: async () => ({ orders }),
  } as unknown as Response;
}

function refreshInterval(): ScheduledInterval {
  const interval = scheduledIntervals[0];
  assert.ok(interval, "the component should register its refresh interval");
  return interval;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  scheduledIntervals.length = 0;
  clearedIntervals.length = 0;
  nextIntervalHandle = 1;
});

after(() => {
  window.setInterval = originalSetInterval;
  window.clearInterval = originalClearInterval;
  dom.window.close();
});

test("fetches tracked orders when the component loads", async () => {
  const order = makeOrder("ORDER_PLACED");
  const requests: Array<[RequestInfo | URL, RequestInit | undefined]> = [];

  globalThis.fetch = (async (input, init) => {
    requests.push([input, init]);
    return jsonResponse([order]);
  }) as typeof fetch;

  const view = render(createElement(OrderTrackingSection));

  await act(async () => {
    await flushPromises();
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "/api/order-tracking/my-orders");
  assert.equal(requests[0][1]?.cache, "no-store");
  assert.ok(view.getByText("Wireless Headphones"));
});

test("automatically refetches after 60 seconds", async () => {
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return jsonResponse([makeOrder("ORDER_PLACED")]);
  }) as typeof fetch;

  render(createElement(OrderTrackingSection));

  await act(async () => {
    await flushPromises();
  });

  const interval = refreshInterval();
  assert.equal(interval.delay, 60_000);
  assert.equal(requestCount, 1);

  await act(async () => {
    interval.callback();
    await flushPromises();
  });

  assert.equal(requestCount, 2);
});

test("updates the existing order card when its status changes", async () => {
  const responses = [
    jsonResponse([makeOrder("ORDER_PLACED")]),
    jsonResponse([makeOrder("PROCESSING")]),
  ];
  globalThis.fetch = (async () => {
    const response = responses.shift();
    assert.ok(response, "unexpected order tracking request");
    return response;
  }) as typeof fetch;

  const view = render(createElement(OrderTrackingSection));

  await act(async () => {
    await flushPromises();
  });

  const originalTitle = view.getByRole("heading", {
    name: "Wireless Headphones",
  });
  const originalCard = originalTitle.closest("div.rounded-xl");
  assert.ok(originalCard);
  assert.match(originalCard.textContent ?? "", /Order Placed/);

  await act(async () => {
    refreshInterval().callback();
    await flushPromises();
  });

  const updatedTitle = view.getByRole("heading", {
    name: "Wireless Headphones",
  });
  const updatedCard = updatedTitle.closest("div.rounded-xl");

  assert.strictEqual(updatedCard, originalCard);
  assert.match(updatedCard?.textContent ?? "", /Processing/);
});

test("retains the existing order card when a background refresh fails", async () => {
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;

    if (requestCount === 1) {
      return jsonResponse([makeOrder("ORDER_PLACED")]);
    }

    return {
      ok: false,
      json: async () => ({ error: "Temporary tracking error." }),
    } as unknown as Response;
  }) as typeof fetch;

  const view = render(createElement(OrderTrackingSection));

  await act(async () => {
    await flushPromises();
  });

  const originalTitle = view.getByRole("heading", {
    name: "Wireless Headphones",
  });
  const originalCard = originalTitle.closest("div.rounded-xl");
  assert.ok(originalCard);

  await act(async () => {
    refreshInterval().callback();
    await flushPromises();
  });

  const updatedTitle = view.getByRole("heading", {
    name: "Wireless Headphones",
  });

  assert.strictEqual(updatedTitle.closest("div.rounded-xl"), originalCard);
  assert.equal(view.queryByText("Loading your tracked orders..."), null);
  assert.equal(view.queryByText("Temporary tracking error."), null);
});

test("skips an interval refresh while a fetch is already in flight", async () => {
  let requestCount = 0;
  let resolveInitialRequest!: (response: Response) => void;

  globalThis.fetch = (async () => {
    requestCount += 1;

    if (requestCount === 1) {
      return new Promise<Response>((resolve) => {
        resolveInitialRequest = resolve;
      });
    }

    return jsonResponse([makeOrder("ORDER_PLACED")]);
  }) as typeof fetch;

  render(createElement(OrderTrackingSection));
  assert.equal(requestCount, 1);

  await act(async () => {
    refreshInterval().callback();
    await flushPromises();
  });

  assert.equal(requestCount, 1);

  await act(async () => {
    resolveInitialRequest(jsonResponse([makeOrder("ORDER_PLACED")]));
    await flushPromises();
  });

  await act(async () => {
    refreshInterval().callback();
    await flushPromises();
  });

  assert.equal(requestCount, 2);
});

test("clears the refresh interval when the component unmounts", async () => {
  globalThis.fetch = (async () => jsonResponse([])) as typeof fetch;

  const { unmount } = render(createElement(OrderTrackingSection));

  await act(async () => {
    await flushPromises();
  });

  const interval = refreshInterval();
  unmount();

  assert.deepEqual(clearedIntervals, [interval.handle]);
});
