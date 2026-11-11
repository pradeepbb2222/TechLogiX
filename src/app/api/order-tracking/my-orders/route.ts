import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getStore } from "@/lib/store";
import {
  createTrackedOrder,
  getTrackedOrders,
} from "@/features/order-tracking/services/trackingStorage";

export async function GET() {
  const user = await getAuthenticatedUser();
  try {

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    // Fetch existing tracking records for this user.
    let orders = await getTrackedOrders(user.id);
    const trackedOrderIds = new Set(
      orders.map((order) => order.orderId),
    );

    // Recover tracking for completed payments that are missing it.
    const transactions = await getStore().listByUser(user.id);

    for (const transaction of transactions) {
      if (
        transaction.status === "completed" &&
        !trackedOrderIds.has(transaction.orderId)
      ) {
        try {
          await createTrackedOrder(transaction.orderId, user.id);
        } catch (error) {
          console.error(
            `Tracking recovery failed for order ${transaction.orderId}:`,
            error,
          );
        }
      }
    }

    // Include newly recovered tracking records.
    orders = await getTrackedOrders(user.id);

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error("My tracked orders GET error:", error);

    return NextResponse.json(
      { error: "Unable to fetch your tracked orders." },
      { status: 500 },
    );
  }
}