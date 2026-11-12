CogniCart – AI-Powered Shopping Assistant

CogniCart is an AI-powered shopping platform designed to make online shopping more intelligent, transparent, and secure. It enables users to discover products through natural-language requests, compare available options, analyze historical prices, manage personal spending limits, track orders, and make purchases with explicit user approval.

By combining AI-powered natural-language understanding, real-world product discovery, intelligent product comparison, and secure payment workflows, CogniCart aims to provide a smarter and more controlled shopping experience.

Built using Next.js, TypeScript, Tailwind CSS, Supabase, Google Gemini, Channel3, and PayPal Sandbox.

Features

1. AI-Powered Product Discovery

- Search for products using natural-language shopping requests.
- Understand shopping preferences and requirements through AI integration.
- Retrieve product information through the Channel3 API.
- Present relevant product recommendations for users to explore.

2. Intelligent Product Comparison and Ranking

- Compare available products based on price, ratings, specifications, and relevant product details.
- Evaluate products against individual user requirements and preferences.
- Generate AI-assisted product rankings and recommendations.
- Present product highlights to help users make informed purchasing decisions.

3. Gemini-Powered AI Integration

- Integrate Google Gemini API to support AI-powered shopping workflows.
- Use Gemini for natural-language intent understanding and structured requirement extraction.
- Support AI-assisted product comparison and ranking.
- Generate structured AI responses to connect natural-language requests with product discovery and recommendation workflows.

4. Voice-Based Shopping Input

- Accept voice input for shopping requests.
- Convert speech into text using Gemini-powered transcription.
- Allow users to interact with the shopping assistant without manually typing their entire request.

5. Historical Price Analysis

- Retrieve historical product pricing information through the Channel3 API.
- Analyze up to 90 days of available price history.
- Display useful pricing insights, including:
  - Average historical price.
  - Minimum historical price.
  - Maximum historical price.
  - Price volatility.
  - 30-day lowest price.
- Present historical pricing information through a dedicated price-analysis interface.
- Use caching and rate limiting to improve efficiency and control API usage.

6. Secure User Authentication

- Support user authentication through Supabase Auth.
- Maintain user-specific shopping and transaction information.
- Restrict access to personal records through authenticated, user-scoped operations.

7. Personal Spending Limits

- Allow users to configure individual spending limits.
- Monitor available budgets and committed spending.
- Enforce spending limits through server-side validation.
- Prevent concurrent purchases from exceeding the configured spending limit through atomic checkout reservations.

8. User-Approved Payments

- Integrate PayPal Orders API v2 using PayPal Sandbox.
- Require explicit user approval before completing purchases.
- Validate product details, expected prices, and transaction information on the backend.
- Verify payment captures before marking transactions as completed.

9. Transaction History

- Maintain individual purchase records.
- Display transaction details and payment statuses.
- Restrict transaction access to the authenticated owner.

10. Payment Receipts

- Generate receipts for successfully completed transactions.
- Display payment details, including order and capture identifiers.
- Support printing and saving receipts as PDF through the browser.

11. Order Tracking

- Provide a dedicated order-tracking interface.
- Display delivery stages such as:
  - Order Placed
  - Processing
  - Packed
  - Shipped
  - Out for Delivery
  - Delivered
- Progress order statuses automatically through scheduled Supabase jobs.
- Refresh order information periodically without requiring manual page reloads.
- Retrieve orders securely using authenticated, user-scoped database operations.

Note: The current delivery progression is simulated. Integration with external courier and logistics providers is a planned enhancement.

12. Payment and Spending Protection

- Enforce spending limits independently of frontend calculations.
- Validate transaction ownership before payment operations.
- Use atomic database operations to prevent concurrent overspending.
- Protect against duplicate payment captures.
- Verify PayPal order and capture details against server-side transaction records.
- Handle cancelled and uncertain payment outcomes safely.

Technology Stack

Component| Technology
Frontend| Next.js App Router, React, TypeScript
Styling| Tailwind CSS
Backend Runtime| Node.js
AI / LLM| Google Gemini API
AI Integration| Vercel AI SDK
Intent Understanding| Google Gemini API
Product Comparison and Ranking| Google Gemini API
Speech-to-Text| Google Gemini API
Product Discovery| Channel3 API
Payment Processing| PayPal Orders API v2 (Sandbox)
Authentication| Supabase Auth
Database| Supabase PostgreSQL
Caching and Rate Limiting| Upstash Redis
Database Operations| Supabase RPC, PostgreSQL Functions
Scheduled Jobs| Supabase Cron (pg_cron)
Deployment| Vercel
Testing| Node.js Test Runner, TypeScript

