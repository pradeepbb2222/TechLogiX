import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyExpiry,
  applyTransition,
  cancelPending,
  EXPIRY_NOTE,
  filterByOwner,
  gateCapture,
  ownsRecord,
  planCheckout,
  sweepExpired,
  withCheckoutLock,
} from "../src/lib/checkout/logic.ts";
import { checkMutationRequest } from "../src/lib/security/request-guard.ts";
import { hashSessionId, newSessionId, readSession, sessionCookieHeader, SESSION_COOKIE } from "../src/lib/security/session.ts";
import type { PaymentStatus } from "../src/lib/types.ts";
import type { TxPatch, TxRecord, TxStore } from "../src/lib/store/types.ts";

const EXPIRY_MS = 30 * 60_000;
const OWNER_A = hashSessionId("a".repeat(43));
const OWNER_B = hashSessionId("b".repeat(43));

function rec(id: string, over: Partial<TxRecord> = {}): TxRecord {
  const t = new Date().toISOString();
  return {
    orderId: id, productId: "hp-1", productName: "AeroTune", merchant: "SoundHub", amountCents: 7999, currency: "USD",
    limitCents: 100000, ownerHash: OWNER_A, status: "awaiting_approval", createdAt: t, updatedAt: t, ...over,
  };
}

/** In-memory store that reuses the same pure helpers as the real file store. */
function memoryStore(initial: TxRecord[] = []): TxStore & { all: () => TxRecord[] } {
  let records = [...initial];
  return {
    kind: "file",
    all: () => records,
    async create(r) {
      if (records.some((x) => x.orderId === r.orderId)) throw new Error("duplicate");
      records = [r, ...records];
    },
    async get(id) { return records.find((r) => r.orderId === id) ?? null; },
    async list() { return records; },
    async listByOwner(h) { return filterByOwner(records, h); },
    async transition(id, from: PaymentStatus[], patch: TxPatch) {
      const r = applyTransition(records, id, from, patch, new Date().toISOString());
      records = r.records;
      return r.updated;
    },
    async expireStale(before, note) {
      const r = applyExpiry(records, before, note, new Date().toISOString());
      records = r.records;
      return r.count;
    },
  };
}

const OLD = new Date(Date.now() - EXPIRY_MS - 60_000).toISOString();

test("double cancellation is idempotent", async () => {
  const store = memoryStore([rec("ORDER0001")]);
  const first = await cancelPending(store, "ORDER0001", OWNER_A);
  const second = await cancelPending(store, "ORDER0001", OWNER_A);
  assert.equal(first.kind === "record" && first.record.status, "cancelled");
  assert.equal(second.kind === "record" && second.record.status, "cancelled");
  assert.equal(store.all().length, 1);
});

test("cancellation after completion or during processing never changes the record", async () => {
  for (const status of ["completed", "processing", "failed"] as PaymentStatus[]) {
    const store = memoryStore([rec("ORDER0001", { status, captureId: "CAP1" })]);
    const r = await cancelPending(store, "ORDER0001", OWNER_A);
    assert.equal(r.kind === "record" && r.record.status, status);
    assert.equal(store.all()[0].status, status);
  }
});

test("cancel racing a capture claim: exactly one wins and a cancelled order is never captured", async () => {
  for (let i = 0; i < 20; i++) {
    const store = memoryStore([rec("ORDER0001")]);
    const [cancel, claim] = await Promise.all([
      cancelPending(store, "ORDER0001", OWNER_A),
      store.transition("ORDER0001", ["awaiting_approval"], { status: "processing" }),
    ]);
    const final = store.all()[0].status;
    assert.ok(final === "cancelled" || final === "processing");
    if (final === "cancelled") assert.equal(claim, null); // capture could not claim: no PayPal call
    if (final === "processing") assert.equal(cancel.kind === "record" && cancel.record.status, "processing");
  }
  // After cancellation the claim is impossible.
  const store = memoryStore([rec("ORDER0001", { status: "cancelled" })]);
  assert.equal(await store.transition("ORDER0001", ["awaiting_approval"], { status: "processing" }), null);
});

