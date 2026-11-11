
import type { PaymentStatus, Transaction } from "../types";

/** Server-side transaction record. Amounts are integer cents. */
export interface TxRecord {
  orderId: string;
  productId: string;
  productName: string;
  merchant: string;
  amountCents: number;
  currency: "USD";
  limitCents: number;

  /** Null only for legacy transactions created before authenticated ownership. */
  userId: string | null;

  status: PaymentStatus;
  note?: string;
  captureId?: string;
  createdAt: string;
  updatedAt: string;
}

/** New transactions must always belong to an authenticated user. */
export type NewTxRecord = Omit<TxRecord, "userId"> & {
  userId: string;
};

export type TxPatch = Partial<
  Pick<TxRecord, "status" | "note" | "captureId">
>;

export class DuplicateOrderError extends Error {
  constructor(orderId: string) {
    super(`A transaction for order ${orderId} already exists.`);
  }
}

export interface TxStore {
    reserveCheckout(
    record: NewTxRecord,
  ): Promise<{
    reserved: boolean;
    message: string;
    currentLimitCents: number;
    committedCents: number;
  }>;
  kind: "supabase" | "file";

  create(record: NewTxRecord): Promise<void>;

  /** Retrieves an order only if it belongs to the specified user. */
  get(orderId: string, userId: string): Promise<TxRecord | null>;

  /** Server-only lookup by PayPal order ID. */
  getByOrderId(orderId: string): Promise<TxRecord | null>;

  /** Returns every transaction belonging to the specified user. */
  listByUser(userId: string): Promise<TxRecord[]>;

  /**
   * Atomically cancels stale pending records.
   * This is a server-only global maintenance operation.
   */
  expireStale(beforeIso: string, note: string): Promise<number>;

  /**
   * Atomic, user-scoped compare-and-set.
   * Updates only if the order belongs to userId and its status matches.
   */
  transition(
    orderId: string,
    userId: string,
    from: PaymentStatus[],
    patch: TxPatch,
  ): Promise<TxRecord | null>;
}

export function toTransaction(r: TxRecord): Transaction {
  return {
    id: r.orderId,
    productName: r.productName,
    merchant: r.merchant,
    amount: r.amountCents / 100,
    currency: r.currency,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt,
  };
}

/** Cents spent or reserved (awaiting approval + processing + completed), excluding an optional order. */
export function committedCents(
  records: TxRecord[],
  excludeOrderId?: string,
): number {
  return records
    .filter(
      (r) =>
        r.orderId !== excludeOrderId &&
        (
          r.status === "awaiting_approval" ||
          r.status === "processing" ||
          r.status === "completed"
        ),
    )
    .reduce((sum, r) => sum + r.amountCents, 0);
}
