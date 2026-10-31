# PayPal AgentFlow

AI shopping agent dashboard (Next.js App Router, TypeScript, Tailwind). The agent compares products, you approve, and payment runs through **PayPal Sandbox** (Orders v2). Sandbox only: live mode is rejected by config validation.

## Setup

Requires Node.js 20+.

1. In the PayPal Developer Dashboard open your **AgentFlow** Sandbox app (not the Default Application) and copy its Client ID and Secret.
2. `Copy-Item .env.example .env.local` and paste them into `.env.local` yourself:
   ```
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
   PAYPAL_ENV=sandbox
   ```
   Optional: `APP_URL` (default `http://localhost:3000`), `AGENT_SPENDING_LIMIT` (USD server cap, default 1000), `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
3. `npm install` then `npm run dev` and open http://localhost:3000.
4. Optional Supabase persistence: run `supabase/schema.sql`. Without Supabase, transactions are stored in `.data/transactions.json` (dev only, git-ignored).

## Payment flow

1. Chat request → agent ranks products from the built-in sample catalog.
2. **Approve payment** → `POST /api/paypal/orders`. The server prices the order from its own catalog, enforces the spending limit, creates the Sandbox order and returns the PayPal approval URL; the browser is redirected.
3. Approve with a Sandbox **buyer** account (Dashboard → Testing Tools → Sandbox Accounts).
4. PayPal returns to `/payment/return`, which calls `POST /api/paypal/capture`. The server atomically claims the order (no double capture), captures it, and verifies order status, capture status, amount and currency against its own record. **Completed is shown only after that verification.**
5. Cancelling at PayPal returns to `/payment/cancel` → `POST /api/paypal/cancel` → Cancelled.

States: Not Started, Awaiting Approval, Processing, Completed, Failed, Cancelled.

## Tests

```bash
npm test                              # unit tests: money, limits, capture verification
npm run build
node tests/live-sandbox-smoke.mjs     # needs a running server; BASE=http://localhost:3000
```
The live smoke test creates and then cancels a real Sandbox order. Completing a capture needs a manual buyer login at PayPal.

## Security

- PayPal and Supabase secrets are read only in server code (`src/lib/paypal`, `src/lib/store`) and are never logged or sent to the browser.
- The browser sends only a product id, an approval flag and an order id. Amounts and statuses are never trusted from it; the client spending limit can only lower the server cap.
- Out of scope: WhatsApp, voice, payouts, multi-agent negotiation.
- Note: there is no user auth yet, so transactions and the spending cap are global to this deployment.
