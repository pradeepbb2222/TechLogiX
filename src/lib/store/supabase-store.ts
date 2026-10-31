import type { PaymentStatus } from "../types";
import type { TxPatch, TxRecord, TxStore } from "./types";

/** Supabase/PostgreSQL store via PostgREST. Uses the service-role key, server-side only. See supabase/schema.sql. */

interface Row {
  order_id: string;
  product_id: string;
  product_name: string;
  merchant: string;
  amount_cents: number;
  currency: "USD";
  limit_cents: number;
  owner_hash: string | null;
  status: PaymentStatus;
  note: string | null;
  capture_id: string | null;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: Row): TxRecord => ({
  orderId: r.order_id,
  productId: r.product_id,
  productName: r.product_name,
  merchant: r.merchant,
  amountCents: r.amount_cents,
  currency: r.currency,
  limitCents: r.limit_cents,
  ownerHash: r.owner_hash ?? undefined,
  status: r.status,
  note: r.note ?? undefined,
  captureId: r.capture_id ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function createSupabaseStore(url: string, serviceKey: string): TxStore {
  const base = `${url.replace(/\/+$/, "")}/rest/v1/transactions`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

  async function request(query: string, init: RequestInit & { prefer?: string } = {}): Promise<Row[]> {
    const res = await fetch(`${base}${query}`, {
      ...init,
      cache: "no-store",
      headers: { ...headers, ...(init.prefer ? { Prefer: init.prefer } : {}) },
    });
    if (!res.ok) throw new Error(`Supabase request failed (${res.status}).`);
    return res.status === 204 ? [] : ((await res.json()) as Row[]);
  }

  return {
    kind: "supabase",
    async create(r) {
      await request("", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify({
          order_id: r.orderId,
          product_id: r.productId,
          product_name: r.productName,
          merchant: r.merchant,
          amount_cents: r.amountCents,
          currency: r.currency,
          limit_cents: r.limitCents,
          owner_hash: r.ownerHash ?? null,
          status: r.status,
          note: r.note ?? null,
        }),
      });
    },
    async get(orderId) {
      const rows = await request(`?order_id=eq.${encodeURIComponent(orderId)}&select=*`);
      return rows[0] ? fromRow(rows[0]) : null;
    },
    async list() {
      return (await request("?select=*&order=created_at.desc&limit=100")).map(fromRow);
    },
    async listByOwner(ownerHash) {
      // Ownerless (legacy) rows can never match an eq filter on a real hash.
      return (await request(`?owner_hash=eq.${encodeURIComponent(ownerHash)}&select=*&order=created_at.desc&limit=100`)).map(fromRow);
    },
    async expireStale(beforeIso, note) {
      // Single conditional UPDATE restricted to awaiting_approval: other statuses can never match.
      const rows = await request(`?status=eq.awaiting_approval&updated_at=lt.${encodeURIComponent(beforeIso)}`, {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({ status: "cancelled", note, updated_at: new Date().toISOString() }),
      });
      return rows.length;
    },
    async transition(orderId: string, from: PaymentStatus[], patch: TxPatch) {
      // Single conditional UPDATE: only one concurrent caller can match the status filter.
      const rows = await request(`?order_id=eq.${encodeURIComponent(orderId)}&status=in.(${from.join(",")})`, {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.note !== undefined && { note: patch.note }),
          ...(patch.captureId !== undefined && { capture_id: patch.captureId }),
          updated_at: new Date().toISOString(),
        }),
      });
      return rows[0] ? fromRow(rows[0]) : null;
    },
  };
}
