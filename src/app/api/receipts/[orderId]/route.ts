
import { NextResponse } from "next/server";
import { ownsRecord } from "@/lib/checkout/logic";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import {
  buildReceipt,
  InvalidReceiptStatusError,
  MissingCaptureIdError,
} from "@/lib/receipt/generator";
import { getStore } from "@/lib/store";

const ORDER_ID_REGEX = /^[A-Za-z0-9-]{8,40}$/;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;

  if (!orderId || !ORDER_ID_REGEX.test(orderId)) {
    return NextResponse.json(
      { error: "Missing or invalid order ID." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please log in again." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const store = getStore();
    const record = await store.get(orderId, user.id);

    if (!record || !ownsRecord(record, user.id)) {
      return NextResponse.json(
        { error: "Unknown order, or your browser session has expired." },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    if (record.status !== "completed") {
      return NextResponse.json(
        {
          error: `Receipt unavailable: transaction is not completed (status: ${record.status}).`,
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const receipt = buildReceipt(record);

    return NextResponse.json(
      { receipt },
      { headers: NO_STORE_HEADERS },
    );
  } catch (err) {
    if (
      err instanceof InvalidReceiptStatusError ||
      err instanceof MissingCaptureIdError
    ) {
      return NextResponse.json(
        { error: err.message },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    console.error("[receipt] Failed to generate receipt:", err);

    return NextResponse.json(
      { error: "Could not generate receipt." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
