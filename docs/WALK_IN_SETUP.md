# Guest walk-in booking (migration 008)

This is an incremental update ON TOP OF the public-kiosk-booking patch and 007.
It does not include or reapply 007. Keep the current public-kiosk-booking branch
and preserve its uncommitted changes. Do not switch back to main while applying
this follow-up, and do not rerun successful SQL migrations.

## Visitor flow

The sign-in page has a secondary **Walk-in room booking — no account needed**
link to /walk-in. The public directory lists active rooms and active parent
locations, with pagination. Choosing a room opens its existing kiosk URL.
The room iPad can stay directly on that URL; there is no login step.

On the kiosk, choose 30 minutes, 60 minutes, or **Until available period ends**
(only choices that fit are offered). Review the end time and press **Confirm
guest reservation**. The reservation starts at the DATABASE's current time,
not at a supplied user start time. Verified success shows a confirmation, refreshes
the red room status, then resets the form after 20 seconds. No account, name,
email or card is collected. A card reader and occupancy sensor are not included.

## Enabled hours and limits

Walk-ins require an active room, active location, and an ACTIVE admin-created
time slot that covers now. No slots today means no walk-in booking, even though
the display says AVAILABLE (no reservation now). Green is not permission to
invent opening hours. Use existing Time slots tools to establish availability.
Those tools create FUTURE slots: create them before opening time and wait for
the start; do not disable guards or change database clocks to test.

Adjacent unbooked active slots can join into one continuous walk-in period.
An inactive slot, gap, booked slot, next guest booking, San Diego midnight or
two-hour maximum stops the period. A minimum of five minutes must remain at
confirmation. No extensions, future guest bookings or arbitrary custom start
times are accepted. Example: at 5 PM, enabled slots 5–6 and 6–7, with a reservation
at 7, permit a walk-in ending at or before 7 PM. If enabled hours stop at 6,
the visitor cannot reserve until 7 just because no booking exists in that gap.

## Data integrity and access

Migration 008 creates walk_in_bookings separately from account bookings. It does
not manufacture users, alter existing booking ownership, split/rewrite time slots,
delete data, disable RLS or give anonymous callers table/sequence privileges.
The history is retained; resource and source-slot foreign keys restrict deletion.

All guest creation, account booking and inventory mutations use the same advisory
transaction lock introduced in 004. The database rechecks bounds inside that lock;
a guest-range exclusion constraint also rejects overlapping guest reservations.
Additional guards prevent an account booking from overlapping a guest period,
and prevent archive/slot-disable actions while a current/upcoming guest requires
the inventory. These are invariant tests, not a measured multi-connection race test.

The public and signed-in kiosk RPCs now show non-overlapping display segments
around guest intervals. Display segment IDs are local schedule identifiers,
NOT bookable time-slot IDs. The existing signed-in availability RPC also reports
future slots blocked by guest reservations. Booking the remaining part of a future
account slot is not added; ordinary account reservations still use whole slots.

Guest writes use a narrowly bounded public RPC and the existing publishable key,
not a service-role key. Guests cannot list records, cancel, delete, update,
choose an account, supply their own start time or exceed the verified window.
They can read the same limited public room/schedule information added in 007.

## Confirmation and retries

Before sending, the kiosk stores a random UUID and requested end time in sessionStorage.
This opaque ID is not a login token and grants no cancellation access. There is
no automatic POST retry. A timeout does not prove that the write failed: the
form shows **Check confirmation**, which resends the SAME ID/end time. The RPC
returns the existing result instead of duplicating a booking. Refreshing the
same browser tab retains an uncertain confirmation; do not clear its storage or
start another tab to bypass it. If an administrator already cancelled it, a retry
reports that cancellation rather than reserving again.

## Administrator flow

Reservations lists both account bookings and **Walk-in reservation** rows for
the administrator's assigned university. IDs live in separate namespaces; the UI
uses distinct row keys and cancellation endpoints. Only the assigned active
administrator can cancel a guest. This preserves history and releases its period.
Guests have no public cancellation endpoint or reusable personal booking history.

## Install and test

1. Stop local app servers and apply guest-walk-in.patch to the working tree that
   already has the public-kiosk-booking patch. Do not apply either patch twice.
2. In the Supabase SQL Editor, run ONLY the complete
   database/migrations/008_guest_walk_in.sql as database owner ONCE after 007.
   If it errors, stop; do not drop functions, reset schema or disable policies.
3. Restart backend/frontend. No new package dependency is added by this follow-up.
4. In an incognito browser, open the sign-in page, use the Walk-in link, then
   choose an active room. A current unbooked enabled slot is required to reserve.
5. Reserve 30 minutes. Verify confirmation and red status on a second display.
6. Check admin Reservations: verify Walk-in reservation, correct times/university,
   and cancellation. Confirm another university/admin and regular users cannot cancel.
7. Verify cancellation releases the period and preserves history. A second guest,
   an account booking or a stale page must not overwrite the original reservation.
8. Test offline/stale status, timeout/retry, page reload, 20-second form reset,
   missing hours, gaps, the next reservation, maximum duration and actual iPad touch.

Normal development commands from booking-system: run backend/.venv/bin/python
backend/app.py and npm --prefix frontend run dev in separate terminals.
The public kiosk and walk-in form work locally without hosting or a phone QR code.
Access from an iPad still requires the separate LAN/HTTPS hosting setup.

Local verification: Python and embedded PostgreSQL tests plus frontend model
tests, lint, a build with synthetic environment values, and isolated real-React
form checks. No live database, actual browser/iPad or production security pass
is claimed. Never run database fixture scripts on live Supabase.

## Anonymous-booking trade-off

A public guest cannot be verified as physically present or identified as a unique
person. Someone who can reach the public endpoints can reserve enabled periods
remotely; CORS and client-side limits do not stop that. This is a trusted demo/LAN
walk-in mode, not an abuse-resistant public deployment. Do not expose this guest
write endpoint/RPC on the public internet for real operations without a separate
design for device authorization/presence verification and rate limiting. Edge
controls on Flask alone do not protect a directly callable Supabase anon RPC.
Walk-in activity can interfere with real users, so coordinate the demo with the team.
