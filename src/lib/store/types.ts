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
  /** SHA-256 hash of the owning browser session id. Absent on legacy records, which are never exposed. */
  ownerHash?: string;
  status: PaymentStatus;
  note?: string;
  captureId?: string;
  createdAt: string;
  updatedAt: string;
}

export type TxPatch = Partial<Pick<TxRecord, "status" | "note" | "captureId">>;

export class DuplicateOrderError extends Error {
  constructor(orderId: string) {
    super(`A transaction for order ${orderId} already exists.`);
  }
}

export interface TxStore {
  kind: "supabase" | "file";
  create(record: TxRecord): Promise<void>;
  get(orderId: string): Promise<TxRecord | null>;
  list(): Promise<TxRecord[]>;
  /** Only the given session's records. Legacy records without an owner are never returned. */
  listByOwner(ownerHash: string): Promise<TxRecord[]>;
  /**
   * Atomically cancels `awaiting_approval` records last updated before `beforeIso`.
   * Never affects any other status. Returns the number of records expired.
   */
  expireStale(beforeIso: string, note: string): Promise<number>;
  /**
   * Atomic compare-and-set: applies `patch` only if the current status is in `from`.
   * Returns the updated record, or null if the precondition failed (e.g. already claimed).
   * This is what prevents duplicate captures.
   */
  transition(orderId: string, from: PaymentStatus[], patch: TxPatch): Promise<TxRecord | null>;
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

/** Cents already spent or in flight (completed + processing), optionally excluding one order. */
export function committedCents(records: TxRecord[], excludeOrderId?: string): number {
  return records
    .filter((r) => r.orderId !== excludeOrderId && (r.status === "completed" || r.status === "processing"))
    .reduce((sum, r) => sum + r.amountCents, 0);
}
