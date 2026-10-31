import assert from "node:assert/strict";
import { test } from "node:test";
import { isStale, retry, settleOutcome, STALE_PROCESSING_MS } from "../src/lib/paypal/reconcile.ts";
import { classifyOrder, type PayPalOrder } from "../src/lib/paypal/verify.ts";
import type { TxPatch, TxRecord, TxStore } from "../src/lib/store/types.ts";

const expected = { orderId: "ORD123456789", amountCents: 7999, currency: "USD" };
const order = (status: string, captures?: { id: string; status: string; value?: string; cur?: string }[]): PayPalOrder => ({
  id: "ORD123456789",
  status,
  purchase_units: [
    { payments: { captures: captures?.map((c) => ({ id: c.id, status: c.status, amount: { currency_code: c.cur ?? "USD", value: c.value ?? "79.99" } })) } },
  ],
});

function memoryStore(initial: Partial<TxRecord> = {}): TxStore & { rec: TxRecord } {
  const rec: TxRecord = {
    orderId: "ORD123456789", productId: "hp-1", productName: "AeroTune", merchant: "SoundHub", amountCents: 7999,
    currency: "USD", limitCents: 100000, status: "processing", createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z", ...initial,
  };
  return {
    rec,
    kind: "file",
    async create() {},
    async get() { return { ...rec }; },
    async list() { return [{ ...rec }]; },
    async transition(_id, from, patch: TxPatch) {
      if (!from.includes(rec.status)) return null;
      Object.assign(rec, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), { updatedAt: new Date().toISOString() });
      return { ...rec };
    },
  };
}

test("classify: verified completed capture", () => {
  assert.deepEqual(classifyOrder(order("COMPLETED", [{ id: "C1", status: "COMPLETED" }]), expected), { kind: "completed", captureId: "C1" });
});

test("classify: PENDING capture is pending, not failed", () => {
  const o = classifyOrder(order("COMPLETED", [{ id: "C1", status: "PENDING" }]), expected);
  assert.equal(o.kind, "pending");
});

test("classify: approved order without capture is not_captured", () => {
  assert.equal(classifyOrder(order("APPROVED"), expected).kind, "not_captured");
  assert.equal(classifyOrder(order("APPROVED", []), expected).kind, "not_captured");
});

test("classify: amount/currency mismatch is never completed", () => {
  assert.equal(classifyOrder(order("COMPLETED", [{ id: "C1", status: "COMPLETED", value: "1.00" }]), expected).kind, "failed");
  assert.equal(classifyOrder(order("COMPLETED", [{ id: "C1", status: "COMPLETED", cur: "EUR" }]), expected).kind, "failed");
});

test("classify: declined capture is failed; odd data is unknown", () => {
  assert.equal(classifyOrder(order("COMPLETED", [{ id: "C1", status: "DECLINED" }]), expected).kind, "failed");
  assert.equal(classifyOrder(order("COMPLETED"), expected).kind, "unknown");
  assert.equal(classifyOrder(order("COMPLETED", [{ id: "C1", status: "REFUNDED" }]), expected).kind, "unknown");
  assert.equal(classifyOrder({ ...order("APPROVED"), id: "OTHER" }, expected).kind, "unknown");
});

test("settle: completed saves capture id and completes once", async () => {
  const store = memoryStore();
  const r = await settleOutcome(store, store.rec, { kind: "completed", captureId: "C1" }, { allowRelease: true });
  assert.equal(r.status, "completed");
  assert.equal(r.captureId, "C1");
  // A second concurrent settle cannot change a final record.
  const again = await settleOutcome(store, store.rec, { kind: "failed", reason: "x" }, { allowRelease: true });
  assert.equal(again.status, "completed");
});

test("settle: pending and unknown stay processing and keep the capture id", async () => {
  const store = memoryStore();
  const p = await settleOutcome(store, store.rec, { kind: "pending", captureId: "C9", reason: "p" }, { allowRelease: true });
  assert.equal(p.status, "processing");
  assert.equal(p.captureId, "C9");
  const u = await settleOutcome(store, store.rec, { kind: "unknown", reason: "boom" }, { allowRelease: true });
  assert.equal(u.status, "processing");
  assert.equal(u.captureId, "C9"); // not erased by a later note-only update
  assert.match(u.note ?? "", /being verified/);
});

test("settle: not_captured releases the claim only when allowed", async () => {
  const kept = memoryStore();
  assert.equal((await settleOutcome(kept, kept.rec, { kind: "not_captured" }, { allowRelease: false })).status, "processing");
  const released = memoryStore();
  assert.equal((await settleOutcome(released, released.rec, { kind: "not_captured" }, { allowRelease: true })).status, "awaiting_approval");
});

test("stale detection and retry", async () => {
  const now = Date.parse("2026-01-01T00:10:00.000Z");
  assert.equal(isStale({ updatedAt: new Date(now - STALE_PROCESSING_MS - 1).toISOString() } as TxRecord, now), true);
  assert.equal(isStale({ updatedAt: new Date(now - 1000).toISOString() } as TxRecord, now), false);

  let calls = 0;
  const v = await retry(async () => { if (++calls < 3) throw new Error("x"); return "ok"; }, 3, 1);
  assert.equal(v, "ok");
  await assert.rejects(retry(async () => { throw new Error("always"); }, 2, 1));
});
