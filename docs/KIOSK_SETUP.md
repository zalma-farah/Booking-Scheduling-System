# Public room kiosk and phone booking

Guest same-screen booking is now added by migration 008. See
[WALK_IN_SETUP.md](WALK_IN_SETUP.md) for installation, enabled hours, admin cancellation
and anonymous-booking limitations. The sections below describe the original 007
public viewing/phone handoff; 008 adds narrowly bounded guest writes separately.

Builds on Marie's original kiosk work (2014fab), integrated in PR #21.
This follow-up is based on main e9f7ce7. Keep the original contribution history.

## What changes

- Anyone can open /resources/ROOM_ID/kiosk without a personal account.
- Green means no reservation NOW; red means BOOKED NOW, not physical occupancy.
- Today’s schedule uses San Diego time and includes overnight overlaps.
- Gray means offline, stale, invalid or unavailable. Polls do not overlap.
- A locally generated QR code opens /resources/ROOM_ID/slots on the visitor’s phone.
- Visitors sign in on their own phone. Login and registration keep the room destination.
- Creating/cancelling bookings and admin actions still require active accounts.
- The shared display does not create bookings, accept personal passwords or scan cards.
- Only existing future slots can be reserved. This does not add arbitrary-duration
  walk-in reservations, immediate booking of a slot that already started, or check-in.

## Public information and permissions

Migration 007 deliberately publishes active room/location names and IDs, today’s
active slot times/IDs and whether each slot is booked. Room IDs are not secrets;
people can request another room ID. Do not use this public feature for rooms whose
names or schedule must stay confidential. Addresses, descriptions, booking IDs,
account IDs, names and emails are not returned.

The new RPC get_public_room_kiosk_status(bigint) is SECURITY DEFINER with an empty
search_path, fixed qualified queries and a narrow JSON projection. It performs no
writes. It grants anonymous EXECUTE on this function only, never table access.
The existing authenticated 006 RPC and all booking/admin policies remain intact.
The API uses only the configured Supabase publishable key, not a service-role key,
and does not forward a visitor’s bearer token. It validates and whitelists output.
Public callers can also invoke this limited RPC directly through Supabase; CORS
is not authentication. Internet deployment needs HTTPS and abuse/rate controls
at the hosting/Supabase edge. This patch does not install those controls or hosting.

## Install on your Mac

1. Preserve unrelated changes and update main. Create a new branch, such as
   public-kiosk-booking. Apply the follow-up patch only once.
2. Run npm --prefix frontend ci. The lockfile includes qrcode 1.5.4; no third-party
   QR image service is contacted. Keep your private environment files.
3. In the Supabase SQL Editor, as database owner, run ONLY the complete new file
   database/migrations/007_public_room_kiosk.sql ONCE after successful 006.
   It does not change inventory or reservations. Do not rerun 003–006 or schema.sql.
4. If SQL fails, stop and inspect the error. Never drop functions or disable RLS
   to force an upgrade. Do not execute database test fixtures against live Supabase.
5. Restart backend and frontend after configuration changes.

Read-only installation check:

~~~sql
SELECT to_regprocedure('public.get_public_room_kiosk_status(bigint)')
       IS NOT NULL AS public_kiosk_installed;
~~~

## QR address and network setup

A phone cannot use localhost or 127.0.0.1 on your Mac. The kiosk intentionally
suppresses the QR and explains the problem when its address is loopback.
The status display itself still works locally.

When the frontend is already opened at a phone-accessible origin, the QR uses that
origin by default. Alternatively set this in frontend/.env.local, then restart Vite
(or rebuild the production frontend):

~~~dotenv
VITE_PUBLIC_BOOKING_URL=http://YOUR_MAC_LAN_IP:5173
~~~

Use the actual reachable FRONTEND origin, including its port, without a path,
query, fragment or credentials. The example above is a placeholder, not a usable
address. A real deployment should use an HTTPS origin such as https://booking.example.edu.
This value is public configuration, not a token. The QR contains only the room URL.

This setting DOES NOT configure hosting. The frontend AND backend API must be
reachable by the phone/iPad. VITE_API_URL=http://127.0.0.1:5000 is local-only and
will fail on another device even if the QR opens. Current Flask development
binding/CORS are local-only too. Do not just expose debug Flask to a public network.
The same-Mac hosting integration is a separate next step; use only disposable
accounts during a trusted-LAN HTTP demo. Supabase still needs internet access.

For new-account email confirmation, the Supabase Auth redirect allowlist must
permit the chosen frontend login URL and its safe next query. Test the confirmation
email on that exact deployment. Do not use broad wildcard redirects in production.

## Start existing local development servers

From booking-system, one terminal:

~~~bash
./backend/.venv/bin/python backend/app.py
~~~

Another terminal:

~~~bash
npm --prefix frontend run dev
~~~

Open a known /resources/ROOM_ID/kiosk URL in an incognito browser without signing
in. Use the existing admin account in a DIFFERENT browser/profile to manage fixtures.
No profile or account is needed on the shared display.

## Manual acceptance checklist

- Signed-out visitor can view an active room and today’s schedule.
- No names/emails/booking identifiers appear in the public API payload.
- Archived/missing room and archived parent do not show availability.
- Missing 007/API failure/offline/30-second staleness turns the screen gray.
- Book a future slot from a separate device/account; it appears in the schedule,
  turns red at its start, and returns green after permitted cancellation or expiry.
- On a reachable frontend origin, scan the QR on a phone. It opens that exact room.
- Signed-out phone requests sign-in; sign-in returns to the same room’s slots,
  including for an administrator choosing to book personally.
- Registration and confirmation-email links preserve that destination too.
- Scanning alone creates nothing. Booking is rechecked by the existing server/SQL
  safeguards; another person's booking cannot be overwritten by an old kiosk snapshot.
- Do not enter credentials on the shared iPad. Test portrait/landscape, sleep/wake,
  auto-refresh, fullscreen fallback and offline/reconnect on the actual iPad.
- Verify ordinary bookings, admin tools, archive/restore and deletion still work.

## Automated checks

~~~bash
npm --prefix frontend run lint
npm --prefix frontend run test:kiosk
npm --prefix frontend run build
cd backend
./.venv/bin/python -m pytest -q
cd ..
npm --prefix database test
~~~

Use backend's virtual environment and pytest configuration. Tests mock external API calls or use a
fresh disposable embedded PostgreSQL database. They do not change live Supabase.
The SQL harness exercises existing migrations first, then 007 to prove the old
permissions remain protected. Historical fixtures are only for that disposable DB.

Public kiosk Playwright scenarios no longer require login credentials; booking
workflow tests elsewhere still do. Test discovery is not browser execution.
No automated browser or physical phone/iPad pass is claimed for this update.
Actual QR scanning, email confirmation, networking, live permissions and deployment
must be checked on the target setup before release. RFID, door control and real
occupancy sensing are not included.
