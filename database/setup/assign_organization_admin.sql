-- Run only in the Supabase SQL Editor as the project/database owner.
-- EDIT admin_email below. Do not put passwords, API keys, or tokens in this file.
-- This assigns ONE already-active administrator. It does not promote a regular user.
-- Use organization_code = 'UCSD' when assigning a separate UCSD administrator.
-- An existing different assignment is rejected instead of silently transferred.

BEGIN;
DO $setup$
DECLARE
    admin_email TEXT := 'REPLACE_WITH_YOUR_ADMIN_EMAIL';
    organization_code TEXT := 'SDSU';
    admin_id UUID;
    organization_id_value BIGINT;
    match_count INTEGER;
    previous_organization_id BIGINT;
BEGIN
    IF admin_email = 'REPLACE_WITH_YOUR_ADMIN_EMAIL' OR btrim(admin_email) = '' THEN
        RAISE EXCEPTION 'Set admin_email to the exact email of your existing administrator first';
    END IF;

    SELECT count(*) INTO match_count FROM public.profiles
    WHERE email = btrim(admin_email) AND role = 'administrator' AND is_active = TRUE;
    IF match_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one active administrator with that exact email; no assignment changed';
    END IF;
    SELECT id INTO admin_id FROM public.profiles
    WHERE email = btrim(admin_email) AND role = 'administrator' AND is_active = TRUE;

    SELECT id INTO organization_id_value FROM public.organizations WHERE code = organization_code;
    IF organization_id_value IS NULL THEN
        RAISE EXCEPTION 'Organization code not found; no assignment changed';
    END IF;

    SELECT organization_id INTO previous_organization_id
    FROM public.organization_admins WHERE user_id = admin_id FOR UPDATE;
    IF previous_organization_id IS NOT NULL AND previous_organization_id <> organization_id_value THEN
        RAISE EXCEPTION 'Administrator already belongs to another university; review ownership before transferring';
    END IF;

    INSERT INTO public.organization_admins (user_id, organization_id, is_active)
    VALUES (admin_id, organization_id_value, TRUE)
    ON CONFLICT (user_id) DO UPDATE SET is_active = TRUE
    WHERE organization_admins.organization_id = EXCLUDED.organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment changed concurrently; no assignment changed';
    END IF;
END;
$setup$;
COMMIT;

SELECT organization.code, organization.name, count(assignment.user_id) AS active_admin_count
FROM public.organizations AS organization
LEFT JOIN public.organization_admins AS assignment
    ON assignment.organization_id = organization.id AND assignment.is_active = TRUE
GROUP BY organization.id, organization.code, organization.name
ORDER BY organization.code;
