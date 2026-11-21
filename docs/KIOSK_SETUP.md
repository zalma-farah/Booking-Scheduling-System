# Room-status kiosk: Mac first, then iPad

This integrates Marie's display idea from commit 2014fab with current main
ea631aa. It preserves the newer user/admin pages, university management,
archives, and safe deletion. Do not merge the older Marie branch wholesale.

## What this feature does

- Open an active resource's **Room availability** link.
- Green **AVAILABLE** means no active reservation right now.
- Red **BOOKED NOW** means a scheduled active reservation overlaps the current
  server time. It does not prove that a person entered the room.
- Show today's active slots in San Diego time, including slots crossing midnight.
- Refresh about ten seconds after the preceding request completes. Requests
  don't overlap. Data older than 30 seconds is not displayed as available.
- Use a gray screen for offline/stale/invalid data or unavailable rooms.
- Refresh when the page returns from background/sleep or the connection returns.
- Display room/location names and booking booleans, never reservation names,
  emails, account IDs, or booking IDs.

This is NOT RFID check-in, a door lock, an occupancy sensor, a public anonymous
display, or the server deployment. An active signed-in test account is required.
Ordinary accounts can see booking status for active rooms they can already browse;
admin writes remain restricted to the assigned university.

## 1. Integrate the files

Start from an updated clean main on a new branch, for example kiosk-integration.
Preserve unrelated local changes. This update includes frontend, backend,
migration, documentation and test files. No new package dependency is needed.

Keep your existing private .env files. Do not replace the project folder,
run schema.sql again, or reapply migrations 003/004/005.

## 2. Install ONLY the new SQL function

You already installed 005. In the target development Supabase project's SQL
Editor, open a new query and paste the entire contents of:

`database/migrations/006_room_kiosk_status.sql`

Run it once as the project/database owner. It installs read-only functions and
does not delete or change inventory or bookings. It uses the new RPC name
`get_room_kiosk_status`, not any untracked prototype named
`get_resource_today_status`. The date-boundary helper cannot be executed by
browser users. Direct booking-table access is not widened.

If an installation error occurs, stop and share it. Don't drop functions or
disable RLS to make it work. After a successful installation, don't run 006 again.
This read-only check confirms the expected signature exists:

```sql
SELECT to_regprocedure('public.get_room_kiosk_status(bigint)')
       IS NOT NULL AS kiosk_installed;
```

## 3. Test on the Mac

Keep the existing development frontend/backend environment configuration.
From booking-system, start Flask in one terminal:

```bash
./backend/.venv/bin/python backend/app.py
```

Start Vite in another:

```bash
npm --prefix frontend run dev
```

Open Vite's displayed localhost address, sign in, then go to Resource tab.
For an active resource, select **Room availability**. The URL is:

`/resources/RESOURCE_ID/kiosk`

No separate room-name lookup or first-100-resource search is needed: the status
RPC returns the requested active room and its schedule in one response.
If all test resources were archived earlier, restore their location and room first.

## 4. Verify the complete reservation flow

Use disposable accounts and rooms only:

1. Create an active room and a future slot today, starting a few minutes from now.
2. Open its kiosk in a second browser/profile and sign in with a test account.
3. On the first browser, reserve that slot. Before its start, the kiosk should
   show AVAILABLE with the upcoming booking time.
4. When the slot starts, the screen should show BOOKED NOW. It should return to
   AVAILABLE after cancellation (if permitted by booking rules) or when it ends.
   Allow about ten seconds for booking changes, or use Refresh room status.
5. Stop Flask or disconnect the display device. It must turn gray, not keep an
   old green status. Restore access and confirm it recovers.
6. Check an empty active room, an invalid room URL, an archived room and a room
   under an archived location. Only the active room can show availability.
7. Exit the kiosk and confirm Resource tab, My bookings, admin tools, history,
   archive/restore and deletion still work.

The kiosk is read-only: it never creates, cancels, checks in or deletes a booking.
An archived room with active reservations should already be blocked by the
existing management safeguards; don't bypass them for testing.

## 5. Connect the iPad after hosting is ready

The kiosk runs in a browser. The Mac can host and present simultaneously, while
the iPad uses the Mac's address on the same permitted Wi-Fi/hotspot. Internet
is still required for Supabase. Typing localhost on the iPad points to the iPad,
not the Mac. Merely exposing Vite does not fix a frontend API base still set
to 127.0.0.1:5000.

The separate same-Mac hosting setup must be integrated/tested before claiming
that this kiosk works across devices. This kiosk update does not install or
expose a server, change firewall settings, or configure HTTPS.

On the real iPad, verify portrait/landscape sizing, touch controls, sleep/wake,
sign-in persistence, offline recovery and Safari behavior. Full screen is
feature-detected; where unsupported, use Safari's Add to Home Screen for a
standalone display if available. A fallback message does not stop the kiosk.
Keep the device powered, awake and supervised for the demonstration. Exit and
sign out afterward. It is not a hardened unattended device account.

Use disposable accounts on any temporary trusted-LAN HTTP demo. Public or real
user deployment needs HTTPS and a separate security/deployment review.

## Automated checks

```bash
npm --prefix frontend run lint
npm --prefix frontend run test:kiosk
npm --prefix frontend run build
cd backend
./.venv/bin/python -m pytest -q
cd ../database
npm test
```

The API suite mocks external HTTP. The database harness installs 001 through 006
into a disposable local embedded PostgreSQL instance and checks privacy, active
visibility, cancelled bookings, overnight slots, DST boundaries and permissions.
It temporarily seeds historical reservations as the test owner, only inside that
discardable database; never copy fixture setup to live SQL.

Playwright adds kiosk route, cancellation display, offline/recovery and viewport
scenarios using a disposable regular-user login and mocked room-status responses.
See frontend/tests/e2e/README.md for credentials/configuration. Running --list is
test discovery, not a passing browser test. Neither mocked browser tests nor the
local SQL harness prove that physical iPad networking or live Supabase works.

The review environment could not start the browser tests because its Playwright
browser executable was missing. No browser/iPad pass is claimed. Install the
browser and supply disposable test credentials on your own permitted test setup
before running the actual browser suite.