test("stale awaiting_approval records expire; fresh and non-pending ones do not", async () => {
  const store = memoryStore([
    rec("STALE00001", { updatedAt: OLD }),
    rec("FRESH00001"),
    rec("PROC000001", { status: "processing", updatedAt: OLD }),
    rec("DONE000001", { status: "completed", updatedAt: OLD }),
    rec("FAIL000001", { status: "failed", updatedAt: OLD }),
  ]);
  const count = await sweepExpired(store, EXPIRY_MS);
  assert.equal(count, 1);
  const by = Object.fromEntries(store.all().map((r) => [r.orderId, r]));
  assert.equal(by.STALE00001.status, "cancelled");
  assert.equal(by.STALE00001.note, EXPIRY_NOTE);
  assert.equal(by.FRESH00001.status, "awaiting_approval");
  assert.equal(by.PROC000001.status, "processing"); // never expired by this mechanism
  assert.equal(by.DONE000001.status, "completed");
  assert.equal(by.FAIL000001.status, "failed");
});

test("an expired order cannot be captured: the gate cancels it and says respond", async () => {
  const store = memoryStore([rec("STALE00001", { updatedAt: OLD })]);
  const gate = await gateCapture(store, "STALE00001", OWNER_A, EXPIRY_MS);
  assert.equal(gate.action, "respond");
  assert.equal(gate.action === "respond" && gate.record.status, "cancelled");
  assert.equal(store.all()[0].status, "cancelled");

  const ok = memoryStore([rec("FRESH00001")]);
  assert.equal((await gateCapture(ok, "FRESH00001", OWNER_A, EXPIRY_MS)).action, "proceed");
});

test("an expired order is not expired if a capture already claimed it", async () => {
  const store = memoryStore([rec("RACE000001", { updatedAt: OLD })]);
  await store.transition("RACE000001", ["awaiting_approval"], { status: "processing" });
  const gate = await gateCapture(store, "RACE000001", OWNER_A, EXPIRY_MS);
  assert.equal(gate.action, "proceed"); // processing is not subject to expiry
  assert.equal(store.all()[0].status, "processing");
});

test("ownership mismatch, missing session and legacy records look like unknown orders", async () => {
  const store = memoryStore([rec("ORDER0001"), rec("LEGACY0001", { ownerHash: undefined })]);
  assert.equal((await gateCapture(store, "ORDER0001", OWNER_B, EXPIRY_MS)).action, "not_found");
  assert.equal((await gateCapture(store, "ORDER0001", undefined, EXPIRY_MS)).action, "not_found");
  assert.equal((await gateCapture(store, "LEGACY0001", OWNER_A, EXPIRY_MS)).action, "not_found");
  assert.equal((await cancelPending(store, "ORDER0001", OWNER_B)).kind, "not_found");
  assert.equal((await cancelPending(store, "LEGACY0001", OWNER_A)).kind, "not_found");
  assert.equal(store.all().find((r) => r.orderId === "ORDER0001")?.status, "awaiting_approval"); // untouched
  assert.equal(ownsRecord(rec("X0000001"), OWNER_A), true);
  assert.equal(ownsRecord(rec("X0000001"), OWNER_B), false);
});

test("transaction history is isolated per session and hides legacy rows", async () => {
  const store = memoryStore([
    rec("A0000001", { ownerHash: OWNER_A }),
    rec("B0000001", { ownerHash: OWNER_B }),
    rec("LEGACY001", { ownerHash: undefined, status: "completed" }),
  ]);
  assert.deepEqual((await store.listByOwner(OWNER_A)).map((r) => r.orderId), ["A0000001"]);
  assert.deepEqual((await store.listByOwner(OWNER_B)).map((r) => r.orderId), ["B0000001"]);
  assert.deepEqual(await store.listByOwner(""), []);
  assert.deepEqual(filterByOwner(await store.list(), undefined), []);
});

test("mutation requests: content type and origin are enforced", () => {
  const url = "http://localhost:3000/api/paypal/cancel";
  const app = "http://localhost:3000";
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(checkMutationRequest(h({ "content-type": "application/json", origin: "http://localhost:3000" }), url, app).ok, true);
  assert.equal(checkMutationRequest(h({ "content-type": "application/json; charset=utf-8" }), url, app).ok, true); // curl/no origin
  const evil = checkMutationRequest(h({ "content-type": "application/json", origin: "https://evil.example" }), url, app);
  assert.equal(evil.ok === false && evil.status, 403);
  assert.equal(checkMutationRequest(h({ "content-type": "application/json", origin: "null" }), url, app).ok, false);
  const text = checkMutationRequest(h({ "content-type": "text/plain", origin: "http://localhost:3000" }), url, app);
  assert.equal(text.ok === false && text.status, 415);
  assert.equal(checkMutationRequest(h({ origin: "http://localhost:3000" }), url, app).ok, false);
  assert.equal(checkMutationRequest(h({ "content-type": "application/json", "sec-fetch-site": "cross-site" }), url, app).ok, false);
  assert.equal(checkMutationRequest(h({ "content-type": "application/json", "sec-fetch-site": "same-origin" }), url, app).ok, true);
  // Deployed origin configured via APP_URL.
  assert.equal(checkMutationRequest(h({ "content-type": "application/json", origin: "https://agentflow.example" }), "http://internal:3000/x", "https://agentflow.example").ok, true);
});

