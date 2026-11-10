BEGIN;

DO $setup$
DECLARE
    test_user_id UUID;
    other_user_id UUID;
    test_location_id BIGINT;
    test_resource_id BIGINT;
    own_slot_id BIGINT;
    other_slot_id BIGINT;
    own_booking_id BIGINT;
    other_booking_id BIGINT;
BEGIN
    SELECT id
    INTO test_user_id
    FROM public.profiles
    WHERE role = 'user'
      AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT id
    INTO other_user_id
    FROM public.profiles
    WHERE id <> test_user_id
      AND is_active = TRUE
    ORDER BY created_at
    LIMIT 1;

    IF test_user_id IS NULL OR other_user_id IS NULL THEN
        RAISE EXCEPTION 'Two different active accounts are required';
    END IF;

    INSERT INTO public.locations (name)
    VALUES ('Temporary ownership test')
    RETURNING id INTO test_location_id;

    INSERT INTO public.resources (location_id, name)
    VALUES (test_location_id, 'Temporary ownership test room')
    RETURNING id INTO test_resource_id;

    INSERT INTO public.time_slots (
        resource_id, start_time, end_time
    )
    VALUES (
        test_resource_id,
        NOW() + INTERVAL '2 days',
        NOW() + INTERVAL '2 days 1 hour'
    )
    RETURNING id INTO own_slot_id;

    INSERT INTO public.time_slots (
        resource_id, start_time, end_time
    )
    VALUES (
        test_resource_id,
        NOW() + INTERVAL '3 days',
        NOW() + INTERVAL '3 days 1 hour'
    )
    RETURNING id INTO other_slot_id;

    -- Create fixtures as the database administrator.
    -- Cancellation will be tested as the regular user below.

    INSERT INTO public.bookings (user_id, time_slot_id)
    VALUES (test_user_id, own_slot_id)
    RETURNING id INTO own_booking_id;

    INSERT INTO public.bookings (user_id, time_slot_id)
    VALUES (other_user_id, other_slot_id)
    RETURNING id INTO other_booking_id;

    PERFORM set_config(
        'booking_test.context',
        json_build_object(
            'user_id', test_user_id,
            'resource_id', test_resource_id,
            'own_slot_id', own_slot_id,
            'other_slot_id', other_slot_id,
            'own_booking_id', own_booking_id,
            'other_booking_id', other_booking_id
        )::TEXT,
        TRUE
    );

    PERFORM set_config(
        'request.jwt.claim.sub', test_user_id::TEXT, TRUE
    );

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', test_user_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
END;
$setup$;

SET LOCAL ROLE authenticated;

DO $test$
DECLARE
    test_data JSONB :=
        current_setting('booking_test.context')::JSONB;
    cancellation_denied BOOLEAN := FALSE;
BEGIN
    IF current_user <> 'authenticated'
       OR auth.uid() IS DISTINCT FROM
           (test_data ->> 'user_id')::UUID
    THEN
        RAISE EXCEPTION 'FAIL: test user identity was not configured';
    END IF;

    -- Test 1: reject cancellation of someone else's booking.
    BEGIN
        PERFORM public.cancel_own_booking(
            (test_data ->> 'other_booking_id')::BIGINT
        );
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM <>
                'Booking not found, already cancelled, or does not belong to user'
            THEN
                RAISE;
            END IF;

            cancellation_denied := TRUE;
    END;

    IF NOT cancellation_denied THEN
        RAISE EXCEPTION
            'FAIL: another account''s booking could be cancelled';
    END IF;

    -- Test 2: allow cancellation of our own booking.
    PERFORM public.cancel_own_booking(
        (test_data ->> 'own_booking_id')::BIGINT
    );

    IF NOT EXISTS (
        SELECT 1
        FROM public.bookings
        WHERE id = (test_data ->> 'own_booking_id')::BIGINT
          AND user_id = auth.uid()
          AND status = 'cancelled'
          AND cancelled_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'FAIL: own booking was not properly cancelled';
    END IF;

    -- Test 3: the cancelled slot must become available.
    IF NOT EXISTS (
        SELECT 1
        FROM public.get_resource_availability(
            (test_data ->> 'resource_id')::BIGINT
        ) AS slot
        WHERE slot.id = (test_data ->> 'own_slot_id')::BIGINT
          AND slot.is_available = TRUE
    ) THEN
        RAISE EXCEPTION 'FAIL: cancelled slot did not become available';
    END IF;

    -- The other account's slot must remain booked.
    IF NOT EXISTS (
        SELECT 1
        FROM public.get_resource_availability(
            (test_data ->> 'resource_id')::BIGINT
        ) AS slot
        WHERE slot.id = (test_data ->> 'other_slot_id')::BIGINT
          AND slot.is_available = FALSE
    ) THEN
        RAISE EXCEPTION 'FAIL: the other account''s booking was affected';
    END IF;
END;
$test$;

ROLLBACK;

SELECT *
FROM (
    VALUES
        ('Cancel another account''s booking', 'PASS: rejected'),
        ('Cancel own booking', 'PASS: cancelled'),
        ('Availability after cancellation', 'PASS: slot reopened')
) AS results(test, result);