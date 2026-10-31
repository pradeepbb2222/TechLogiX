import { connection, NextResponse } from "next/server";
import { sweepExpired } from "@/lib/checkout/logic";
import { getOrderExpiryMs } from "@/lib/paypal/config";
import { sessionFromRequest } from "@/lib/paypal/http";
import { getStore } from "@/lib/store";
import { toTransaction } from "@/lib/store/types";

/** Persisted transaction history for the caller's own browser session only. */
export async function GET(request: Request) {
  await connection(); // always dynamic: never prerendered or cached
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ transactions: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const store = getStore();
    await sweepExpired(store, getOrderExpiryMs());
    const records = await store.listByOwner(session.hash);
    return NextResponse.json({ transactions: records.map(toTransaction) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ transactions: [], error: "Could not load transactions." }, { status: 500 });
  }
}
