-- Run once after 004, as the database owner in the Supabase SQL Editor.
-- Installs an explicit deletion operation; running this migration deletes NO rows.
-- Direct browser DELETE privileges remain revoked. There is no cascade deletion.
BEGIN;

DO $preflight$
BEGIN
    IF to_regprocedure('public.serialize_inventory_write()') IS NULL
       OR to_regprocedure('public.can_manage_location(bigint)') IS NULL
       OR to_regprocedure('public.can_manage_resource(bigint)') IS NULL THEN
        RAISE EXCEPTION 'Apply organization access (003) and managed operations (004) first';
    END IF;
END;
$preflight$;

CREATE FUNCTION public.delete_archived_inventory(record_kind TEXT, record_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    active_value BOOLEAN;
    deleted_id BIGINT;
BEGIN
    IF record_kind IS NULL OR record_kind NOT IN ('locations', 'resources')
       OR record_id IS NULL OR record_id < 1 THEN
        RAISE EXCEPTION 'Invalid deletion request' USING ERRCODE = '22023';
    END IF;
    -- Same lock as booking, slot, archive and restore operations in 004.
    PERFORM pg_catalog.pg_advisory_xact_lock(576, 1);

    IF record_kind = 'locations' THEN
        IF NOT public.can_manage_location(record_id) THEN
            RAISE EXCEPTION 'Record not found or not managed by this account' USING ERRCODE = '42501';
        END IF;
        SELECT l.is_active INTO active_value FROM public.locations l
        WHERE l.id = record_id FOR UPDATE;
        IF active_value IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Archive the location before deleting it' USING ERRCODE = '23514';
        END IF;
        IF EXISTS (SELECT 1 FROM public.resources r WHERE r.location_id = record_id) THEN
            RAISE EXCEPTION 'This location still has rooms; keep it archived' USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.locations l WHERE l.id = record_id RETURNING l.id INTO deleted_id;
    ELSE
        IF NOT public.can_manage_resource(record_id) THEN
            RAISE EXCEPTION 'Record not found or not managed by this account' USING ERRCODE = '42501';
        END IF;
        SELECT r.is_active INTO active_value FROM public.resources r
        WHERE r.id = record_id FOR UPDATE;
        IF active_value IS DISTINCT FROM FALSE THEN
            RAISE EXCEPTION 'Archive the room before deleting it' USING ERRCODE = '23514';
        END IF;
        -- All slots block deletion, even unused/inactive slots. Bookings and
        -- their history therefore cannot be removed indirectly by this RPC.
        IF EXISTS (SELECT 1 FROM public.time_slots s WHERE s.resource_id = record_id) THEN
            RAISE EXCEPTION 'This room has time slots or history; keep it archived' USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.resources r WHERE r.id = record_id RETURNING r.id INTO deleted_id;
    END IF;
    IF deleted_id IS NULL THEN
        RAISE EXCEPTION 'Record not found or not managed by this account' USING ERRCODE = '42501';
    END IF;
    RETURN pg_catalog.jsonb_build_object('id', deleted_id, 'type', record_kind, 'deleted', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_archived_inventory(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_archived_inventory(TEXT, BIGINT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
