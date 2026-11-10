
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createTrackedOrder } from "@/features/order-tracking/services/trackingStorage";

export async function POST(request: Request) {
  // Verify the logged-in user.
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 },
    );
  }

  try {
    let body: { orderId?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const orderId = body?.orderId;

    if (typeof orderId !== "string" || !orderId.trim()) {
      return NextResponse.json(
        { error: "A valid order ID is required." },
        { status: 400 },
      );
    }

    const order = await createTrackedOrder(orderId.trim(), user.id);

    return NextResponse.json(
      {
        message: "Order tracking created successfully.",
        order,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Order tracking POST error:", error);

    const message = error instanceof Error ? error.message : "";

    if (message === "Order not found.") {
      return NextResponse.json(
        { error: message },
        { status: 404 },
      );
    }

    if (message === "Order tracking requires successful payment.") {
      return NextResponse.json(
        { error: message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create order tracking." },
      { status: 500 },
    );
  }
}
