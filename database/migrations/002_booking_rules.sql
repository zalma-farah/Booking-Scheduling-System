BEGIN;

-- Allow new bookings only for the signed-in user,
-- while their account and the selected slot are active.
-- The slot must not have started yet.

ALTER POLICY "Users can create valid bookings"
ON public.bookings
WITH CHECK (
    user_id = auth.uid()

    AND status = 'active'

    AND cancelled_at IS NULL

    AND EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.id = auth.uid()
          AND profile.is_active = TRUE
    )

    AND EXISTS (
        SELECT 1
        FROM public.time_slots AS slot
        JOIN public.resources AS resource
            ON resource.id = slot.resource_id
        JOIN public.locations AS location
            ON location.id = resource.location_id
        WHERE slot.id = bookings.time_slot_id
          AND slot.is_active = TRUE
          AND slot.start_time > NOW()
          AND resource.is_active = TRUE
          AND location.is_active = TRUE
    )
);


-- Only active accounts may cancel their own active bookings.
-- Keep the existing function name and parameter.

CREATE OR REPLACE FUNCTION public.cancel_own_booking(
    booking_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_id UUID := auth.uid();
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles AS profile
        WHERE profile.id = caller_id
          AND profile.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'An active account is required'
            USING ERRCODE = '42501';
    END IF;

    IF booking_id IS NULL OR booking_id <= 0 THEN
        RAISE EXCEPTION 'Invalid booking ID'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.bookings AS booking
    SET
        status = 'cancelled',
        cancelled_at = NOW()
    WHERE booking.id = booking_id
      AND booking.user_id = caller_id
      AND booking.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Booking not found, already cancelled, or does not belong to user';
    END IF;
END;
$$;


-- Restrict direct execution to signed-in accounts.
-- The function also checks account status and ownership.

REVOKE ALL
ON FUNCTION public.cancel_own_booking(BIGINT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.cancel_own_booking(BIGINT)
TO authenticated;


NOTIFY pgrst, 'reload schema';

COMMIT;