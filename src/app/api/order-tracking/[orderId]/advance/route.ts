
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { advanceTrackedOrder } from "@/features/order-tracking/services/trackingStorage";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const { orderId } = await params;

    if (!orderId?.trim()) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 },
      );
    }

    const order = await advanceTrackedOrder(orderId.trim(), user.id);

    if (!order) {
      return NextResponse.json(
        { error: "Tracking information not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: "Delivery status updated successfully.",
        order,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Order tracking advance error:", error);

    const message = error instanceof Error ? error.message : "";

    if (message.includes("Order status changed")) {
      return NextResponse.json(
        { error: message },
        { status: 409 },
      );
    }

    if (message === "Order not found.") {
      return NextResponse.json(
        { error: message },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Unable to update delivery status." },
      { status: 500 },
    );
  }
}