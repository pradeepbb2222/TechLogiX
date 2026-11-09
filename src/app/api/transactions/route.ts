
import { connection, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { sweepExpired } from "@/lib/checkout/logic";
import { getOrderExpiryMs } from "@/lib/paypal/config";
import { getStore } from "@/lib/store";
import { toTransaction } from "@/lib/store/types";

/** Returns persisted transactions belonging only to the authenticated user. */
export async function GET() {
  await connection(); // Always dynamic: never prerendered or cached.

  const headers = {
    "Cache-Control": "no-store",
  };

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { transactions: [], error: "Authentication required." },
      { status: 401, headers },
    );
  }

  try {
    const store = getStore();

    // Run expiry maintenance, then retrieve only this user's transactions.
    await sweepExpired(store, getOrderExpiryMs());

    const records = await store.listByUser(user.id);

    return NextResponse.json(
      { transactions: records.map(toTransaction) },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { transactions: [], error: "Could not load transactions." },
      { status: 500, headers },
    );
  }
}
