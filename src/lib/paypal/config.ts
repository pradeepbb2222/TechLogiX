/** Server-only PayPal configuration. Never import this from a client component. */

export class PayPalConfigError extends Error {}

export const SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  appUrl: string;
}

/** Reads and validates env vars. Error messages name variables, never values. */
export function getPayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const env = process.env.PAYPAL_ENV?.trim();
  const baseUrl = (process.env.PAYPAL_BASE_URL?.trim() || SANDBOX_BASE_URL).replace(/\/+$/, "");

  const missing = [
    !clientId && "PAYPAL_CLIENT_ID",
    !clientSecret && "PAYPAL_CLIENT_SECRET",
    !env && "PAYPAL_ENV",
  ].filter(Boolean);
  if (missing.length > 0 || !clientId || !clientSecret) {
    throw new PayPalConfigError(`Missing ${missing.join(", ")} in .env.local (AgentFlow Sandbox app credentials).`);
  }
  if (env !== "sandbox") {
    throw new PayPalConfigError('PAYPAL_ENV must be "sandbox". Live mode is intentionally not supported.');
  }
  if (baseUrl !== SANDBOX_BASE_URL) {
    throw new PayPalConfigError(`PAYPAL_BASE_URL must be ${SANDBOX_BASE_URL}.`);
  }

  const appUrl = (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  return { clientId, clientSecret, baseUrl, appUrl };
}

/** Server-side hard cap per session, in cents. The browser can only lower it. Default $1000. */
export function getServerSpendingLimitCents(): number {
  const raw = Number.parseFloat(process.env.AGENT_SPENDING_LIMIT ?? "");
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) : 100_000;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const n = Number.parseFloat(raw ?? "");
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** How long an unapproved (awaiting_approval) order stays valid locally. Default 30 minutes. */
export function getOrderExpiryMs(): number {
  return Math.round(positiveNumber(process.env.ORDER_EXPIRY_MINUTES, 30) * 60_000);
}

/** Max unfinished (awaiting_approval) orders per browser session. Default 3. */
export function getMaxPendingOrders(): number {
  return Math.max(1, Math.floor(positiveNumber(process.env.MAX_PENDING_ORDERS_PER_SESSION, 3)));
}

export function getAppUrl(): string {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}
