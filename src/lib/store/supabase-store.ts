
import type { PaymentStatus } from "../types";
import type {
  NewTxRecord,
  TxPatch,
  TxRecord,
  TxStore,
} from "./types";

/** Supabase/PostgreSQL store via PostgREST. Server-side service-role access only. */

interface Row {
  order_id: string;
  product_id: string;
  product_name: string;
  merchant: string;
  amount_cents: number;
  currency: "USD";
  limit_cents: number;
  owner_hash: string | null;
  user_id: string | null;
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
  userId: r.user_id,
  status: r.status,
  note: r.note ?? undefined,
  captureId: r.capture_id ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function createSupabaseStore(
  url: string,
  serviceKey: string,
): TxStore {
  const base = `${url.replace(/\/+$/, "")}/rest/v1/transactions`;
  const rpcBase = `${url.replace(/\/+$/, "")}/rest/v1/rpc`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  async function request(
    query: string,
    init: RequestInit & { prefer?: string } = {},
  ): Promise<Row[]> {
    const res = await fetch(`${base}${query}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...headers,
        ...(init.prefer ? { Prefer: init.prefer } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Supabase request failed (${res.status}).`);
    }

    if (
  res.status === 204 ||
  init.prefer?.split(",").some((value) => value.trim() === "return=minimal")
) {
  return [];
}

return (await res.json()) as Row[];
  }
    async function rpcRequest<T>(
    functionName: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${rpcBase}/${functionName}`, {
      method: "POST",
      cache: "no-store",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Supabase RPC failed (${res.status}).`);
    }

    return (await res.json()) as T;
  }

  return {
    kind: "supabase",

    async reserveCheckout(record: NewTxRecord) {
      const rows = await rpcRequest<
        {
          reserved: boolean;
          message: string;
          current_limit_cents: number;
          committed_cents: number;
        }[]
      >("reserve_checkout", {
        p_user_id: record.userId,
        p_order_id: record.orderId,
        p_product_id: record.productId,
        p_product_name: record.productName,
        p_merchant: record.merchant,
        p_amount_cents: record.amountCents,
        p_currency: record.currency,
        p_note: record.note ?? "Waiting for PayPal buyer approval",
      });

      const result = rows[0];

      if (!result) {
        throw new Error("Spending reservation returned no result.");
      }

      return {
        reserved: result.reserved,
        message: result.message,
        currentLimitCents: result.current_limit_cents,
        committedCents: result.committed_cents,
      };
    },

    async create(r: NewTxRecord) {
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
          user_id: r.userId,
          status: r.status,
          note: r.note ?? null,
        }),
      });
    },

    async get(orderId: string, userId: string) {
      const rows = await request(
        `?order_id=eq.${encodeURIComponent(orderId)}` +
          `&user_id=eq.${encodeURIComponent(userId)}&select=*`,
      );

      return rows[0] ? fromRow(rows[0]) : null;
    },

    async getByOrderId(orderId: string) {
      const rows = await request(
        `?order_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
      );

      return rows[0] ? fromRow(rows[0]) : null;
    },

    async listByUser(userId: string) {
      const pageSize = 100;
      const allRows: Row[] = [];
      let offset = 0;

      while (true) {
        const rows = await request(
          `?user_id=eq.${encodeURIComponent(userId)}` +
            `&select=*&order=created_at.desc` +
            `&limit=${pageSize}&offset=${offset}`,
        );

        allRows.push(...rows);

        if (rows.length < pageSize) break;

        offset += pageSize;
      }

      return allRows.map(fromRow);
    },

    async expireStale(beforeIso: string, note: string) {
      const rows = await request(
        `?status=eq.awaiting_approval` +
          `&updated_at=lt.${encodeURIComponent(beforeIso)}`,
        {
          method: "PATCH",
          prefer: "return=representation",
          body: JSON.stringify({
            status: "cancelled",
            note,
            updated_at: new Date().toISOString(),
          }),
        },
      );

      return rows.length;
    },

    async transition(
      orderId: string,
      userId: string,
      from: PaymentStatus[],
      patch: TxPatch,
    ) {
      const rows = await request(
        `?order_id=eq.${encodeURIComponent(orderId)}` +
          `&user_id=eq.${encodeURIComponent(userId)}` +
          `&status=in.(${from.join(",")})`,
        {
          method: "PATCH",
          prefer: "return=representation",
          body: JSON.stringify({
            ...(patch.status !== undefined && {
              status: patch.status,
            }),
            ...(patch.note !== undefined && {
              note: patch.note,
            }),
            ...(patch.captureId !== undefined && {
              capture_id: patch.captureId,
            }),
            updated_at: new Date().toISOString(),
          }),
        },
      );

      return rows[0] ? fromRow(rows[0]) : null;
    },
  };
}
