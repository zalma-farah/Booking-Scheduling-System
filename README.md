# Booking and Scheduling System

React frontend, Flask API, Supabase Authentication and PostgreSQL.
Users browse rooms, reserve future slots, view history, cancel and rebook.
University administrators manage only their assigned university.

## Project status - November 20, 2026

The user-page styling, admin layout cleanup, Active/Archived filters and safe
inventory deletion were merged into `main` in PR #19 (`6bc8ed1`).
This follow-up adds deletion regression tests and updates the setup instructions.

Earlier integration work was reviewed at these commits:

| Source | Reviewed commit | Work integrated |
| --- | --- | --- |
| main | 345871b | Existing booking application and edit panel |
| sketchie-backend-api | 5ec1ea5 | Admin editing, slot/reservation endpoints and Python tests |
| admin-pages | 2adcf91 | Location Edit buttons |
| samir-ui-workflow-tests | ee2627c | Browser/mobile/accessibility test setup |
| Marie | 2014fab | Room-availability display idea and base UI, adapted onto current main |

Additional fixes: university scoping, migrations 003/004/005, archive/restore,
room editing, reservation panel, safe edit retry/pending behavior, test setup.
These files being present is NOT proof of deployment or a completed submission.
Use the tests and manual acceptance checklist below before the showcase.

## Current status

Implemented features:

- Registration, confirmation, login/logout, persistent sessions and protected routes.
- Active-user and administrator verification using the user's JWT, not a service key.
- Resource browsing, availability, booking, history, cancellation and rebooking.
- Location -> room -> time-slot selection.
- University assignment required for admin operations, scoped API lists and database policies.
- Editing location name/address and room name/description. Parent/ownership transfers are blocked.
- Archive/restore for locations and rooms; activation controls for future unbooked slots.
- Active/Archived inventory filters and typed confirmation for permanent deletion
  of empty archived rooms or locations, restricted to the admin's university.
- Matching personal dashboard, resource browsing and My bookings navigation/styles.
- Public read-only room kiosk and phone-booking QR code (migration 007).
- Guest same-screen walk-in booking, public room directory and scoped admin cancellation (migration 008).
- University reservation listing and cancellation, separate from personal My bookings.
- Repeatable Python unit tests, embedded database checks and Playwright scenarios.

Still required before the showcase:

1. Confirm the target DEVELOPMENT database has the required migrations and admin
   assignments. Do not rerun migrations that have already succeeded.
2. Complete live SDSU/UCSD permission, booking and concurrency acceptance checks.
3. Run browser tests with a disposable regular-user account and record actual results.
4. Check the updated participant pages on desktop and phone-sized screens.
5. Prepare demo hosting and verify two physical Wi-Fi clients, restart and recovery.
   The same Mac can host the server and show the presentation; a second host
   computer is not required. Server setup is a separate follow-up, not installed
   by the development commands below.
6. Final presentation, video, summary and any instructor-required contribution/AI-use records.

RFID/card check-in is not included; the room-status display is described below.
Confirm the exact due date/rubric; do not assume
hardware or an optional feature is required without checking with the instructor.

## Team ownership

| Person | Responsibility and immediate handoff |
| --- | --- |
| Tony | Review/apply shared SQL, explicit university assignments, release coordination and reviewed merges |
| Skechie | Flask contracts, university permission matrix, live race test and backend fixes |
| Zalma | Admin management panels; test editing, archives, two-room selection and reservations |
| Sammy | Participant UX, mobile/browser checks and recorded results; coordinate shared styles with Zalma |
| Marie | Mac hosting/network setup, two-client Wi-Fi evidence and restart instructions |

One person applies shared migrations. Do not edit the same files simultaneously.
Use a feature branch and small PR; do not delete another person's branch until
its work is merged and they confirm no unpushed work depends on it.

## Local setup

Use Node 22.12+ (Node 24 LTS recommended), Python 3.12+ and Git.
VS Code is an editor, not the server. Keep `.env`, `.env.e2e`, `.venv`, node_modules,
test traces and passwords out of Git. Commit example files with placeholders only.

