BEGIN;

CREATE OR REPLACE FUNCTION public.get_resource_availability(
    p_resource_id BIGINT
)
RETURNS TABLE (
    id BIGINT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    is_available BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Only active, signed-in accounts may request availability.
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.id = auth.uid()
          AND profile.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'An active account is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_resource_id IS NULL OR p_resource_id <= 0 THEN
        RAISE EXCEPTION 'Invalid resource ID'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT
        slot.id,
        slot.start_time,
        slot.end_time,
        NOT EXISTS (
            SELECT 1
            FROM public.bookings AS booking
            WHERE booking.time_slot_id = slot.id
              AND booking.status = 'active'
        ) AS is_available
    FROM public.time_slots AS slot
    JOIN public.resources AS resource
        ON resource.id = slot.resource_id
    JOIN public.locations AS location
        ON location.id = resource.location_id
    WHERE resource.id = p_resource_id
      AND resource.is_active = TRUE
      AND location.is_active = TRUE
      AND slot.is_active = TRUE
      AND slot.start_time > NOW()
      AND slot.start_time < NOW() + INTERVAL '30 days'
    ORDER BY slot.start_time, slot.id
    LIMIT 100;
END;
$$;

-- Remove default access, then allow signed-in accounts only.
REVOKE ALL
ON FUNCTION public.get_resource_availability(BIGINT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.get_resource_availability(BIGINT)
TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;