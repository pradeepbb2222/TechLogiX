export interface PriceHistoryPayload {
  canonicalProductId: string;
  productTitle: string | null;
  history: Array<{ timestamp: string; price: number; currency: string }>;
  statistics: {
    mean: number;
    std_dev: number;
    min_price: number;
    max_price: number;
    current_price: number;
    current_status: "low" | "typical" | "high";
    currency: string;
  } | null;
}

export interface PriceHistoryDependencies {
  getUser(): Promise<{ id: string } | null>;
  consumeLimit(userId: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  readCache(productId: string): Promise<PriceHistoryPayload | null>;
  fetchHistory(productId: string): Promise<PriceHistoryPayload>;
  writeCache(productId: string, payload: PriceHistoryPayload): Promise<void>;
}

class RateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many price-history requests. Please try again shortly.");
  }
}

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      ...extra,
    },
  });
}

export function createPriceHistoryHandler(deps: PriceHistoryDependencies) {
  return async (request: Request): Promise<Response> => {
    try {
      const user = await deps.getUser();
      if (!user) return json({ error: "Please sign in to view price history." }, 401);

      const productId = new URL(request.url).searchParams.get("productId")?.trim();
      if (!productId || productId.length > 200 || /[\u0000-\u001f]/.test(productId)) {
        return json({ error: "A valid product ID is required." }, 400);
      }

      const limit = await deps.consumeLimit(user.id);
      if (!limit.allowed) throw new RateLimitError(limit.retryAfterSeconds);

      const cached = await deps.readCache(productId);
      if (cached) return json(cached, 200, { "X-Price-History-Cache": "HIT" });

      const payload = await deps.fetchHistory(productId);
      await deps.writeCache(productId, payload);
      return json(payload, 200, { "X-Price-History-Cache": "MISS" });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return json({ error: error.message }, 429, {
          "Retry-After": String(error.retryAfterSeconds),
        });
      }
      console.error("Price history API error:", error);
      return json({ error: "Unable to retrieve price history at this time." }, 502);
    }
  };
}
