
-- TechLogiX: Atomic Order Tracking Advancement
-- Updates delivery status and inserts its event in one transaction.

CREATE OR REPLACE FUNCTION public.advance_tracked_order_with_event(
    p_order_id TEXT,
    p_user_id UUID,
    p_expected_status TEXT,
    p_next_status TEXT,
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
    v_valid_next_status TEXT;
BEGIN
    -- Lock this user's order while processing the advancement.
    SELECT *
    INTO v_order
    FROM public.tracked_orders
    WHERE order_id = p_order_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    -- Prevent stale or duplicate advancement requests.
    IF v_order.status <> p_expected_status THEN
        RAISE EXCEPTION
            'Order status changed. Please refresh and try again.';
    END IF;

    -- Validate the permitted delivery sequence.
    v_valid_next_status := CASE v_order.status
        WHEN 'ORDER_PLACED' THEN 'PROCESSING'
        WHEN 'PROCESSING' THEN 'PACKED'
        WHEN 'PACKED' THEN 'SHIPPED'
        WHEN 'SHIPPED' THEN 'OUT_FOR_DELIVERY'
        WHEN 'OUT_FOR_DELIVERY' THEN 'DELIVERED'
        ELSE NULL
    END;

    IF v_valid_next_status IS NULL
       OR v_valid_next_status <> p_next_status THEN
        RAISE EXCEPTION 'Invalid delivery status transition.';
    END IF;

    -- Update the order status.
    UPDATE public.tracked_orders
    SET
        status = p_next_status,
        updated_at = p_event_timestamp
    WHERE order_id = p_order_id
      AND user_id = p_user_id
    RETURNING * INTO v_order;

    -- Insert the corresponding timeline event.
    INSERT INTO public.tracking_events (
        order_id,
        status,
        title,
        description,
        timestamp
    )
    VALUES (
        p_order_id,
        p_next_status,
        p_event_title,
        p_event_description,
        p_event_timestamp
    );

    RETURN NEXT v_order;
END;
$$;

-- Only the server-side service role may execute this function.
REVOKE ALL ON FUNCTION public.advance_tracked_order_with_event(
    TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.advance_tracked_order_with_event(
    TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;
