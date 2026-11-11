import type { PriceHistoryPayload } from "./price-history-service";

const LIMIT = 20;
const WINDOW_SECONDS = 60;
const CACHE_TTL_MS = 15 * 60 * 1000;

function config() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Price history requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return {
    base: `${url.replace(/\/+$/, "")}/rest/v1`,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
}


async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = config();

  const response = await fetch(`${c.base}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...c.headers, ...(init.headers ?? {}) },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Price history storage failed (${response.status}) at ${path}: ${body || "empty response"}`,
    );
  }

  if (!body.trim()) {
  if (init.headers && new Headers(init.headers).get("Prefer")?.includes("return=minimal")) {
    return undefined as T;
  }

  throw new Error(
    `Price history storage returned an empty response at ${path} (HTTP ${response.status}).`,
  );
}

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      `Price history storage returned invalid JSON at ${path} (HTTP ${response.status}): ${body.slice(0, 200)}`,
    );
  }
}


export async function consumePriceHistoryLimit(userId: string) {
  const rows = await request<Array<{ allowed: boolean; retry_after_seconds: number }>>(
    "/rpc/consume_price_history_rate_limit",
    {
      method: "POST",
      body: JSON.stringify({ p_user_id: userId, p_limit: LIMIT, p_window_seconds: WINDOW_SECONDS }),
    },
  );
  const row = rows[0];
  if (!row) throw new Error("Rate-limit service returned no result.");
  return { allowed: row.allowed, retryAfterSeconds: Math.max(1, row.retry_after_seconds) };
}

export async function readPriceHistoryCache(productId: string) {
  const rows = await request<Array<{ response: PriceHistoryPayload }>>(
    `/price_history_cache?product_id=eq.${encodeURIComponent(productId)}` +
    `&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=response&limit=1`,
  );
  return rows[0]?.response ?? null;
}

export async function writePriceHistoryCache(productId: string, response: PriceHistoryPayload) {
  await request<undefined>("/price_history_cache?on_conflict=product_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      product_id: productId,
      response,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    }),
  });
}
