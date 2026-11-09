import type { TxRecord } from "../store/types";
import type { Receipt } from "./types";

export class InvalidReceiptStatusError extends Error {
  constructor(status: string) {
    super(`Cannot generate receipt for transaction with status '${status}'. Receipts are only available for completed transactions.`);
    this.name = "InvalidReceiptStatusError";
  }
}

export class MissingCaptureIdError extends Error {
  constructor(orderId: string) {
    super(`Cannot generate receipt for order '${orderId}': missing verified PayPal capture ID.`);
    this.name = "MissingCaptureIdError";
  }
}

export function buildReceipt(record: TxRecord, env = process.env.PAYPAL_ENV): Receipt {
  if (record.status !== "completed") {
    throw new InvalidReceiptStatusError(record.status);
  }

  if (!record.captureId) {
    throw new MissingCaptureIdError(record.orderId);
  }

  const isLive = env?.trim().toLowerCase() === "live";
  const amount = record.amountCents / 100;

  return {
    receiptNumber: `REC-${record.orderId.slice(-8).toUpperCase()}-${record.captureId.slice(-6).toUpperCase()}`,
    orderId: record.orderId,
    captureId: record.captureId,
    status: "completed",
    item: {
      productId: record.productId,
      productName: record.productName,
      merchant: record.merchant,
      amount,
      currency: record.currency,
    },
    amount,
    currency: record.currency,
    paymentMethod: isLive ? "PayPal" : "PayPal Sandbox",
    environment: isLive ? "live" : "sandbox",
    createdAt: record.createdAt,
    completedAt: record.updatedAt,
    note: record.note,
  };
}
