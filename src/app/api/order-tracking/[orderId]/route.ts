
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getTrackedOrder } from "@/features/order-tracking/services/trackingStorage";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    // Verify the logged-in user
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    // Fetch only this user's order
    const order = await getTrackedOrder(orderId, user.id);

    if (!order) {
      return NextResponse.json(
        { error: "Tracking information not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error("Order tracking GET error:", error);

    return NextResponse.json(
      { error: "Unable to fetch tracking information." },
      { status: 500 }
    );
  }
}