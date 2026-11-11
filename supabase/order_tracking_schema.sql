
-- TechLogiX: Order Tracking Schema

-- 1. Main tracked orders table
CREATE TABLE IF NOT EXISTS public.tracked_orders (
    order_id TEXT PRIMARY KEY
        REFERENCES public.transactions(order_id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    tracking_number TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    merchant TEXT NOT NULL,

    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'USD',

    status TEXT NOT NULL DEFAULT 'ORDER_PLACED'
        CHECK (status IN (
            'ORDER_PLACED',
            'PROCESSING',
            'PACKED',
            'SHIPPED',
            'OUT_FOR_DELIVERY',
            'DELIVERED'
        )),

    estimated_delivery TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tracking event history
CREATE TABLE IF NOT EXISTS public.tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id TEXT NOT NULL
        REFERENCES public.tracked_orders(order_id)
        ON DELETE CASCADE,

    status TEXT NOT NULL
        CHECK (status IN (
            'ORDER_PLACED',
            'PROCESSING',
            'PACKED',
            'SHIPPED',
            'OUT_FOR_DELIVERY',
            'DELIVERED'
        )),

    title TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS tracked_orders_user_created_idx
ON public.tracked_orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tracking_events_order_timestamp_idx
ON public.tracking_events(order_id, timestamp ASC);

-- 4. Enable Row Level Security
ALTER TABLE public.tracked_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- 5. Recreate read policies
DROP POLICY IF EXISTS "Users can view their own tracked orders"
ON public.tracked_orders;

DROP POLICY IF EXISTS "Users can view their own tracking events"
ON public.tracking_events;

CREATE POLICY "Users can view their own tracked orders"
ON public.tracked_orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tracking events"
ON public.tracking_events
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.tracked_orders
        WHERE tracked_orders.order_id = tracking_events.order_id
          AND tracked_orders.user_id = auth.uid()
    )
);
