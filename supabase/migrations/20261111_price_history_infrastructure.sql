
CREATE TABLE IF NOT EXISTS public.price_history_cache (
  product_id text PRIMARY KEY,
  response jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS price_history_cache_expires_idx
  ON public.price_history_cache (expires_at);

CREATE TABLE IF NOT EXISTS public.price_history_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0)
);

ALTER TABLE public.price_history_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.price_history_cache
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.price_history_rate_limits
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.price_history_cache TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.price_history_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_price_history_rate_limit(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_window_seconds integer DEFAULT 60
)
RETURNS TABLE (
  allowed boolean,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_started_at timestamptz;
  v_count integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Rate limit parameters must be positive';
  END IF;

  INSERT INTO public.price_history_rate_limits AS limits
    (user_id, window_started_at, request_count)
  VALUES (p_user_id, v_now, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    window_started_at = CASE
      WHEN limits.window_started_at <=
        v_now - make_interval(secs => p_window_seconds)
      THEN v_now
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <=
        v_now - make_interval(secs => p_window_seconds)
      THEN 1
      ELSE limits.request_count + 1
    END
  RETURNING window_started_at, request_count
  INTO v_started_at, v_count;

  RETURN QUERY
  SELECT
    v_count <= p_limit,
    GREATEST(
      1,
      CEIL(
        EXTRACT(EPOCH FROM (
          v_started_at +
          make_interval(secs => p_window_seconds) -
          v_now
        ))
      )::integer
    );
END;
$$;

REVOKE ALL ON FUNCTION
  public.consume_price_history_rate_limit(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.consume_price_history_rate_limit(uuid, integer, integer)
  TO service_role;
