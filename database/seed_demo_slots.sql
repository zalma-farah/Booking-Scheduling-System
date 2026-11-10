-- Demo slots for tomorrow in America/Los_Angeles.
-- Existing records are preserved.

BEGIN;

WITH demo_resource AS (
    SELECT resource.id
    FROM public.resources AS resource
    JOIN public.locations AS location
        ON location.id = resource.location_id
    WHERE resource.name = 'Demo Study Room'
      AND location.name = 'Wireless Demo Location'
      AND resource.is_active = TRUE
      AND location.is_active = TRUE
    ORDER BY resource.id
    LIMIT 1
),
demo_day AS (
    SELECT (
        (
            (NOW() AT TIME ZONE 'America/Los_Angeles')::date + 1
        ) + TIME '09:00'
    ) AT TIME ZONE 'America/Los_Angeles' AS first_start
)
INSERT INTO public.time_slots (
    resource_id,
    start_time,
    end_time
)
SELECT
    resource.id,
    demo_day.first_start + sequence.number * INTERVAL '1 hour',
    demo_day.first_start + (sequence.number + 1) * INTERVAL '1 hour'
FROM demo_resource AS resource
CROSS JOIN demo_day
CROSS JOIN generate_series(0, 2) AS sequence(number)
WHERE TRUE
ON CONFLICT DO NOTHING;

COMMIT;

-- Display tomorrow's demo slots in San Diego time.
SELECT
    slot.id,
    resource.name AS resource,
    slot.start_time AT TIME ZONE 'America/Los_Angeles'
        AS local_start,
    slot.end_time AT TIME ZONE 'America/Los_Angeles'
        AS local_end,
    slot.is_active
FROM public.time_slots AS slot
JOIN public.resources AS resource
    ON resource.id = slot.resource_id
JOIN public.locations AS location
    ON location.id = resource.location_id
WHERE resource.name = 'Demo Study Room'
  AND location.name = 'Wireless Demo Location'
  AND (
      slot.start_time AT TIME ZONE 'America/Los_Angeles'
  )::date = (
      NOW() AT TIME ZONE 'America/Los_Angeles'
  )::date + 1
ORDER BY slot.start_time;