From the repository root on macOS:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
test -f backend/.env || cp backend/.env.example backend/.env
test -f frontend/.env || cp frontend/.env.example frontend/.env
npm --prefix frontend ci
```

Copy the example env files only if your local `.env` files do not exist; do not
overwrite working credentials. Existing checkouts can keep their virtual environment.

Fill the local environment files with your project's URL and publishable key.
Never place a Supabase secret/service-role key in frontend variables.

Terminal 1, from the root:

```bash
./backend/.venv/bin/python backend/app.py
```

Terminal 2:

```bash
npm --prefix frontend run dev
```

Open http://localhost:5173 (or Vite's displayed URL). These are local development
commands, not the final network deployment. Hosting/HTTPS configuration follows
after the integrated application is accepted; do not expose Flask debug mode.

## Database setup and upgrades

**Back up the shared database first.** These migrations remove broad admin access.
Administrators without an explicit assignment will lose management access by design.
Every existing location is assigned to SDSU, as confirmed by the project owner.
Running the setup/migration scripts does not delete inventory or booking history.

For a NEW database, apply `database/schema.sql`, then migrations 001 through 008
in numerical order in the Supabase SQL Editor as the trusted database owner.
For an existing database, do NOT rerun `schema.sql` or successful migrations.
Apply only missing upgrades, in order, during a coordinated pause in app writes:

1. `database/migrations/003_organization_access.sql`
2. `database/migrations/004_managed_operations.sql`
3. `database/migrations/005_safe_inventory_deletion.sql`
4. `database/migrations/006_room_kiosk_status.sql`
5. `database/migrations/007_public_room_kiosk.sql`
6. `database/migrations/008_guest_walk_in.sql`
7. Edit the placeholders in `database/setup/assign_organization_admin.sql` and
   run it as the trusted database owner for each existing administrator.

If 007 already succeeded, install ONLY 008. Otherwise install missing upgrades
in numerical order. Never rerun successful migrations. An "already
exists" error on a repeated `CREATE FUNCTION` does not mean you should drop the
function or reset the schema. Stop and verify rather than rerunning old scripts.
This read-only query checks whether the expected deletion RPC is present:

```sql
SELECT to_regprocedure('public.delete_archived_inventory(text,bigint)')
       IS NOT NULL AS safe_deletion_installed;
