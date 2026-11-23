-- Apply ONCE after 006 as the database owner. No inventory or booking writes.
-- Explicitly publishes active room/location names, today's slot times and booked
-- booleans. No identities, booking IDs, descriptions, addresses or future days.
-- Do not grant anonymous table access or weaken existing authenticated RPCs.
BEGIN;
DO $preflight$
BEGIN
    IF to_regprocedure('public.get_room_kiosk_status(bigint)') IS NULL THEN
        RAISE EXCEPTION 'Apply migration 006 first';
    END IF;
END;
$preflight$;

CREATE FUNCTION public.get_public_room_kiosk_status(p_resource_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    observed_at TIMESTAMPTZ := clock_timestamp();
    first_instant TIMESTAMPTZ;
    last_instant TIMESTAMPTZ;
    snapshot JSONB;
BEGIN
    IF p_resource_id IS NULL OR p_resource_id < 1 OR p_resource_id > 9007199254740991 THEN
        RAISE EXCEPTION 'Invalid resource ID' USING ERRCODE = '22023';
    END IF;
    SELECT b.day_start, b.day_end INTO first_instant, last_instant
    FROM public.kiosk_day_bounds(observed_at) b;
    -- Deliberate, narrow public projection. One snapshot; no dynamic SQL.
    SELECT jsonb_build_object(
        'timezone', 'America/Los_Angeles', 'checked_at', observed_at,
        'day_start', first_instant, 'day_end', last_instant,
        'resource', jsonb_build_object('id', r.id, 'name', r.name,
            'location', jsonb_build_object('id', l.id, 'name', l.name)),
        'slots', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id, 'start_time', s.start_time, 'end_time', s.end_time,
                'is_booked', EXISTS (SELECT 1 FROM public.bookings b
                    WHERE b.time_slot_id = s.id AND b.status = 'active')
            ) ORDER BY s.start_time, s.id)
            FROM (
                SELECT slot.id, slot.start_time, slot.end_time
                FROM public.time_slots slot
                WHERE slot.resource_id = r.id AND slot.is_active = TRUE
                  AND slot.start_time < last_instant AND slot.end_time > first_instant
                ORDER BY slot.start_time, slot.id
                LIMIT 501 -- The API fails closed rather than truncate a busy schedule.
            ) s
        ), '[]'::jsonb)
    ) INTO snapshot
    FROM public.resources r JOIN public.locations l ON l.id = r.location_id
    WHERE r.id = p_resource_id AND r.is_active = TRUE AND l.is_active = TRUE;
    IF snapshot IS NULL THEN
        RAISE EXCEPTION 'Room unavailable or not found' USING ERRCODE = 'P0002';
    END IF;
    RETURN snapshot;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_room_kiosk_status(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_room_kiosk_status(BIGINT) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
