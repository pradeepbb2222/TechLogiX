-- TechLogiX: Atomic Order Tracking Creation
-- Creates the tracked order and its initial event in one transaction.

CREATE OR REPLACE FUNCTION public.create_tracked_order_with_event(
    p_order_id TEXT,
    p_user_id UUID,
    p_tracking_number TEXT,
    p_product_id TEXT,
    p_product_name TEXT,
    p_merchant TEXT,
    p_amount_cents INTEGER,
    p_currency TEXT,
    p_estimated_delivery TIMESTAMPTZ,
    p_created_at TIMESTAMPTZ,
    p_event_title TEXT,
    p_event_description TEXT,
    p_event_timestamp TIMESTAMPTZ
)
RETURNS SETOF public.tracked_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.tracked_orders;
    v_transaction public.transactions%ROWTYPE;
BEGIN
    SELECT *
    INTO v_transaction
    FROM public.transactions
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND OR v_transaction.user_id IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'Order not found.';
    END IF;

    IF v_transaction.status <> 'completed' THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'Order tracking requires successful payment.';
    END IF;

    INSERT INTO public.tracked_orders (
        order_id,
        user_id,
        tracking_number,
        product_id,
        product_name,
        merchant,
        amount_cents,
        currency,
        status,
        estimated_delivery,
        created_at,
        updated_at
    )
    VALUES (
        v_transaction.order_id,
        v_transaction.user_id,
        p_tracking_number,
        v_transaction.product_id,
        v_transaction.product_name,
        v_transaction.merchant,
        v_transaction.amount_cents,
        v_transaction.currency,
        'ORDER_PLACED',
        p_estimated_delivery,
        p_created_at,
        p_created_at
    )
    ON CONFLICT (order_id) DO NOTHING
    RETURNING * INTO v_order;

    IF FOUND THEN
        INSERT INTO public.tracking_events (
            order_id,
            status,
            title,
            description,
            timestamp
        )
        VALUES (
            v_transaction.order_id,
            'ORDER_PLACED',
            p_event_title,
            p_event_description,
            p_event_timestamp
        );
    ELSE
        SELECT *
        INTO v_order
        FROM public.tracked_orders
        WHERE order_id = p_order_id
          AND user_id = p_user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0002',
                MESSAGE = 'Order not found.';
        END IF;
    END IF;

    RETURN NEXT v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tracked_order_with_event(
    TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT,
    TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_tracked_order_with_event(
    TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT,
    TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;
