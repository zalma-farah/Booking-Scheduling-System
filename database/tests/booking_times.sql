BEGIN;

-- Create isolated test data.
-- All inserted rows are rolled back at the end.

DO $setup$
DECLARE
    test_user_id UUID;
    test_location_id BIGINT;
    test_resource_id BIGINT;
    future_slot_id BIGINT;
    past_slot_id BIGINT;
BEGIN
    SELECT id
    INTO test_user_id
    FROM public.profiles
    WHERE role = 'user'
      AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;

    IF test_user_id IS NULL THEN
        RAISE EXCEPTION 'No active regular test user was found';
    END IF;

    INSERT INTO public.locations (name)
    VALUES ('Temporary booking-rule test')
    RETURNING id INTO test_location_id;

    INSERT INTO public.resources (location_id, name)
    VALUES (test_location_id, 'Temporary test room')
    RETURNING id INTO test_resource_id;

    INSERT INTO public.time_slots (
        resource_id,
        start_time,
        end_time
    )
    VALUES (
        test_resource_id,
        NOW() + INTERVAL '2 days',
        NOW() + INTERVAL '2 days 1 hour'
    )
    RETURNING id INTO future_slot_id;

    INSERT INTO public.time_slots (
        resource_id,
        start_time,
        end_time
    )
    VALUES (
        test_resource_id,
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days' + INTERVAL '1 hour'
    )
    RETURNING id INTO past_slot_id;

    PERFORM set_config(
        'booking_test.user_id', test_user_id::TEXT, TRUE
    );

    PERFORM set_config(
        'booking_test.future_slot', future_slot_id::TEXT, TRUE
    );

    PERFORM set_config(
        'booking_test.past_slot', past_slot_id::TEXT, TRUE
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
BEGIN
    -- Confirm we are testing with the intended user permissions.
    IF current_user <> 'authenticated'
       OR auth.uid() IS DISTINCT FROM
           current_setting('booking_test.user_id')::UUID
    THEN
        RAISE EXCEPTION 'FAIL: test user identity was not configured';
    END IF;

    -- Test 1: a valid future booking must succeed.
    INSERT INTO public.bookings (user_id, time_slot_id)
    VALUES (
        auth.uid(),
        current_setting('booking_test.future_slot')::BIGINT
    );

    -- Test 2: a past booking must be rejected.
    BEGIN
        INSERT INTO public.bookings (user_id, time_slot_id)
        VALUES (
            auth.uid(),
            current_setting('booking_test.past_slot')::BIGINT
        );

        RAISE EXCEPTION 'FAIL: a past slot was accepted';

    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL; -- Expected rejection by the booking policy.
    END;
END;
$test$;

ROLLBACK;

SELECT *
FROM (
    VALUES
        ('Future slot booking', 'PASS: allowed'),
        ('Past slot booking', 'PASS: rejected')
) AS results(test, result);