Project Architecture

CogniCart follows a full-stack architecture built around Next.js App Router.

- Frontend: React and Tailwind CSS provide the shopping interface, product comparison, spending controls, transaction history, receipts, and order tracking.
- Backend: Next.js API routes handle authentication, product-related operations, AI workflows, payment processing, transcription, and order tracking.
- AI Layer: Google Gemini provides AI capabilities for natural-language understanding, product comparison, ranking, and speech-to-text.
- Product Data Layer: Channel3 provides product discovery and historical pricing data.
- Database Layer: Supabase PostgreSQL stores user-related information, transactions, order records, and price-history infrastructure.
- Payment Layer: PayPal Sandbox handles payment approval and capture workflows.
- Background Processing: Supabase scheduled jobs handle automatic order-status progression.
- Caching and Rate Limiting: Upstash Redis and database-backed rate-limiting mechanisms help control resource usage.

Setup

Prerequisites

- Node.js 20+
- npm
- A Supabase project
- PayPal Sandbox REST application credentials
- Google Gemini API key
- Channel3 API access
- Upstash Redis credentials, if required by the configured integrations

1. Clone and Install

git clone <your-repository-url>
cd TechLogiX
npm install

2. Configure Environment Variables

Create your local environment file:

Copy-Item .env.example .env.local

Configure the required application credentials and settings in ".env.local".

Variable| Purpose
"PAYPAL_CLIENT_ID"| PayPal Sandbox REST application Client ID
"PAYPAL_CLIENT_SECRET"| PayPal Sandbox REST application Secret
"PAYPAL_BASE_URL"| PayPal Sandbox API endpoint
"PAYPAL_ENV"| Payment environment ("sandbox")
"APP_URL"| Application origin used for payment redirects
"AGENT_SPENDING_LIMIT"| Server-side spending cap in USD
"NEXT_PUBLIC_SUPABASE_URL"| Supabase project URL
"NEXT_PUBLIC_SUPABASE_ANON_KEY"| Supabase publishable/anon key
"SUPABASE_URL"| Server-side Supabase project URL
"SUPABASE_SERVICE_ROLE_KEY"| Server-side Supabase service-role key

Also configure the Gemini, Channel3, and Upstash credentials required by the corresponding integrations. Refer to ".env.example" and the application configuration for the exact variable names.

Use your own API credentials and service configurations.

Security: Never commit ".env.local", PayPal secrets, AI API keys, Channel3 credentials, or the Supabase service-role key. Never expose server-side secrets through "NEXT_PUBLIC_" variables.

3. Configure Supabase

- Configure Supabase authentication.
- Set up the required PostgreSQL database schema.
- Apply the SQL migrations in the "supabase/migrations" directory.
- Ensure the required database functions, Row Level Security policies, and scheduled-job infrastructure are configured.
- Verify that the order-tracking scheduled job is active.

Do not blindly rerun migrations that have already been applied to your database.

4. Start the Application

npm run dev

Open:

http://localhost:3000

5. Run Tests

Run the test suite:

npm test

Build the application:

npm run build

Product Discovery and AI Workflow

1. The user enters a shopping request using text or voice.
2. Voice requests are converted into text through Gemini-powered transcription.
3. Gemini interprets the user's shopping request and extracts structured requirements.
4. Channel3 retrieves relevant product information.
5. Gemini evaluates available products against the user's requirements and generates a ranked shortlist.
6. Products are presented with relevant details, prices, ratings, and recommendations.
7. Historical price information can be retrieved and analyzed to provide additional purchasing context.
8. The user selects a product and reviews its price and available spending limit.

Payment Flow

1. The user selects a product and explicitly approves the purchase.
2. The backend retrieves and validates the product details and expected price.
3. The backend verifies authentication, spending limits, pending transactions, and checkout availability.
4. An atomic checkout reservation prevents concurrent purchases from exceeding the user's spending limit.
5. The backend creates a PayPal Sandbox order.
6. The user is redirected to PayPal to approve the payment using a Sandbox buyer account.
7. The application receives the payment-return request and calls "POST /api/paypal/capture".
8. The backend verifies that the order belongs to the authenticated user and atomically claims the capture operation.
9. The spending limit is checked again before payment capture.
10. The PayPal order is captured and its returned details are verified against the stored transaction amount, currency, and order ID.
11. The transaction is marked completed only after successful server-side verification.
12. A receipt becomes available for the completed transaction.
13. If the user cancels the PayPal approval flow, the cancellation workflow updates the transaction accordingly.

Spending Limit Protection