test("session ids are random, hashed, parsed strictly and cookies are HttpOnly", () => {
  const a = newSessionId();
  assert.equal(a.length, 43);
  assert.notEqual(a, newSessionId());
  assert.notEqual(hashSessionId(a), a);
  assert.equal(readSession(`foo=1; ${SESSION_COOKIE}=${a}`)?.id, a);
  assert.equal(readSession(`${SESSION_COOKIE}=short`), null);
  assert.equal(readSession(null), null);
  const c = sessionCookieHeader(a, true);
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /; Secure/);
  assert.doesNotMatch(sessionCookieHeader(a, false), /Secure/);
});

test("duplicate order creation: concurrent attempts are blocked, then superseded", async () => {
  // Concurrent double click: second call is rejected while the first runs.
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const first = withCheckoutLock("k", async () => { await gate; return 1; });
  const second = await withCheckoutLock("k", async () => 2);
  assert.deepEqual(second, { locked: true });
  release();
  assert.deepEqual(await first, { locked: false, value: 1 });
  assert.deepEqual(await withCheckoutLock("k", async () => 3), { locked: false, value: 3 }); // lock released

  // Sequential duplicate: the earlier pending order for the same item is cancelled, others untouched.
  const store = memoryStore([
    rec("OLD0000001"),
    rec("OTHERPROD1", { productId: "kb-1" }),
    rec("FOREIGN001", { ownerHash: OWNER_B }),
  ]);
  const plan = await planCheckout(store, { ownerHash: OWNER_A, productId: "hp-1", maxPending: 3 });
  assert.equal(plan.ok, true);
  const by = Object.fromEntries(store.all().map((r) => [r.orderId, r.status]));
  assert.equal(by.OLD0000001, "cancelled");
  assert.equal(by.OTHERPROD1, "awaiting_approval");
  assert.equal(by.FOREIGN001, "awaiting_approval"); // another session is never touched
});

test("a same-item payment that is processing blocks a new checkout", async () => {
  const store = memoryStore([rec("PROC000001", { status: "processing" })]);
  const plan = await planCheckout(store, { ownerHash: OWNER_A, productId: "hp-1", maxPending: 3 });
  assert.equal(plan.ok === false && plan.status, 409);
  assert.equal(store.all()[0].status, "processing");
});

test("pending orders per session are capped server-side", async () => {
  const store = memoryStore([
    rec("P0000001", { productId: "p1" }), rec("P0000002", { productId: "p2" }), rec("P0000003", { productId: "p3" }),
    rec("OTHERSESS", { productId: "p4", ownerHash: OWNER_B }),
  ]);
  const blocked = await planCheckout(store, { ownerHash: OWNER_A, productId: "p9", maxPending: 3 });
  assert.equal(blocked.ok === false && blocked.status, 429);
  const other = await planCheckout(store, { ownerHash: OWNER_B, productId: "p9", maxPending: 3 });
  assert.equal(other.ok, true); // B has only one pending
  // Completed/cancelled orders do not count as pending.
  const done = memoryStore([rec("D0000001", { status: "completed" }), rec("D0000002", { status: "cancelled" })]);
  assert.equal((await planCheckout(done, { ownerHash: OWNER_A, productId: "p9", maxPending: 1 })).ok, true);
});

test("retry after cancellation starts fresh and the cancelled order stays uncapturable", async () => {
  const store = memoryStore([rec("CANC000001")]);
  await cancelPending(store, "CANC000001", OWNER_A);
  const plan = await planCheckout(store, { ownerHash: OWNER_A, productId: "hp-1", maxPending: 3 });
  assert.equal(plan.ok, true); // cancelled order is neither pending nor processing
  // A new order would get a new id; the old one can never be claimed for capture.
  assert.equal(await store.transition("CANC000001", ["awaiting_approval"], { status: "processing" }), null);
  const gate = await gateCapture(store, "CANC000001", OWNER_A, EXPIRY_MS);
  assert.equal(gate.action, "proceed"); // route then returns the final cancelled record without calling PayPal
  assert.equal(gate.action === "proceed" && gate.record.status, "cancelled");
});
