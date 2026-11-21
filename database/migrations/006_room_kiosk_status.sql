-- Apply once after 005, as the database owner. Read-only functions; no data writes.
-- Uses a new RPC name so any private prototype of get_resource_today_status
-- is not overwritten or trusted. Do not drop existing functions to install this.
BEGIN;

DO $preflight$
BEGIN
    IF to_regprocedure('public.is_active_account()') IS NULL
       OR to_regprocedure('public.delete_archived_inventory(text,bigint)') IS NULL THEN
        RAISE EXCEPTION 'Apply migrations 003 through 005 first';
    END IF;
END;
$preflight$;

-- Private calculation helper: local midnights, not a fixed 24-hour UTC window.
-- San Diego days can be 23 or 25 hours at daylight-saving transitions.
CREATE FUNCTION public.kiosk_day_bounds(observed_at TIMESTAMPTZ)
RETURNS TABLE(day_start TIMESTAMPTZ, day_end TIMESTAMPTZ)
LANGUAGE sql STABLE STRICT SET search_path = '' AS $$
    SELECT
        date_trunc('day', observed_at AT TIME ZONE 'America/Los_Angeles')
            AT TIME ZONE 'America/Los_Angeles',
        (date_trunc('day', observed_at AT TIME ZONE 'America/Los_Angeles') + interval '1 day')
            AT TIME ZONE 'America/Los_Angeles';
$$;

CREATE FUNCTION public.get_room_kiosk_status(p_resource_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    observed_at TIMESTAMPTZ := clock_timestamp();
    first_instant TIMESTAMPTZ;
    last_instant TIMESTAMPTZ;
    snapshot JSONB;
BEGIN
    IF NOT public.is_active_account() THEN
        RAISE EXCEPTION 'An active signed-in account is required' USING ERRCODE = '42501';
    END IF;
    IF p_resource_id IS NULL OR p_resource_id < 1 THEN
        RAISE EXCEPTION 'Invalid resource ID' USING ERRCODE = '22023';
    END IF;
    SELECT b.day_start, b.day_end INTO first_instant, last_instant
    FROM public.kiosk_day_bounds(observed_at) b;

    -- SECURITY DEFINER is needed to aggregate other users' reservations.
    -- Expose only a booking boolean, never users, booking IDs, or account data.
    -- A single SELECT reads room visibility and schedule in one snapshot.
    SELECT jsonb_build_object(
        'timezone', 'America/Los_Angeles',
        'checked_at', observed_at,
        'day_start', first_instant,
        'day_end', last_instant,
        'resource', jsonb_build_object(
            'id', r.id, 'name', r.name,
            'location', jsonb_build_object('id', l.id, 'name', l.name)
        ),
        'slots', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id, 'start_time', s.start_time, 'end_time', s.end_time,
                'is_booked', EXISTS (
                    SELECT 1 FROM public.bookings b
                    WHERE b.time_slot_id = s.id AND b.status = 'active'
                )
            ) ORDER BY s.start_time, s.id)
            FROM (
                SELECT slot.id, slot.start_time, slot.end_time
                FROM public.time_slots slot
                WHERE slot.resource_id = r.id AND slot.is_active = TRUE
                  AND slot.start_time < last_instant AND slot.end_time > first_instant
                ORDER BY slot.start_time, slot.id
                LIMIT 501 -- API rejects >500 instead of showing a truncated green screen.
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

REVOKE ALL ON FUNCTION public.kiosk_day_bounds(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_room_kiosk_status(BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_kiosk_status(BIGINT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
