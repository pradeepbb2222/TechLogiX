import type { PayPalConfig } from "./config";
import type { PayPalOrder } from "./verify";

/** Server-only PayPal Orders v2 client using plain fetch (no SDK). Secrets never leave this file. */

export class PayPalApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly issue?: string,
    readonly debugId?: string,
  ) {
    super(message);
  }
}

/** Short timeouts keep a hung PayPal call from leaving a record in `processing` for long. */
const REQUEST_TIMEOUT_MS = 15_000;

interface CachedToken {
  value: string;
  expiresAt: number;
}
// globalThis so the cache survives module duplication in dev.
const globalCache = globalThis as { __agentflowPayPalToken?: CachedToken };

async function getAccessToken(cfg: PayPalConfig): Promise<string> {
  const cached = globalCache.__agentflowPayPalToken;
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.value;

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const res = await fetch(`${cfg.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const hint = res.status === 401 ? "PayPal rejected the Sandbox credentials. Re-check the AgentFlow app Client ID/Secret." : "PayPal authentication failed.";
    throw new PayPalApiError(hint, res.status, undefined, res.headers.get("paypal-debug-id") ?? undefined);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  globalCache.__agentflowPayPalToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function paypalFetch<T>(cfg: PayPalConfig, path: string, init: { method: "GET" | "POST"; body?: unknown; headers?: Record<string, string> }): Promise<T> {
  const token = await getAccessToken(cfg);
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { details?: { issue?: string }[]; message?: string; debug_id?: string };
  if (!res.ok) {
    throw new PayPalApiError(
      json.message ?? `PayPal request failed (${res.status}).`,
      res.status,
      json.details?.[0]?.issue,
      json.debug_id ?? res.headers.get("paypal-debug-id") ?? undefined,
    );
  }
  return json as T;
}

export async function createOrder(
  cfg: PayPalConfig,
  args: { requestId: string; productId: string; description: string; amountValue: string; currency: string },
): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(cfg, "/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": args.requestId },
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: args.productId,
          description: args.description.slice(0, 127),
          amount: { currency_code: args.currency, value: args.amountValue },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "PayPal AgentFlow",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${cfg.appUrl}/payment/return`,
            cancel_url: `${cfg.appUrl}/payment/cancel`,
          },
        },
      },
    },
  });
}

export async function captureOrder(cfg: PayPalConfig, orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(cfg, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { "PayPal-Request-Id": `agentflow-capture-${orderId}`, Prefer: "return=representation" },
    body: {},
  });
}

export async function getOrder(cfg: PayPalConfig, orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(cfg, `/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

/** Returns the buyer approval URL, only if it points at a paypal.com host. */
export function extractApproveUrl(order: PayPalOrder): string | null {
  const link = order.links?.find((l) => l.rel === "payer-action") ?? order.links?.find((l) => l.rel === "approve");
  if (!link) return null;
  try {
    const url = new URL(link.href);
    return url.protocol === "https:" && url.hostname.endsWith(".paypal.com") ? url.toString() : null;
  } catch {
    return null;
  }
}
