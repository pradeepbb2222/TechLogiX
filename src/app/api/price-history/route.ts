import { NextResponse, connection } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getChannel3PriceHistory } from "@/lib/pricing/channel3-history";

export async function GET(request: Request) {
  await connection();

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to view price history." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId")?.trim();

    if (!productId || productId.length > 200) {
      return NextResponse.json(
        { error: "A valid product ID is required." },
        { status: 400 },
      );
    }

    const result = await getChannel3PriceHistory(productId);

    return NextResponse.json({
      canonicalProductId: result.canonical_product_id,
      productTitle: result.product_title ?? null,
      history: (result.history ?? []).map((point) => ({
        timestamp: point.timestamp.toISOString(),
        price: point.price,
        currency: point.currency,
      })),
      statistics: result.statistics ?? null,
    });
  } catch (error) {
    console.error("Price history API error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve price history at this time." },
      { status: 502 },
    );
  }
}
