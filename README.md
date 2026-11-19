# Booking and Scheduling System

React frontend, Flask API, Supabase Authentication and PostgreSQL.
Users browse rooms, reserve future slots, view history, cancel and rebook.
University administrators manage only their assigned university.

## Integration candidate - November 18, 2026

This candidate combines the work reviewed at these commits:

| Source | Reviewed commit | Work integrated |
| --- | --- | --- |
| main | 345871b | Existing booking application and edit panel |
| sketchie-backend-api | 5ec1ea5 | Admin editing, slot/reservation endpoints and Python tests |
| admin-pages | 2adcf91 | Location Edit buttons |
| samir-ui-workflow-tests | ee2627c | Browser/mobile/accessibility test setup |

Additional fixes: university scoping, migrations 003/004, archive/restore,
room editing, reservation panel, safe edit retry/pending behavior, test setup.
These files being present is NOT proof of deployment or a completed submission.
Do not merge until the development Supabase and manual acceptance checks below pass.

## Current status

Implemented in this candidate:

- Registration, confirmation, login/logout, persistent sessions and protected routes.
- Active-user and administrator verification using the user's JWT, not a service key.
- Resource browsing, availability, booking, history, cancellation and rebooking.
- Location -> room -> time-slot selection.
- University assignment required for admin operations, scoped API lists and database policies.
- Editing location name/address and room name/description. Parent/ownership transfers are blocked.
- Archive/restore for locations and rooms; activation controls for future unbooked slots.
- University reservation listing and cancellation, separate from personal My bookings.
- Repeatable Python unit tests, embedded database checks and Playwright scenarios.

Still required before the showcase:

1. Apply/review migrations and explicit admin assignments on the DEVELOPMENT Supabase project.
2. Complete live SDSU/UCSD permission, booking and concurrency acceptance checks.
3. Run browser tests with a disposable regular-user account and record actual results.
4. Finish the agreed participant-page styling/navigation work with Sammy and Zalma.
5. Set up the second Mac host and verify two physical Wi-Fi clients, restart and recovery.
6. Final presentation, video, summary and any instructor-required contribution/AI-use records.

RFID/kiosk work is not included. Confirm the exact due date/rubric; do not assume
hardware or an optional feature is required without checking with the instructor.

## Team ownership

| Person | Responsibility and immediate handoff |
| --- | --- |
| Tony | Review/apply shared SQL, explicit university assignments, release coordination and reviewed merges |
| Skechie | Flask contracts, university permission matrix, live race test and backend fixes |
| Zalma | Admin management panels; test editing, archives, two-room selection and reservations |
| Sammy | Participant UX, mobile/browser checks and recorded results; coordinate shared styles with Zalma |
| Marie | Second Mac setup, hosting/network, two-client Wi-Fi evidence and restart instructions |

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
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm --prefix frontend ci
```

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
No booking history or inventory IDs are deleted.

For a NEW database, apply `database/schema.sql`, then migrations 001 through 004.
For the existing project, do NOT rerun schema.sql or old migrations. Verify 001/002
are already applied; stop app writes during the coordinated upgrade, then apply:

1. `database/migrations/003_organization_access.sql`
2. `database/migrations/004_managed_operations.sql`
3. Edit the placeholders in `database/setup/assign_organization_admin.sql` and
   run it as the trusted database owner for each existing administrator.

Assignment does not promote an account. The profile must already be active and
have role `administrator`. Use SDSU or UCSD explicitly; do not infer privileges
from email domains. Global roles and assignments are owner-only setup tasks.
Keep emails/private setup copies uncommitted. Stop on SQL errors; do not bypass
the migration's policy preflight or weaken RLS to make it run.

Migration 004 serializes inventory/booking writes with a shared transaction lock.
This is intentionally conservative for a small classroom workload, not a high-throughput design.
Do not add mutation paths that bypass those guards.

## Removing old locations, rooms and slots

Use **Archive location**, **Archive room**, or **Deactivate slot** in Administration.
These hide inventory from booking, rather than physically deleting historical data.
Confirmation is required. Current/upcoming active reservations block archiving;
cancel those reservations explicitly first. Historical/cancelled bookings remain.

Restoring a location makes its still-active child rooms visible again. Restoring
a room can make its existing active future slots bookable again. Child flags are
not silently rewritten. Restore the location before restoring an archived room.
Existing overlapping/inactive slots still participate in the overlap constraint:
reactivate the existing slot rather than inserting a duplicate time range.

Permanent inventory deletion, ownership transfer, global user administration,
rescheduling and automatic no-show cancellation are not part of this release.

## Tests and acceptance

Local candidate checks on November 18: frontend lint/build passed; 86 Python
tests passed and the live race test was skipped; 29 embedded database checks and
all three rollback SQL scripts passed. Two isolated React regression checks passed.
Playwright discovered 30 desktop/mobile test entries, but browser execution with
real test credentials, live Supabase and physical Wi-Fi checks is still pending.
The build retains the existing non-blocking large-JavaScript-chunk warning.
GitHub Actions has been added but has not run until this candidate is pushed.

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
cd backend
.venv/bin/python -m pytest -q
cd ../database
npm ci
npm test
```

Database tests create a disposable embedded PostgreSQL instance with synthetic
Auth identities. They test real SQL policies/triggers but NOT live Supabase Auth,
PostgREST or multi-connection races. The SQL tests roll back their temporary changes.

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
- Book -> personal history -> cancel -> refresh -> rebook, including two clients.
- True concurrent booking: one 201, one 409, exactly one active database row.
- Log out, direct URL refresh, account switching and phone-sized layout.
- Second-Mac deployment, physical Wi-Fi access, offline feedback and restart.

## Main pages and new management API

Pages: /login, /register, /dashboard, /resources, /resources/:resourceId/slots,
/bookings and /admin. Admin sections: locations, resources, slots, reservations,
checks (for example /admin?section=reservations).

| Method / route | Purpose |
| --- | --- |
| GET /api/admin/organization | Trusted current university |
| GET/POST /api/admin/locations | Scoped directory/create |
| PATCH /api/admin/locations/:id | Name/address only |
| POST /api/admin/locations/:id/archive or /restore | Reversible visibility |
| GET/POST /api/admin/resources | Scoped directory/create |
| PATCH /api/admin/resources/:id | Name/description only |
| POST /api/admin/resources/:id/archive or /restore | Reversible visibility |
| GET/POST /api/admin/time-slots | Scoped upcoming slots/create |
| PATCH /api/admin/time-slots/:id | Boolean is_active only |
| GET /api/admin/bookings | Scoped latest 100; status/resource_id filters |
| POST /api/admin/bookings/:id/cancel | Managed cancellation preserving history |

Existing /api/me, health, resource browsing, personal /api/bookings and owner-only
cancellation routes remain. No browser-supplied university or owner grants authority.

## Before merging or deleting branches

Run tests, inspect the diff, confirm the development database checklist, and get
one teammate to review. Record the tested commit and actual results in the PR.
Do not call skipped/live-unrun tests passing. Only then merge the integration
branch, update local main, and delete the superseded branches after team confirmation.
Keep server implementation on its own new branch after this acceptance checkpoint.
