import assert from "node:assert/strict";
import { test } from "node:test";
import { ownsRecord } from "../src/lib/checkout/logic.ts";
import {
  buildReceipt,
  InvalidReceiptStatusError,
  MissingCaptureIdError,
} from "../src/lib/receipt/generator.ts";
import { hashSessionId, newSessionId, readSession, sessionCookieHeader, SESSION_COOKIE } from "../src/lib/security/session.ts";
import type { PaymentStatus } from "../src/lib/types.ts";
import type { TxRecord } from "../src/lib/store/types.ts";

const OWNER_A = hashSessionId("a".repeat(43));
const OWNER_B = hashSessionId("b".repeat(43));

function mockRecord(overrides: Partial<TxRecord> = {}): TxRecord {
  return {
    orderId: "5O190127TN364715T",
    captureId: "3C679366HH252554X",
    productId: "hp-1",
    productName: "AeroTune Wireless Headphones",
    merchant: "SoundHub",
    amountCents: 7999,
    currency: "USD",
    limitCents: 100000,
    ownerHash: OWNER_A,
    status: "completed",
    note: "Payment captured and verified with PayPal Sandbox.",
    createdAt: "2026-11-09T10:00:00.000Z",
    updatedAt: "2026-11-09T10:05:00.000Z",
    ...overrides,
  };
}

test("buildReceipt: successfully generates receipt for completed verified transaction", () => {
  const rec = mockRecord();
  const receipt = buildReceipt(rec, "sandbox");

  assert.equal(receipt.status, "completed");
  assert.equal(receipt.orderId, "5O190127TN364715T");
  assert.equal(receipt.captureId, "3C679366HH252554X");
  assert.equal(receipt.receiptNumber, "REC-N364715T-52554X");
  assert.equal(receipt.amount, 79.99);
  assert.equal(receipt.currency, "USD");
  assert.equal(receipt.paymentMethod, "PayPal Sandbox");
  assert.equal(receipt.environment, "sandbox");
  assert.equal(receipt.createdAt, "2026-11-09T10:00:00.000Z");
  assert.equal(receipt.completedAt, "2026-11-09T10:05:00.000Z");
  assert.equal(receipt.item.productId, "hp-1");
  assert.equal(receipt.item.productName, "AeroTune Wireless Headphones");
  assert.equal(receipt.item.merchant, "SoundHub");
  assert.equal(receipt.item.amount, 79.99);
  assert.equal(receipt.note, "Payment captured and verified with PayPal Sandbox.");

  // Sensitive internal fields must not be exposed
  assert.equal("ownerHash" in receipt, false);
  assert.equal("limitCents" in receipt, false);
});

test("buildReceipt: rejects non-completed statuses", () => {
  const nonCompletedStatuses: PaymentStatus[] = [
    "not_started",
    "awaiting_approval",
    "processing",
    "failed",
    "cancelled",
  ];

  for (const status of nonCompletedStatuses) {
    const rec = mockRecord({ status });
    assert.throws(
      () => buildReceipt(rec),
      (err: unknown) => {
        assert(err instanceof InvalidReceiptStatusError);
        assert.match(err.message, new RegExp(status));
        return true;
      },
      `Expected error for status ${status}`
    );
  }
});

test("buildReceipt: rejects missing or empty captureId", () => {
  const recWithoutCapture = mockRecord({ captureId: undefined });
  assert.throws(
    () => buildReceipt(recWithoutCapture),
    (err: unknown) => {
      assert(err instanceof MissingCaptureIdError);
      assert.match(err.message, /missing verified PayPal capture ID/);
      return true;
    }
  );

  const recWithEmptyCapture = mockRecord({ captureId: "" });
  assert.throws(
    () => buildReceipt(recWithEmptyCapture),
    (err: unknown) => {
      assert(err instanceof MissingCaptureIdError);
      return true;
    }
  );
});

test("buildReceipt: accurately identifies Sandbox vs Live environment", () => {
  const rec = mockRecord();

  const sandboxReceipt = buildReceipt(rec, "sandbox");
  assert.equal(sandboxReceipt.environment, "sandbox");
  assert.equal(sandboxReceipt.paymentMethod, "PayPal Sandbox");

  const defaultReceipt = buildReceipt(rec, undefined);
  assert.equal(defaultReceipt.environment, "sandbox");
  assert.equal(defaultReceipt.paymentMethod, "PayPal Sandbox");

  const liveReceipt = buildReceipt(rec, "live");
  assert.equal(liveReceipt.environment, "live");
  assert.equal(liveReceipt.paymentMethod, "PayPal");
});

test("buildReceipt: converts integer cents accurately to decimal amount", () => {
  const rec1 = mockRecord({ amountCents: 1 });
  assert.equal(buildReceipt(rec1).amount, 0.01);

  const rec2 = mockRecord({ amountCents: 15000 });
  assert.equal(buildReceipt(rec2).amount, 150.0);

  const rec3 = mockRecord({ amountCents: 123456 });
  assert.equal(buildReceipt(rec3).amount, 1234.56);
});

test("security: ownsRecord prevents cross-user access and handles missing sessions", () => {
  const rec = mockRecord({ ownerHash: OWNER_A });

  // Matching session
  assert.equal(ownsRecord(rec, OWNER_A), true);

  // Cross-user session
  assert.equal(ownsRecord(rec, OWNER_B), false);

  // Missing session
  assert.equal(ownsRecord(rec, null), false);
  assert.equal(ownsRecord(rec, undefined), false);
  assert.equal(ownsRecord(rec, ""), false);

  // Legacy record without ownerHash
  const legacyRec = mockRecord({ ownerHash: undefined });
  assert.equal(ownsRecord(legacyRec, OWNER_A), false);
});

test("security: session parsing from cookie header for receipt requests", () => {
  const sid = newSessionId();
  const cookieHeader = sessionCookieHeader(sid, false);

  const session = readSession(cookieHeader);
  assert.ok(session);
  assert.equal(session.id, sid);
  assert.equal(session.hash, hashSessionId(sid));

  // Invalid cookie format
  assert.equal(readSession(`${SESSION_COOKIE}=invalid-short`), null);
  assert.equal(readSession(null), null);
  assert.equal(readSession("other_cookie=value"), null);
});

test("validation: orderId regex accepts valid PayPal IDs and rejects path traversal or invalid characters", () => {
  const ORDER_ID_REGEX = /^[A-Za-z0-9-]{8,40}$/;

  assert.equal(ORDER_ID_REGEX.test("5O190127TN364715T"), true);
  assert.equal(ORDER_ID_REGEX.test("ORD-1234-5678"), true);
  assert.equal(ORDER_ID_REGEX.test("ABCDEFGH"), true);

  // Invalid or malicious inputs
  assert.equal(ORDER_ID_REGEX.test("../traversal"), false);
  assert.equal(ORDER_ID_REGEX.test("short"), false);
  assert.equal(ORDER_ID_REGEX.test(""), false);
  assert.equal(ORDER_ID_REGEX.test("<script>"), false);
  assert.equal(ORDER_ID_REGEX.test("order id with spaces"), false);
});
