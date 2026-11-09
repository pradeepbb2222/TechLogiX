
import { NextResponse } from "next/server";
import { understandShoppingRequest } from "@/lib/gemini";
import { searchProducts } from "@/lib/agent";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to use AgentFlow." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      message?: unknown;
    } | null;

    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!message || message.length > 500) {
      return NextResponse.json(
        { error: "Message must be 1-500 characters." },
        { status: 400 },
      );
    }

    const geminiStart = Date.now();
    const intent = await understandShoppingRequest(message);

    console.log(
      `[TIMING] Gemini: ${((Date.now() - geminiStart) / 1000).toFixed(2)}s`,
    );

    const channel3Start = Date.now();
    const result = await searchProducts(intent);

    console.log(
      `[TIMING] Channel3 + ranking: ${((Date.now() - channel3Start) / 1000).toFixed(2)}s`,
    );

    return NextResponse.json({
      ...result,
      intent,
    });
  } catch (error) {
    console.error("Agent API error:", error);

    return NextResponse.json(
      {
        error: "Unable to process your request. Please try again.",
      },
      { status: 500 },
    );
  }
}
