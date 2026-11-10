BEGIN;

-- Find an active regular test user.
-- No email addresses or keys are needed.

DO $$
DECLARE
    test_user_id UUID;
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

    -- Simulate this user's authenticated database identity.
    PERFORM set_config(
        'request.jwt.claim.sub',
        test_user_id::TEXT,
        TRUE
    );

    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', test_user_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );

    -- Temporary change, undone by ROLLBACK below.
    UPDATE public.profiles
    SET is_active = FALSE
    WHERE id = test_user_id;
END;
$$;

SET LOCAL ROLE authenticated;

DO $$
BEGIN
    BEGIN
        -- An invalid ID ensures no real booking is cancelled.
        -- The inactive-account check must reject us first.
        PERFORM public.cancel_own_booking(-1);

        RAISE EXCEPTION
            'FAIL: the inactive account was not blocked';

    EXCEPTION
        WHEN insufficient_privilege THEN
            IF SQLERRM <> 'An active account is required' THEN
                RAISE;
            END IF;
    END;
END;
$$;

ROLLBACK;

SELECT
    'PASS: inactive account rejected; temporary change rolled back.'
    AS result;