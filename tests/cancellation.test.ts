
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyExpiry,
  applyTransition,
  cancelPending,
  EXPIRY_NOTE,
  filterByUser,
  gateCapture,
  ownsRecord,
  planCheckout,
  sweepExpired,
  withCheckoutLock,
} from "../src/lib/checkout/logic";
import { checkMutationRequest } from "../src/lib/security/request-guard";
import type { PaymentStatus } from "../src/lib/types.ts";
import type {
  NewTxRecord,
  TxPatch,
  TxRecord,
  TxStore,
} from "../src/lib/store/types.ts";

const EXPIRY_MS = 30 * 60_000;

const USER_A = "user-a-supabase-id";
const USER_B = "user-b-supabase-id";

function rec(id: string, over: Partial<TxRecord> = {}): TxRecord {
  const t = new Date().toISOString();

  return {
    orderId: id,
    productId: "hp-1",
    productName: "AeroTune",
    merchant: "SoundHub",
    amountCents: 7999,
    currency: "USD",
    limitCents: 100000,
    userId: USER_A,
    status: "awaiting_approval",
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

/** In-memory store that reuses the same pure helpers as the real file store. */
function memoryStore(
  initial: TxRecord[] = [],
): TxStore & { all: () => TxRecord[] } {
  let records = [...initial];

  return {
    kind: "file",

    all: () => records,

    async reserveCheckout(record: NewTxRecord) {
      if (records.some((r) => r.orderId === record.orderId)) {
        throw new Error("duplicate");
      }

      const committed = records
        .filter(
          (r) =>
            r.userId === record.userId &&
            ["awaiting_approval", "processing", "completed"].includes(r.status),
        )
        .reduce((sum, r) => sum + r.amountCents, 0);

      const limitCents = record.limitCents;

      if (committed + record.amountCents > limitCents) {
        return {
          reserved: false,
          message: "Spending limit exceeded.",
          currentLimitCents: limitCents,
          committedCents: committed,
        };
      }

      records = [record, ...records];

      return {
        reserved: true,
        message: "Checkout spending reserved.",
        currentLimitCents: limitCents,
        committedCents: committed + record.amountCents,
      };
    },

    async create(r: NewTxRecord) {
      if (records.some((x) => x.orderId === r.orderId)) {
        throw new Error("duplicate");
      }

      records = [r, ...records];
    },

    async get(id: string, userId: string) {
      return (
        records.find(
          (r) => r.orderId === id && r.userId === userId,
        ) ?? null
      );
    },

    async listByUser(userId: string) {
      return filterByUser(records, userId);
    },

    async transition(
      id: string,
      userId: string,
      from: PaymentStatus[],
      patch: TxPatch,
    ) {
      const r = applyTransition(
        records,
        id,
        userId,
        from,
        patch,
        new Date().toISOString(),
      );

      records = r.records;
      return r.updated;
    },

    async expireStale(before: string, note: string) {
      const r = applyExpiry(
        records,
        before,
        note,
        new Date().toISOString(),
      );

      records = r.records;
      return r.count;
    },
  };
}

const OLD = new Date(Date.now() - EXPIRY_MS - 60_000).toISOString();

test("double cancellation is idempotent", async () => {
  const store = memoryStore([rec("ORDER0001")]);

  const first = await cancelPending(store, "ORDER0001", USER_A);
  const second = await cancelPending(store, "ORDER0001", USER_A);

  assert.equal(
    first.kind === "record" && first.record.status,
    "cancelled",
  );

  assert.equal(
    second.kind === "record" && second.record.status,
    "cancelled",
  );

  assert.equal(store.all().length, 1);
});

test("cancellation after completion or during processing never changes the record", async () => {
  for (const status of [
    "completed",
    "processing",
    "failed",
  ] as PaymentStatus[]) {
    const store = memoryStore([
      rec("ORDER0001", { status, captureId: "CAP1" }),
    ]);

    const result = await cancelPending(store, "ORDER0001", USER_A);

    assert.equal(
      result.kind === "record" && result.record.status,
      status,
    );

    assert.equal(store.all()[0].status, status);
  }
});

test("cancel racing a capture claim: exactly one wins", async () => {
  for (let i = 0; i < 20; i++) {
    const store = memoryStore([rec("ORDER0001")]);

    const [cancel, claim] = await Promise.all([
      cancelPending(store, "ORDER0001", USER_A),
      store.transition(
        "ORDER0001",
        USER_A,
        ["awaiting_approval"],
        { status: "processing" },
      ),
    ]);

    const final = store.all()[0].status;

    assert.ok(final === "cancelled" || final === "processing");

    if (final === "cancelled") {
      assert.equal(claim, null);
    }

    if (final === "processing") {
      assert.equal(
        cancel.kind === "record" && cancel.record.status,
        "processing",
      );
    }
  }

  const store = memoryStore([
    rec("ORDER0001", { status: "cancelled" }),
  ]);

  assert.equal(
    await store.transition(
      "ORDER0001",
      USER_A,
      ["awaiting_approval"],
      { status: "processing" },
    ),
    null,
  );
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

  const by = Object.fromEntries(
    store.all().map((r) => [r.orderId, r]),
  );

  assert.equal(by.STALE00001.status, "cancelled");
  assert.equal(by.STALE00001.note, EXPIRY_NOTE);
  assert.equal(by.FRESH00001.status, "awaiting_approval");
  assert.equal(by.PROC000001.status, "processing");
  assert.equal(by.DONE000001.status, "completed");
  assert.equal(by.FAIL000001.status, "failed");
});

test("an expired order cannot be captured", async () => {
  const store = memoryStore([
    rec("STALE00001", { updatedAt: OLD }),
  ]);

  const gate = await gateCapture(
    store,
    "STALE00001",
    USER_A,
    EXPIRY_MS,
  );

  assert.equal(gate.action, "respond");

  assert.equal(
    gate.action === "respond" && gate.record.status,
    "cancelled",
  );

  assert.equal(store.all()[0].status, "cancelled");

  const fresh = memoryStore([rec("FRESH00001")]);

  assert.equal(
    (
      await gateCapture(
        fresh,
        "FRESH00001",
        USER_A,
        EXPIRY_MS,
      )
    ).action,
    "proceed",
  );
});

test("an expired order is not expired if capture has already claimed it", async () => {
  const store = memoryStore([
    rec("RACE000001", { updatedAt: OLD }),
  ]);

  await store.transition(
    "RACE000001",
    USER_A,
    ["awaiting_approval"],
    { status: "processing" },
  );

  const gate = await gateCapture(
    store,
    "RACE000001",
    USER_A,
    EXPIRY_MS,
  );

  assert.equal(gate.action, "proceed");
  assert.equal(store.all()[0].status, "processing");
});

test("ownership mismatch and legacy records look like unknown orders", async () => {
  const store = memoryStore([
    rec("ORDER0001"),
    rec("LEGACY0001", { userId: null }),
  ]);

  assert.equal(
    (await gateCapture(store, "ORDER0001", USER_B, EXPIRY_MS)).action,
    "not_found",
  );

  assert.equal(
    (await gateCapture(store, "LEGACY0001", USER_A, EXPIRY_MS)).action,
    "not_found",
  );

  assert.equal(
    (await cancelPending(store, "ORDER0001", USER_B)).kind,
    "not_found",
  );

  assert.equal(
    (await cancelPending(store, "LEGACY0001", USER_A)).kind,
    "not_found",
  );

  assert.equal(
    store.all().find((r) => r.orderId === "ORDER0001")?.status,
    "awaiting_approval",
  );

  assert.equal(ownsRecord(rec("X0000001"), USER_A), true);
  assert.equal(ownsRecord(rec("X0000001"), USER_B), false);
});

test("transaction history is isolated by user ID and hides legacy rows", async () => {
  const store = memoryStore([
    rec("A0000001", { userId: USER_A }),
    rec("B0000001", { userId: USER_B }),
    rec("LEGACY001", {
      userId: null,
      status: "completed",
    }),
  ]);

  assert.deepEqual(
    (await store.listByUser(USER_A)).map((r) => r.orderId),
    ["A0000001"],
  );

  assert.deepEqual(
    (await store.listByUser(USER_B)).map((r) => r.orderId),
    ["B0000001"],
  );

  assert.deepEqual(
    await store.listByUser("unknown-user"),
    [],
  );

  assert.deepEqual(
    filterByUser(await store.listByUser(USER_A), USER_B),
    [],
  );
});

test("mutation requests: content type and origin are enforced", () => {
  const url = "http://localhost:3000/api/paypal/cancel";
  const app = "http://localhost:3000";

  const h = (o: Record<string, string>) => new Headers(o);

  assert.equal(
    checkMutationRequest(
      h({
        "content-type": "application/json",
        origin: "http://localhost:3000",
      }),
      url,
      app,
    ).ok,
    true,
  );

  assert.equal(
    checkMutationRequest(
      h({ "content-type": "application/json; charset=utf-8" }),
      url,
      app,
    ).ok,
    true,
  );

  const evil = checkMutationRequest(
    h({
      "content-type": "application/json",
      origin: "https://evil.example",
    }),
    url,
    app,
  );

  assert.equal(evil.ok === false && evil.status, 403);

  assert.equal(
    checkMutationRequest(
      h({
        "content-type": "application/json",
        origin: "null",
      }),
      url,
      app,
    ).ok,
    false,
  );

  const text = checkMutationRequest(
    h({
      "content-type": "text/plain",
      origin: "http://localhost:3000",
    }),
    url,
    app,
  );

  assert.equal(text.ok === false && text.status, 415);

  assert.equal(
    checkMutationRequest(
      h({ origin: "http://localhost:3000" }),
      url,
      app,
    ).ok,
    false,
  );

  assert.equal(
    checkMutationRequest(
      h({
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      }),
      url,
      app,
    ).ok,
    false,
  );

  assert.equal(
    checkMutationRequest(
      h({
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
      }),
      url,
      app,
    ).ok,
    true,
  );

  assert.equal(
    checkMutationRequest(
      h({
        "content-type": "application/json",
        origin: "https://agentflow.example",
      }),
      "http://internal:3000/x",
      "https://agentflow.example",
    ).ok,
    true,
  );
});

test("duplicate order creation: concurrent attempts are blocked, then superseded", async () => {
  let release!: () => void;

  const gate = new Promise<void>((r) => (release = r));

  const first = withCheckoutLock("k", async () => {
    await gate;
    return 1;
  });

  const second = await withCheckoutLock("k", async () => 2);

  assert.deepEqual(second, { locked: true });

  release();

  assert.deepEqual(await first, {
    locked: false,
    value: 1,
  });

  assert.deepEqual(
    await withCheckoutLock("k", async () => 3),
    { locked: false, value: 3 },
  );

  const store = memoryStore([
    rec("OLD0000001"),
    rec("OTHERPROD1", { productId: "kb-1" }),
    rec("FOREIGN001", { userId: USER_B }),
  ]);

  const plan = await planCheckout(store, {
    userId: USER_A,
    productId: "hp-1",
    maxPending: 3,
  });

  assert.equal(plan.ok, true);

  const by = Object.fromEntries(
    store.all().map((r) => [r.orderId, r.status]),
  );

  assert.equal(by.OLD0000001, "cancelled");
  assert.equal(by.OTHERPROD1, "awaiting_approval");
  assert.equal(by.FOREIGN001, "awaiting_approval");
});

test("a same-item payment that is processing blocks a new checkout", async () => {
  const store = memoryStore([
    rec("PROC000001", { status: "processing" }),
  ]);

  const plan = await planCheckout(store, {
    userId: USER_A,
    productId: "hp-1",
    maxPending: 3,
  });

  assert.equal(plan.ok === false && plan.status, 409);
  assert.equal(store.all()[0].status, "processing");
});

test("pending orders per user are capped server-side", async () => {
  const store = memoryStore([
    rec("P0000001", { productId: "p1" }),
    rec("P0000002", { productId: "p2" }),
    rec("P0000003", { productId: "p3" }),
    rec("OTHERUSER", {
      productId: "p4",
      userId: USER_B,
    }),
  ]);

  const blocked = await planCheckout(store, {
    userId: USER_A,
    productId: "p9",
    maxPending: 3,
  });

  assert.equal(blocked.ok === false && blocked.status, 429);

  const other = await planCheckout(store, {
    userId: USER_B,
    productId: "p9",
    maxPending: 3,
  });

  assert.equal(other.ok, true);

  const done = memoryStore([
    rec("D0000001", { status: "completed" }),
    rec("D0000002", { status: "cancelled" }),
  ]);

  assert.equal(
    (
      await planCheckout(done, {
        userId: USER_A,
        productId: "p9",
        maxPending: 1,
      })
    ).ok,
    true,
  );
});

test("retry after cancellation starts fresh and the cancelled order stays uncapturable", async () => {
  const store = memoryStore([rec("CANC000001")]);

  await cancelPending(store, "CANC000001", USER_A);

  const plan = await planCheckout(store, {
    userId: USER_A,
    productId: "hp-1",
    maxPending: 3,
  });

  assert.equal(plan.ok, true);

  assert.equal(
    await store.transition(
      "CANC000001",
      USER_A,
      ["awaiting_approval"],
      { status: "processing" },
    ),
    null,
  );

  const gate = await gateCapture(
    store,
    "CANC000001",
    USER_A,
    EXPIRY_MS,
  );

  assert.equal(gate.action, "proceed");

  assert.equal(
    gate.action === "proceed" && gate.record.status,
    "cancelled",
  );
});
