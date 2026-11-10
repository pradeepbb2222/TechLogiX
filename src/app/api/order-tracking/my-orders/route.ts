
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getTrackedOrders } from "@/features/order-tracking/services/trackingStorage";

export async function GET() {
  try {
    // Verify logged-in user
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    // Fetch only this user's tracked orders
    const orders = await getTrackedOrders(user.id);

    return NextResponse.json(
      { orders },
      { status: 200 }
    );
  } catch (error) {
    console.error("My tracked orders GET error:", error);

    return NextResponse.json(
      { error: "Unable to fetch your tracked orders." },
      { status: 500 }
    );
  }
}
