BEGIN;

CREATE OR REPLACE FUNCTION public.progress_due_tracked_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_order RECORD;
    v_next_status TEXT;
    v_title TEXT;
    v_description TEXT;
    v_processed INTEGER := 0;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    FOR v_order IN
        SELECT order_id, user_id, status
        FROM public.tracked_orders
        WHERE status IN (
            'ORDER_PLACED',
            'PROCESSING',
            'PACKED',
            'SHIPPED',
            'OUT_FOR_DELIVERY'
        )
        AND updated_at <= v_now - INTERVAL '5 minutes'
        ORDER BY updated_at
        LIMIT 100
    LOOP
        BEGIN
            CASE v_order.status
                WHEN 'ORDER_PLACED' THEN
                    v_next_status := 'PROCESSING';
                    v_title := 'Order processing started';
                    v_description := 'Your order is being prepared.';

                WHEN 'PROCESSING' THEN
                    v_next_status := 'PACKED';
                    v_title := 'Order packed';
                    v_description := 'Your order has been packed.';

                WHEN 'PACKED' THEN
                    v_next_status := 'SHIPPED';
                    v_title := 'Order shipped';
                    v_description := 'Your order has been handed to the delivery carrier.';

                WHEN 'SHIPPED' THEN
                    v_next_status := 'OUT_FOR_DELIVERY';
                    v_title := 'Out for delivery';
                    v_description := 'Your order is on its way to you.';

                WHEN 'OUT_FOR_DELIVERY' THEN
                    v_next_status := 'DELIVERED';
                    v_title := 'Order delivered';
                    v_description := 'Your order has been marked as delivered.';
            END CASE;

            PERFORM 1
            FROM public.advance_tracked_order_with_event(
                v_order.order_id,
                v_order.user_id,
                v_order.status,
                v_next_status,
                v_title,
                v_description,
                v_now
            );

            v_processed := v_processed + 1;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not progress order %: %',
                v_order.order_id, SQLERRM;
        END;
    END LOOP;

    RETURN v_processed;
END;
$function$;

REVOKE ALL ON FUNCTION public.progress_due_tracked_orders()
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.progress_due_tracked_orders()
    TO postgres, service_role;

SELECT cron.schedule(
    'progress-due-tracked-orders',
    '* * * * *',
    'SELECT public.progress_due_tracked_orders();'
);

COMMIT;