CogniCart enforces individual spending limits for authenticated users.

- Spending limits are maintained per user.
- Backend validation is independent of frontend calculations.
- Pending, processing, and completed transactions count toward committed spending.
- Atomic checkout reservations help prevent concurrent purchases from exceeding the user's spending limit.
- The capture endpoint validates the spending limit again before capturing payment.

Order Tracking Workflow

CogniCart provides an order-tracking interface with automatic status progression.

The tracking workflow uses Supabase PostgreSQL functions and scheduled jobs.

- Orders are associated with authenticated users.
- Only completed transactions are eligible for tracking creation.
- Order records and tracking events are maintained in the database.
- Database operations validate ownership and permitted status transitions.
- Scheduled jobs automatically progress eligible orders through their delivery stages.
- The frontend refreshes tracking information every 60 seconds.
- Customers cannot manually advance delivery statuses through the API.

Important: Delivery progression is currently simulated for demonstration purposes. Real-time courier tracking and external logistics integrations are not yet implemented.

Historical Price Analysis

CogniCart uses Channel3 to retrieve historical product pricing information.

The price-analysis feature provides:

- Historical price retrieval for up to 90 days.
- Average, minimum, and maximum price calculations.
- Price volatility analysis.
- 30-day lowest-price insights.
- Cached results to reduce unnecessary API requests.
- Rate limiting to control API usage.

This feature helps users evaluate historical pricing trends rather than relying only on the current listed price.

Transaction Statuses

The payment workflow supports the following transaction statuses:

- "not_started"
- "awaiting_approval"
- "processing"
- "completed"
- "failed"
- "cancelled"

Order-tracking statuses are maintained separately:

- "ORDER_PLACED"
- "PROCESSING"
- "PACKED"
- "SHIPPED"
- "OUT_FOR_DELIVERY"
- "DELIVERED"

Testing

Run the unit tests:

npm test

Build the application:

npm run build

The live PayPal Sandbox smoke test can be run using:

node tests/live-sandbox-smoke.mjs

The smoke test requires a running application and valid PayPal Sandbox credentials. Completing a payment requires manual approval through a Sandbox buyer account.

Additional tests cover payment verification, transaction ownership, spending-limit enforcement, order tracking, API behavior, price-history functionality, speech transcription, and frontend refresh behavior.

Security

CogniCart incorporates multiple security measures:

- PayPal credentials and Supabase service-role credentials remain server-side.
- AI and external API credentials are never exposed through public environment variables.
- Payment endpoints require authentication.
- Users can access only their own transaction and order records.
- Database Row Level Security policies protect user-specific records.
- Checkout and capture operations validate transaction ownership.
- Atomic checkout reservations protect against concurrent overspending.
- Atomic capture claiming prevents concurrent requests from independently capturing the same transaction.
- PayPal order IDs, capture statuses, amounts, and currencies are verified against trusted server-side records.
- Uncertain capture outcomes are reconciled with PayPal instead of blindly retrying a capture.
- API rate limiting helps protect resource-intensive endpoints.
- Transactions are marked completed only after successful server-side verification.

PayPal Sandbox is used for payment testing. Live payment processing is not supported by the current configuration.

Deployment

CogniCart is designed for deployment using Vercel.

Deployment requires:

1. Connecting the GitHub repository to Vercel.
2. Configuring the required production environment variables.
3. Configuring Supabase authentication and database migrations.
4. Ensuring required scheduled jobs are active.
5. Configuring Gemini and Channel3 API credentials.
6. Verifying PayPal Sandbox configuration.
7. Testing the deployed application and payment workflow.

Planned Enhancements

- Advanced AI Shopping Agents: Improve multi-step shopping assistance, contextual reasoning, and product-selection capabilities.
- Real-Time Logistics Integration: Connect with external courier and logistics providers for actual shipment updates.
- Production Payment Readiness: Evaluate and implement the additional security, compliance, and operational requirements needed before supporting live PayPal payments.
- Personalized Recommendations: Improve product recommendations based on user preferences and shopping behavior.
- Enhanced Price Intelligence: Introduce more advanced price-trend insights and purchasing recommendations.
- Agentic Purchasing Workflows: Develop more advanced AI-assisted purchasing workflows while preserving explicit user approval and strict spending safeguards.

Project Vision

CogniCart aims to transform conventional online shopping into an intelligent, transparent, and user-controlled experience.

By combining AI-powered intelligence, real-world product discovery, historical price analysis, personalized spending controls, secure payments, and automated order tracking, CogniCart helps users make better purchasing decisions while retaining control over every transaction.

Shop with Ease. Pay with Peace.
