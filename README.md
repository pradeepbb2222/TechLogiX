
# CogniCart – AI Shopping Assistant

CogniCart is an AI-powered shopping platform that helps users discover products, compare available options, manage spending limits, and make purchases with explicit user approval.

Built using Next.js App Router, TypeScript, Tailwind CSS, Supabase, and PayPal Sandbox.

## Features

- **Product discovery:** Search for products using natural-language shopping requests.
- **Product comparison:** Review product recommendations, prices, ratings, and relevant highlights.
- **User authentication:** Secure sign-in using Supabase authentication.
- **Personal spending limits:** Configure individual spending limits and monitor available budgets.
- **User-approved payments:** Purchases require explicit approval through PayPal Sandbox.
- **Transaction history:** View individual purchase records and payment statuses.
- **Payment verification:** Verify captured orders against server-side transaction records.
- **Cancellation support:** Handle cancelled PayPal orders.
- **Spending protection:** Enforce spending limits on the server and prevent concurrent overspending through atomic checkout reservations.

## Technology Stack


| Component | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Authentication | Supabase Auth |
| Database | Supabase |
| AI / LLM | Google Gemini API |
| AI Integration | Vercel AI SDK |
| Product Discovery | Channel3 API |
| Payments | PayPal Orders API v2 (Sandbox) |
| Development | Node.js, npm |



## Setup

**Prerequisites:** Node.js 20+ and npm.

### 1. Clone and install

```bash
git clone <your-repository-url>
cd TechLogiX
npm install
```

### 2. Configure environment variables

Create your local environment file:

```powershell
Copy-Item .env.example .env.local
```

Configure the following variables in `.env.local`:

| Variable | Purpose |
|---|---|
| `PAYPAL_CLIENT_ID` | PayPal Sandbox REST application Client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox REST application Secret |
| `PAYPAL_BASE_URL` | PayPal Sandbox API endpoint |
| `PAYPAL_ENV` | Payment environment (`sandbox`) |
| `APP_URL` | Application origin used for payment redirects |
| `AGENT_SPENDING_LIMIT` | Server-side spending cap in USD |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for authentication |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key |
| `SUPABASE_URL` | Supabase URL used by the server-side store |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase service-role key |

Use your own PayPal Sandbox REST application credentials and Supabase project credentials.

**Security:** Never commit `.env.local`, PayPal secrets, or the Supabase service-role key. Never expose server-side secrets through `NEXT_PUBLIC_` variables.

### 3. Configure Supabase

Configure Supabase authentication and database access.

Run the required SQL schema and migrations in your Supabase project.

### 4. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run tests

```bash
npm test
npm run build
```



## Payment Flow

1. The user submits a natural-language shopping request.
2. CogniCart retrieves and presents product recommendations using the configured product discovery service.
3. The user selects a product and reviews its price and available spending limit.
4. After explicit user approval, the backend retrieves the product details and validates the expected price against the current product price.
5. The backend checks authentication, spending limits, pending transactions, and checkout availability before creating a PayPal Sandbox order.
6. The user is redirected to PayPal to approve the payment using a Sandbox buyer account.
7. The application receives the payment-return request and calls `POST /api/paypal/capture`.
8. The backend verifies the order belongs to the authenticated user and atomically claims the capture operation.
9. The backend checks the spending limit again and captures the PayPal order.
10. The returned PayPal order and capture details are verified against the stored transaction amount, currency, and order ID.
11. The transaction is marked completed only after a verified completed capture.
12. If the user cancels the PayPal approval flow, the cancellation flow updates the transaction accordingly.

## Spending Limit Protection

CogniCart enforces individual spending limits for authenticated users.

- Spending limits are stored per user.
- The backend validates spending limits independently of frontend calculations.
- Pending, processing, and completed transactions count toward committed spending.
- Checkout reservations use an atomic database operation to prevent concurrent purchases from exceeding the user's spending limit.
- The capture endpoint checks the spending limit again before capturing payment.

## Transaction Statuses

- `not_started`
- `awaiting_approval`
- `processing`
- `completed`
- `failed`
- `cancelled`

## Testing

Run the unit tests:

```bash
npm test
```

Build the application:

```bash
npm run build
```

The live Sandbox smoke test can be run with:

```bash
node tests/live-sandbox-smoke.mjs
```

The smoke test requires a running application and valid PayPal Sandbox credentials. Completing a payment requires manual approval through a Sandbox buyer account.

## Security

- PayPal credentials and Supabase service-role credentials remain server-side.
- Payment endpoints require Supabase authentication.
- Users can access only their own transaction records.
- Checkout and capture operations validate transaction ownership.
- Atomic checkout reservations protect against concurrent overspending.
- Atomic capture claiming prevents concurrent requests from independently capturing the same transaction.
- PayPal order IDs, capture statuses, amounts, and currencies are verified against trusted server-side records.
- Uncertain capture outcomes are reconciled with PayPal instead of blindly retrying a capture.
- Transactions are marked completed only after successful server-side verification.
- PayPal Sandbox is used for payment testing; live payment mode is not supported by the current configuration.



## Planned Enhancements

- **Enhanced AI shopping workflows:** Improve multi-step shopping assistance and product-selection reasoning.
- **Autonomous shopping capabilities:** Develop more advanced AI-assisted shopping workflows while preserving explicit user approval for payments.
- **Production payment readiness:** Evaluate and implement the additional requirements needed before supporting live PayPal payments.


## Project Vision

CogniCart aims to make online shopping more intelligent, transparent, and controlled by combining AI-powered product discovery with secure, user-approved payments.

**Shop with Ease. Pay with Peace.**
