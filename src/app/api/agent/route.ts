import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/agent";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { message?: unknown; spendingLimit?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 500) {
    return NextResponse.json({ error: "Message must be 1-500 characters." }, { status: 400 });
  }
  const limit = typeof body?.spendingLimit === "number" && body.spendingLimit > 0 ? body.spendingLimit : undefined;
  return NextResponse.json(searchProducts(message, limit));
}
