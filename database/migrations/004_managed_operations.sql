-- Apply after 003. No rows are deleted. All application inventory/booking
-- writes share a transaction lock: deliberately simple for a classroom workload.
-- This guards booking-versus-archive/disable races, including direct REST writes.
BEGIN;

CREATE FUNCTION public.serialize_inventory_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(576, 1);
    RETURN NULL;
END;
$$;
CREATE TRIGGER serialize_locations BEFORE INSERT OR UPDATE OR DELETE ON public.locations
FOR EACH STATEMENT EXECUTE FUNCTION public.serialize_inventory_write();
CREATE TRIGGER serialize_resources BEFORE INSERT OR UPDATE OR DELETE ON public.resources
FOR EACH STATEMENT EXECUTE FUNCTION public.serialize_inventory_write();
CREATE TRIGGER serialize_slots BEFORE INSERT OR UPDATE OR DELETE ON public.time_slots
FOR EACH STATEMENT EXECUTE FUNCTION public.serialize_inventory_write();
CREATE TRIGGER serialize_bookings BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH STATEMENT EXECUTE FUNCTION public.serialize_inventory_write();

CREATE FUNCTION public.guard_inventory_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_TABLE_NAME = 'locations' THEN
        IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
            RAISE EXCEPTION 'Location ownership cannot be transferred' USING ERRCODE = '22023';
        END IF;
        IF NOT NEW.is_active AND OLD.is_active AND EXISTS (
            SELECT 1 FROM public.bookings b JOIN public.time_slots s ON s.id = b.time_slot_id
            JOIN public.resources r ON r.id = s.resource_id
            WHERE r.location_id = OLD.id AND b.status = 'active' AND s.end_time > clock_timestamp()
        ) THEN
            RAISE EXCEPTION 'Cancel current/upcoming reservations before archiving this location' USING ERRCODE = '23514';
        END IF;
    ELSIF TG_TABLE_NAME = 'resources' THEN
        IF NEW.id IS DISTINCT FROM OLD.id OR NEW.location_id IS DISTINCT FROM OLD.location_id THEN
            RAISE EXCEPTION 'A room cannot be moved between locations' USING ERRCODE = '22023';
        END IF;
        IF NEW.is_active AND NOT OLD.is_active AND NOT EXISTS (
            SELECT 1 FROM public.locations l WHERE l.id = NEW.location_id AND l.is_active
        ) THEN
            RAISE EXCEPTION 'Restore the parent location first' USING ERRCODE = '23514';
        END IF;
        IF NOT NEW.is_active AND OLD.is_active AND EXISTS (
            SELECT 1 FROM public.bookings b JOIN public.time_slots s ON s.id = b.time_slot_id
            WHERE s.resource_id = OLD.id AND b.status = 'active' AND s.end_time > clock_timestamp()
        ) THEN
            RAISE EXCEPTION 'Cancel current/upcoming reservations before archiving this room' USING ERRCODE = '23514';
        END IF;
    ELSE
        IF NEW.id IS DISTINCT FROM OLD.id OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
           OR NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
            RAISE EXCEPTION 'Existing slot room/times cannot be changed' USING ERRCODE = '22023';
        END IF;
        IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            IF OLD.start_time <= clock_timestamp() OR EXISTS (
                SELECT 1 FROM public.bookings b WHERE b.time_slot_id = OLD.id AND b.status = 'active'
            ) THEN
                RAISE EXCEPTION 'Only future unbooked slots can be changed' USING ERRCODE = '23514';
            END IF;
            IF NEW.is_active AND NOT EXISTS (
                SELECT 1 FROM public.resources r JOIN public.locations l ON l.id = r.location_id
                WHERE r.id = OLD.resource_id AND r.is_active AND l.is_active
            ) THEN
                RAISE EXCEPTION 'Restore the room and location first' USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER guard_location_update BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_update();
CREATE TRIGGER guard_resource_update BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_update();
CREATE TRIGGER guard_slot_update BEFORE UPDATE ON public.time_slots FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_update();

-- Recheck after acquiring the shared lock; a prior statement snapshot alone
-- must not allow a booking for a slot/parent just deactivated by another writer.
CREATE FUNCTION public.guard_new_booking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.time_slots s JOIN public.resources r ON r.id = s.resource_id
        JOIN public.locations l ON l.id = r.location_id
        WHERE s.id = NEW.time_slot_id AND s.is_active AND r.is_active AND l.is_active
          AND s.start_time > clock_timestamp()
    ) THEN
        RAISE EXCEPTION 'Slot is no longer available for a new booking' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER guard_new_booking BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.guard_new_booking();

CREATE FUNCTION public.set_managed_slot_active(slot_id BIGINT, new_is_active BOOLEAN)
RETURNS public.time_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.time_slots;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(576, 1);
    IF slot_id IS NULL OR slot_id < 1 OR new_is_active IS NULL THEN
        RAISE EXCEPTION 'Invalid slot update' USING ERRCODE = '22023';
    END IF;
    IF NOT public.can_manage_slot(slot_id) THEN
        RAISE EXCEPTION 'Slot not found or not managed by this account' USING ERRCODE = '42501';
    END IF;
    -- Validate even a repeated/no-op request to keep the API future/unbooked contract.
    IF EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = slot_id AND s.start_time <= clock_timestamp())
       OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.time_slot_id = slot_id AND b.status = 'active') THEN
        RAISE EXCEPTION 'Only future unbooked slots can be changed' USING ERRCODE = '23514';
    END IF;
    UPDATE public.time_slots s SET is_active = new_is_active WHERE s.id = slot_id RETURNING s.* INTO result;
    RETURN result;
END;
$$;

CREATE FUNCTION public.cancel_managed_booking(booking_id BIGINT)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.bookings;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(576, 1);
    IF booking_id IS NULL OR booking_id < 1 THEN
        RAISE EXCEPTION 'Invalid booking ID' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND public.can_manage_slot(b.time_slot_id)) THEN
        RAISE EXCEPTION 'Booking not found or not managed by this account' USING ERRCODE = '42501';
    END IF;
    UPDATE public.bookings b SET status = 'cancelled', cancelled_at = clock_timestamp()
    WHERE b.id = booking_id AND b.status = 'active' RETURNING b.* INTO result;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking already cancelled'; END IF;
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.serialize_inventory_write(), public.guard_inventory_update(), public.guard_new_booking()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_managed_slot_active(BIGINT, BOOLEAN), public.cancel_managed_booking(BIGINT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_managed_slot_active(BIGINT, BOOLEAN), public.cancel_managed_booking(BIGINT)
TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