```

`true` confirms the function signature exists, not that every live permission or
network behavior has been tested. Saving a SQL file in VS Code or running
`npm --prefix database test` does not install it into your Supabase project.

Assignment does not promote an account. The profile must already be active and
have role `administrator`. Use SDSU or UCSD explicitly; do not infer privileges
from email domains. Global roles and assignments are owner-only setup tasks.
Keep emails/private setup copies uncommitted. Stop on SQL errors; do not bypass
the migration's policy preflight or weaken RLS to make it run.

Migration 004 serializes inventory/booking writes with a shared transaction lock.
This is intentionally conservative for a small classroom workload, not a high-throughput design.
Do not add mutation paths that bypass those guards.

## Removing old locations, rooms and slots

Locations and Rooms & resources open on **Active**. Switch to **Archived** to
see archived records and their restore/delete actions. An active room under an
archived location is hidden from users; it is not automatically archived itself.

Use **Archive location**, **Archive room**, or **Deactivate slot** in Administration.
These hide inventory from booking, rather than physically deleting historical data.
Confirmation is required. Current/upcoming active reservations block archiving;
cancel those reservations explicitly first. Historical/cancelled bookings remain.

Restoring a location makes its still-active child rooms visible again. Restoring
a room can make its existing active future slots bookable again. Child flags are
not silently rewritten. Restore the location before restoring an archived room.
Existing overlapping/inactive slots still participate in the overlap constraint:
reactivate the existing slot rather than inserting a duplicate time range.

**Delete permanently** appears only for archived rooms and locations. Type
`DELETE` and confirm. The backend and database recheck these rules:

- The caller must be an active administrator with an active university assignment.
- SDSU admins can delete only SDSU inventory; UCSD admins only UCSD inventory.
- The selected record must already be archived.
- A location must have no rooms, including archived rooms.
- A room must have no time slots, including unused or inactive slots. This also
  preserves active, cancelled and historical reservations linked through slots.
- There is no cascading deletion. Records with linked data must stay archived.

Deletion cannot be undone. Test it only with disposable empty records you intend
to remove. A timeout may happen after a successful delete: refresh before another
attempt. Direct table DELETE privileges remain revoked; the guarded RPC performs
the operation. Installing migration 005 by itself deletes nothing.

Ownership transfer, global user administration, slot deletion, rescheduling and
automatic no-show cancellation are not part of this release.

## Tests and acceptance

### Room-status kiosk integration

Guest same-screen walk-in booking is described in [WALK_IN_SETUP.md](docs/WALK_IN_SETUP.md).
The sign-in page links to /walk-in; each room kiosk offers immediate guest
reservations only inside active admin-created availability, capped at two hours,
the next reservation and midnight. Guests cannot cancel. Scoped administrators
see Walk-in reservation rows and can cancel while retaining history. No fake
accounts are used. This deliberately anonymous demo mode cannot verify physical
presence or prevent remote misuse; see the guide before any public deployment.

The display-only kiosk builds on Marie's room-availability work, integrated
against current main without reverting the newer admin/user pages.
See [KIOSK_SETUP.md](docs/KIOSK_SETUP.md) for migration 007, public viewing,
phone-booking QR configuration, iPad handoff and limits. Install only missing
migrations in order; if 007 succeeded, install only 008. This does not install hosting.
For a fresh database, apply schema.sql followed by migrations 001 through 008.

Green means no active reservation; BOOKED NOW means a scheduled reservation,
not verified occupancy. RFID/card check-in is not implemented.
The kiosk no longer requires personal sign-in. A separate public RPC exposes
only active room/location names, today's active slot times/IDs and booked booleans.
This information is deliberately public by room ID, not private behind a secret URL.
No reservation identities or direct table access are exposed. The original 006
RPC remains authenticated; account booking and management routes stay protected.
The QR code is generated locally and sends visitors to that room's booking page
on their own phone. Login/registration preserve the room destination. Migration
008 separately adds same-screen guest booking. It fails closed when offline, stale or invalid.
Physical iPad/phone scanning and hosting still require live testing.

The merged PR #19 passed GitHub Actions, frontend lint/build, 86 Python tests
(one live test skipped), and 29 embedded database checks. Those earlier CI checks
did not cover migration 005. This follow-up adds the missing deletion API tests
and makes the existing database test command install and exercise 005 in a fresh
disposable local database. The existing GitHub Actions workflow discovers the
new Python tests and runs the updated database harness without extra CI settings.

Local verification of the deletion-test follow-up on November 20: 129 Python tests passed,
one live race test was skipped, and 54 embedded database checks plus the three
legacy rollback SQL scripts passed. These are local results, not a claim that
this follow-up has already been pushed or passed remote CI.

Local kiosk integration checks on November 21: 164 Python tests passed (one live
test skipped), 76 embedded SQL checks passed, and 22 frontend schedule-model
tests passed. Additional isolated React interaction checks covered refresh,
cancellation, offline/recovery, stale responses, invalid data and cleanup.
Frontend lint/build passed with the existing chunk-size warning. Actual browser,
physical-iPad, live Supabase and network checks are not claimed as passed.

Local public-kiosk follow-up on November 22: 178 Python tests passed (one live
test skipped), 99 embedded SQL checks passed, and 46 frontend model/link/QR tests
passed. Lint/build and isolated real-component/API-client checks passed. Production
dependency audit found no reported vulnerabilities. These are local checks, not
remote CI, a physical QR scan, live Supabase migration verification or iPad testing.

Local guest walk-in follow-up: 215 Python tests passed (one live test skipped),
137 embedded SQL checks passed, and 63 frontend model/link/confirmation tests
passed. Lint, a production build with synthetic environment values and isolated
real-React guest form checks passed. Browser scenarios were discovered, not run;
no live Supabase, physical iPad or multi-connection race pass is claimed.

Default tests do not write to live Supabase. API tests mock authentication/RPC
responses, while embedded SQL tests verify university permissions, archived-only
deletion, linked-record rejection, preserved history, repeated deletion, and
successful removal of empty archived records. SQL denial tests check the expected
SQLSTATE, not just any exception. These are not physical-device or race tests.

Browser execution with real test credentials, live concurrency and physical Wi-Fi
checks still need recorded results. The build retains the existing non-blocking
large-JavaScript-chunk warning. Never count a skipped/live-unrun test as passing.

```bash
npm --prefix frontend run lint
npm --prefix frontend run test:kiosk
npm --prefix frontend run build
cd backend
.venv/bin/python -m pytest -q
cd ../database
npm ci
npm test
```

Database tests create a disposable embedded PostgreSQL instance with synthetic
Auth identities, schema and migrations 001 through 008. They test real SQL
policies/triggers/functions but NOT live Supabase Auth, PostgREST or multi-connection
races. No live credentials are needed. The three legacy SQL scripts roll back
their fixtures; the rest of the harness uses its own disposable database.

Browser setup: see `frontend/tests/e2e/README.md`. Run from frontend:

```bash
npx playwright install chromium
cp .env.e2e.example .env.e2e
npm run test:e2e
```

Use a disposable confirmed regular user. Several UI tests mock API results;
passing them does not prove live database permissions or real mobile/Wi-Fi behavior.
Test discovery (`--list`) is not a passing browser run.

Live concurrency is opt-in and WRITES a reservation to a disposable DEVELOPMENT
slot. Start Flask separately. Set LIVE_API_URL, LIVE_USER_ONE_TOKEN,
LIVE_USER_TWO_TOKEN and LIVE_TIME_SLOT_ID privately, then run from backend:

```bash
.venv/bin/python -m pytest --run-live tests/test_concurrent_booking.py -q
```

Use two different accounts and a fresh unbooked future slot. Verify the final
database has one active booking. The test cancels its winning booking after the
state checks; inspect/clean the disposable fixture if a request fails or times out.
Never put tokens into Git or shared screenshots.

Manual release checklist:

- SDSU admin succeeds on SDSU; UCSD admin succeeds on UCSD.
- Both cross-university writes/cancellations fail; management lists stay scoped.
- Ordinary, inactive and unassigned accounts cannot manage inventory.
- Create two rooms and slots; stored room IDs match the choices.
- Edit/save, refresh, blank optional details, validation errors and lost responses.
- Archive/restore works; booked inventory is protected and history survives.
- Archived empty records can be permanently deleted only after typed confirmation;
  active/foreign/linked records cannot, and cancelled booking history survives.
- Book -> personal history -> cancel -> refresh -> rebook, including two clients.
- True concurrent booking: one 201, one 409, exactly one active database row.
- Log out, direct URL refresh, account switching and phone-sized layout.
- Mac-hosted deployment, a second device over Wi-Fi, offline feedback and restart.

## Main pages and new management API

Pages: /login, /register, /walk-in, /dashboard, /resources, /resources/:resourceId/slots,
/resources/:resourceId/kiosk,
/bookings and /admin. Admin sections: locations, resources, slots, reservations,
checks (for example /admin?section=reservations).

| Method / route | Purpose |
| --- | --- |
| GET /api/resources/:id/status | Active signed-in room-status display; requires migration 006 |
| GET /api/public/rooms/:id/status | No sign-in; limited read-only room schedule; requires migration 007 |
| GET /api/public/walk-in/rooms | Public active room directory; cursor pagination; requires 008 |
| GET /api/public/rooms/:id/walk-in | Verified current guest reservation window |
| POST /api/public/rooms/:id/walk-in | Idempotent bounded guest booking; end_time + request_id only |
| GET /api/admin/walk-ins | Assigned university guest reservations |
| POST /api/admin/walk-ins/:id/cancel | Scoped administrator guest cancellation |
| GET /api/admin/organization | Trusted current university |
| GET/POST /api/admin/locations | Scoped directory/create |
| PATCH /api/admin/locations/:id | Name/address only |
| POST /api/admin/locations/:id/archive or /restore | Reversible visibility |
| DELETE /api/admin/locations/:id | Permanently delete an empty archived location |
| GET/POST /api/admin/resources | Scoped directory/create |
| PATCH /api/admin/resources/:id | Name/description only |
| POST /api/admin/resources/:id/archive or /restore | Reversible visibility |
| DELETE /api/admin/resources/:id | Permanently delete an archived room with no slots |
| GET/POST /api/admin/time-slots | Scoped upcoming slots/create |
| PATCH /api/admin/time-slots/:id | Boolean is_active only |
| GET /api/admin/bookings | Scoped latest 100; status/resource_id filters |
| POST /api/admin/bookings/:id/cancel | Managed cancellation preserving history |

Existing /api/me, health, resource browsing, personal /api/bookings and owner-only
cancellation routes remain. No browser-supplied university or owner grants authority.

Admin location/resource lists accept `?state=active`, `?state=archived`, or
`?state=all` (the API default). Filtering happens before the latest-100 limit.
Deletion requests require JSON `{"confirmation":"DELETE"}`. Ownership is checked
from the authenticated account, never a university ID in the request body.

## Before merging or deleting branches

Run tests, inspect the diff, confirm the development database checklist, and get
one teammate to review. Record the tested commit and actual results in the PR.
Do not call skipped/live-unrun tests passing. Only then merge the integration
branch, update local main, and delete the superseded branches after team confirmation.
Keep server implementation on its own new branch after this acceptance checkpoint.
