import assert from "node:assert/strict";
import test from "node:test";
import {
  createPriceHistoryHandler,
  type PriceHistoryDependencies,
  type PriceHistoryPayload,
} from "../src/lib/pricing/price-history-service";

const payload: PriceHistoryPayload = {
  canonicalProductId: "product-1",
  productTitle: "Test product",
  history: [{ timestamp: "2026-11-01T00:00:00.000Z", price: 100, currency: "USD" }],
  statistics: null,
};

function deps(overrides: Partial<PriceHistoryDependencies> = {}) {
  return {
    getUser: async () => ({ id: "user-1" }),
    consumeLimit: async () => ({ allowed: true, retryAfterSeconds: 60 }),
    readCache: async () => null,
    fetchHistory: async () => payload,
    writeCache: async () => {},
    ...overrides,
  } satisfies PriceHistoryDependencies;
}

const req = (id?: string) => {
  const url = new URL("http://localhost/api/price-history");
  if (id !== undefined) url.searchParams.set("productId", id);
  return new Request(url);
};

test("401 unauthenticated response includes no-store", async () => {
  const response = await createPriceHistoryHandler(deps({ getUser: async () => null }))(req("p1"));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
});

test("400 for missing or oversized product ID", async () => {
  const handler = createPriceHistoryHandler(deps());
  assert.equal((await handler(req())).status, 400);
 assert.equal((await handler(req("x".repeat(201)))).status, 400);
});

test("cache hit avoids Channel3 but still consumes rate limit", async () => {
  let limits = 0;
  let upstream = 0;
  const handler = createPriceHistoryHandler(deps({
    consumeLimit: async () => { limits++; return { allowed: true, retryAfterSeconds: 60 }; },
    readCache: async () => payload,
    fetchHistory: async () => { upstream++; return payload; },
  }));
  const response = await handler(req("p1"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Price-History-Cache"), "HIT");
  assert.equal(limits, 1);
  assert.equal(upstream, 0);
});

test("cache miss fetches and persists actual Channel3 payload", async () => {
  let writes = 0;
  const handler = createPriceHistoryHandler(deps({
    writeCache: async (id, value) => { assert.equal(id, "p1"); assert.deepEqual(value, payload); writes++; },
  }));
  const response = await handler(req("p1"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Price-History-Cache"), "MISS");
  assert.equal(writes, 1);
});

test("429 includes Retry-After and is checked before cache", async () => {
  let cacheReads = 0;
  const handler = createPriceHistoryHandler(deps({
    consumeLimit: async () => ({ allowed: false, retryAfterSeconds: 19 }),
    readCache: async () => { cacheReads++; return payload; },
  }));
  const response = await handler(req("p1"));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "19");
  assert.equal(cacheReads, 0);
});

test("502 on Channel3 failure and does not cache failed result", async () => {
  let writes = 0;
  const handler = createPriceHistoryHandler(deps({
    fetchHistory: async () => { throw new Error("Channel3 unavailable"); },
    writeCache: async () => { writes++; },
  }));
  const response = await handler(req("p1"));
  assert.equal(response.status, 502);
  assert.equal(writes, 0);
});
