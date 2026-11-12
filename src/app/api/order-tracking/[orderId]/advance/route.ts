
import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    { error: "Delivery status updates are managed automatically." },
    { status: 403 },
  );
}
