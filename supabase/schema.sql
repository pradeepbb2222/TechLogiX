-- Run in the Supabase SQL editor. Accessed only from the Next.js server with the service-role key.
create table if not exists public.transactions (
  order_id      text primary key,
  product_id    text not null,
  product_name  text not null,
  merchant      text not null,
  amount_cents  integer not null check (amount_cents > 0),
  currency      text not null default 'USD',
  limit_cents   integer not null,
  owner_hash    text,  -- SHA-256 of the anonymous browser session id; null for legacy rows (never exposed)
  status        text not null check (status in
                  ('not_started','awaiting_approval','processing','completed','failed','cancelled')),
  note          text,
  capture_id    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Upgrade path for databases created before session ownership existed.
alter table public.transactions add column if not exists owner_hash text;
create index if not exists transactions_owner_idx on public.transactions (owner_hash, created_at desc);

-- Lock the table down: no anon/authenticated access; the service role bypasses RLS.
alter table public.transactions enable row level security;
