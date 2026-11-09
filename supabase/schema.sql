
-- AgentFlow transaction schema.
-- Accessed only from the Next.js server using the Supabase service-role key.

CREATE TABLE IF NOT EXISTS public.transactions (
  order_id      text PRIMARY KEY,
  product_id    text NOT NULL,
  product_name  text NOT NULL,
  merchant      text NOT NULL,
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  currency      text NOT NULL DEFAULT 'USD',
  limit_cents   integer NOT NULL,

  -- Legacy anonymous-session field. Retained for old records.
  owner_hash    text,

  -- Authenticated Supabase user who owns this transaction.
  -- NULL is permitted for legacy records created before authentication.
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  status        text NOT NULL CHECK (
    status IN (
      'not_started',
      'awaiting_approval',
      'processing',
      'completed',
      'failed',
      'cancelled'
    )
  ),

  note          text,
  capture_id    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Upgrade existing databases safely.
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS owner_hash text;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add the foreign key if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_user_id_fkey'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Legacy index retained.
CREATE INDEX IF NOT EXISTS transactions_owner_idx
ON public.transactions (owner_hash, created_at DESC);

-- Index for authenticated user's transaction history.
CREATE INDEX IF NOT EXISTS transactions_user_created_idx
ON public.transactions (user_id, created_at DESC);

-- Enable Row Level Security.
-- Server-side service-role operations bypass RLS, so application code
-- must explicitly filter every user-specific operation by user_id.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
