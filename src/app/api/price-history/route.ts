import { connection } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getChannel3PriceHistory } from "@/lib/pricing/channel3-history";
import {
  consumePriceHistoryLimit,
  readPriceHistoryCache,
  writePriceHistoryCache,
} from "@/lib/pricing/price-history-store";
import {
  createPriceHistoryHandler,
  type PriceHistoryPayload,
} from "@/lib/pricing/price-history-service";

async function fetchPayload(productId: string): Promise<PriceHistoryPayload> {
  const result = await getChannel3PriceHistory(productId);
  return {
    canonicalProductId: result.canonical_product_id,
    productTitle: result.product_title ?? null,
    history: (result.history ?? []).map(point => ({
      timestamp: point.timestamp.toISOString(),
      price: point.price,
      currency: point.currency,
    })),
    statistics: result.statistics ?? null,
  };
}

const handler = createPriceHistoryHandler({
  getUser: getAuthenticatedUser,
  consumeLimit: consumePriceHistoryLimit,
  readCache: readPriceHistoryCache,
  fetchHistory: fetchPayload,
  writeCache: writePriceHistoryCache,
});

export async function GET(request: Request) {
  await connection();
  return handler(request);
}
