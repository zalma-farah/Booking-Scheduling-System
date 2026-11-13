# Booking and Scheduling System

A school project built with React, Flask and Supabase. Users can reserve rooms
and resources. The final demonstration will show clients using Wi-Fi to access
the application on the team's server.

This README is the team's setup guide and work plan. Start with your named
section, follow the shared schedule, and keep the working features intact.
The team has five members: Tony and Skechie on backend, Zalma and Sammy on
frontend, and Marie on the server. No separate planning documents are required.

## Quick Navigation

- [Current status](#current-status)
- [Page and feature inventory](#page-and-feature-inventory)
- [Missing endpoint contract](#missing-endpoint-contract)
- [Team responsibilities](#team-responsibilities)
- [Tony](#tony) · [Skechie](#skechie) · [Zalma](#zalma) · [Sammy](#sammy) · [Marie](#marie)
- [Handoffs and file ownership](#handoffs-and-file-ownership)
- [Fifteen day plan](#fifteen-day-plan)
- [First day readiness checklist](#first-day-readiness-checklist)
- [Local setup](#local-setup)
- [Existing routes and API](#existing-routes-and-api)
- [Checks before a PR or push](#checks-before-a-pr-or-push)
- [Final demonstration checks](#final-demonstration-checks)

New teammate: run the [local setup](#local-setup), read your named owner section,
then check the inventory rows and handoffs for your work. You do not need our
previous chat or a separate planning document to start. Ask for the approved
configuration and report any missing access before coding around it.

## Current Status

Implemented in `main`:

- Registration, email confirmation, login/logout and persistent sessions.
- User/admin routes, backend token verification and inactive-account blocking.
- Resource browsing and future time-slot availability.
- Booking creation, personal history, cancellation and rebooking.
- Admin forms for creating locations, rooms/resources and future time slots.
- Database protection against overlapping slots and duplicate active bookings.
- Rollback SQL tests for booking times, cancellation ownership and inactive users.

Tony has reported successful local manual checks. The team still needs to test
the integrated build on the actual server and client devices.

Remaining priorities:

1. University-specific admin permissions: SDSU admins manage SDSU resources;
   UCSD admins manage UCSD resources. Current administrator access is global.
2. Clear location-to-room selection when creating slots. The dropdown exists,
   but the reported one-room limitation still needs investigation with real data.
3. Minimal admin detail editing, slot activation and a scoped reservation list/
   cancellation panel, as specified in the management-completion inventory below.
4. Deployment on the team's host and testing from two Wi-Fi client devices.
5. Permission, concurrent-booking and mobile checks on the integrated release.
6. Presentation, video, summary and required contribution/AI-use records.

All existing locations were confirmed to belong to SDSU. Earlier university-access
SQL drafts are paused. Do not apply them to the shared database until Tony and
Skechie coordinate the database and API changes.

## Technology and Connection

- Frontend: React/Vite, React Router, Tailwind CSS and shadcn/ui components.
- Backend: Python/Flask, Flask-CORS and HTTP/JSON requests.
- Authentication and storage: Supabase Auth and PostgreSQL with row-level security.

The browser contacts Supabase for login, sessions and profile loading. For
protected application operations, it sends the access token to Flask. Flask
verifies the account and makes database requests with that user's token.

## Page and Feature Inventory

This inventory separates existing code from planned work. Existing means the
page/route is present in `main`, not that it has passed every deployment test.
Do not rebuild an existing page simply because an older README called it missing.

### Existing pages and panels

| Page or panel | Current location | Work still needed | Owner |
|---|---|---|---|
| Login | `/login`, `LoginPage.jsx` | Regression/mobile checks; do not rewrite auth | Sammy |
| Registration | `/register`, `RegisterPage.jsx` | Confirmation and actual-host redirect checks | Sammy + Tony |
| User dashboard | `/dashboard`, `DashboardPage.jsx` | Clear navigation and mobile checks | Sammy |
| Resource browser | `/resources`, `ResourcesPage.jsx` | Simple location/name filters and useful empty state | Sammy |
| Resource availability and booking | `/resources/:resourceId/slots`, `TimeSlotsPage.jsx` | Preserve booking/conflict/timezone behavior; test deployed flow | Sammy |
| Personal history and cancellation | `/bookings`, `BookingsPage.jsx` | Preserve history/rebooking; verify own bookings only | Sammy |
| Admin shell | `/admin`, `AdminPage.jsx` | Show trusted university context and handle unassigned admins | Zalma |
| Admin locations | `/admin?section=locations`, `LocationsManager.jsx` | Scope list/create; add minimal text editing | Zalma + Skechie |
| Admin resources | `/admin?section=resources`, `ResourcesManager.jsx` | Scope list/create; add minimal text editing | Zalma + Skechie |
| Admin availability | `/admin?section=slots`, `TimeSlotsManager.jsx` | Scope room choices; location-to-room selection; safe slot activation controls | Zalma + Skechie |
| Connection checks | `/admin?section=checks`, `AuthApiCheck.jsx` | Keep as diagnostics; do not confuse these with all management features | Zalma |

The `/` and catch-all routes currently redirect to login. A dedicated 404 page
is not a required feature for this release.

### Missing work to finish the described project

Use the priority labels consistently:

- **Required:** core access, booking correctness and the wireless showcase.
- **Management completion:** finish the basic admin abilities described for the
  project; target Days 6–8 unless the instructor explicitly removes them from scope.
- **Decision needed:** clarify the safe behavior and rubric on Day 1 before coding.
- **Optional:** not in the release unless the rubric requires it and another task
  is explicitly removed. Do not quietly add it during the final week.

| Missing item | Priority | What to build or verify | Owner / dependency |
|---|---|---|---|
| University ownership and explicit admin assignments | Required | Organization/assignment data, scoped RLS and owner-only provisioning; preserve existing SDSU records | Tony first; Skechie reviews |
| Scoped admin API and university context | Required | Existing admin lists/creates become scoped; add current-university response; reject foreign IDs | Skechie after Tony's contract |
| Clear location/room selector | Required | Choose location then authorized room; validate two different saved room IDs | Zalma after scoped API; investigate data immediately |
| Location detail editing | Management completion | Edit `name`/`address` in existing location panel; no university transfer or hard delete | Zalma UI + Skechie API |
| Room detail editing | Management completion | Edit `name`/`description` in existing resource panel; do not move historical rooms between parents | Zalma UI + Skechie API |
| Availability activation controls | Management completion | Activate/deactivate only an authorized future slot with no active booking, using an atomic database guard | Zalma UI + Skechie/Tony backend |
| Organization reservation list | Management completion | New `ReservationsManager.jsx` panel at planned `/admin?section=reservations`; show only managed university bookings | Zalma + Skechie |
| Organization reservation cancellation | Management completion | Confirm cancellation of a managed customer booking and preserve history; foreign bookings denied | Skechie scoped operation; Zalma confirmation UI |
| Participant resource search/filtering | Management completion | Basic name/location controls in existing ResourcesPage; filtering loaded results needs no new API | Sammy; document loaded-list limits |
| User/account management screen | Decision needed | No such panel exists. Decide whether rubric means scoped customer information or global account administration; these are different permissions | Tony gets scope decision; never delegate global roles by default |
| Real concurrent-booking check | Required | Two authenticated requests together, one 201/one 409, one active row | Skechie; Sammy records release result |
| Deployed server and Wi-Fi proof | Required | Actual host, production serving, two clients, deep-route refresh and restart | Marie, in parallel |
| Reproducible app tests | Required | Checked-in API tests and real release results, not only untracked local experiments | Skechie; Tony integrates |
| Automated CI | Useful if time remains | Basic no-secret lint/build/test workflow; do not call it live RLS/Wi-Fi coverage | Tony after test commands stabilize |
| Password recovery pages | Optional unless graded | Planned `/forgot-password` and `/reset-password`; use Supabase Auth recovery and verified redirects, not a homemade password API | Sammy + Tony |
| Rescheduling | Optional unless graded | Not present. If required, use an atomic operation that preserves the original reservation if the new slot cannot be obtained | Skechie + Sammy after explicit scope approval |
| Recurring bookings, reminders and real-time updates | Optional/deferred | Not implemented and not needed for the agreed basic showcase | Do not start without a scope change |

No separate page is needed just to edit a location or room. Add a small edit mode
to the existing panel. The new reservation panel can reuse the admin shell and
query-section navigation; update the section map to recognize `reservations`.
Until implemented, that query is a proposed destination, not a working page.

### User management scope decision

Current profiles contain global role and active-state fields. A customer may book
at more than one university, so an SDSU admin must not disable that customer's
whole account or change their global role and thereby affect UCSD.

For the minimum release, global role/account and university-assignment changes
remain trusted project-owner setup tasks, not a university-admin page. A scoped
reservation list may show booking ID, room, time and status without exposing every
profile. If customer details are required, return only reviewed fields for customers
with a valid connection to that university.

Tony must settle the rubric requirement on Day 1. If a global account-management
UI is mandatory, explicitly design a separate trusted platform-owner permission
before adding that page or its endpoints. Do not build a broad
`PATCH /api/admin/users/:id` route that lets any university admin edit global roles.
An unresolved requirement stays open; it cannot be marked complete by omission.

## Missing Endpoint Contract

The routes below are **proposed, not implemented in current main**. They make
frontend/backend handoffs concrete. Tony and Skechie confirm the contract on
Day 1; if a name or field changes, update this table before the UI depends on it.
All normal database operations continue to use the verified user's token.

| Planned endpoint | Request / result | Rules and completion check | Owner |
|---|---|---|---|
| `GET /api/admin/organization` | No owner body; 200 with `status` and one `organization` object containing `id`, `code`, `name` | Active admin plus active explicit assignment; otherwise deny. Never fall back to all universities | Skechie + Tony |
| `PATCH /api/admin/locations/:locationId` | Allow only supplied `name` and/or `address`; return `status` and updated `location` | Own university; name 1–120 chars, optional address up to 250; reject empty/extra-field requests and university changes | Skechie; Zalma form |
| `PATCH /api/admin/resources/:resourceId` | Allow only supplied `name` and/or `description`; return `status` and updated `resource` | Own university; name 1–120 chars, optional description up to 1000; reject parent/owner changes | Skechie; Zalma form |
| `PATCH /api/admin/time-slots/:slotId` | Only boolean `is_active`; return `status` and updated `slot` | Own university; future slot; no active booking; active parents required to enable. Guard atomically with booking creation, not only a Flask pre-check | Skechie + Tony; Zalma control |
| `GET /api/admin/bookings` | `status=all\|active\|cancelled`, default all; optional validated `resource_id`; return `status` and `bookings` | Scope through slot → room → location → university; newest 100 with stable ordering; reject invalid filters | Skechie; Zalma reservation panel |
| `POST /api/admin/bookings/:bookingId/cancel` | No client owner/status; return `status` and confirmed cancelled `booking` | Active booking in managed university only; update status/time and preserve row. Missing/foreign/already-cancelled response must not leak other customers' data | Skechie + Tony; Zalma confirmation |

Suggested university-context response:

```json
{
  "status": "ok",
  "organization": {
    "id": 1,
    "code": "SDSU",
    "name": "San Diego State University"
  }
}
```

The numeric ID is illustrative. Always use actual IDs returned by the API;
do not hardcode demo fixture IDs into production requests.

Shared error behavior: 400 for invalid fields/filters, 401 for invalid/missing
authentication, 403 for denied role/assignment, agreed generic 404 for a missing
or foreign record, 409 for a booking/state conflict, and 502/503 for an upstream
or uncertain confirmation. PATCH/POST operations must not be retried blindly.

Important implementation rules:

1. The existing six admin list/create endpoints are not missing routes, but all
   need university scoping. A new scope endpoint alone does not secure them.
2. For partial updates, validate supplied fields only, reject unknown fields, and
   verify the record's existing owner before mutation. Do not permit ownership
   transfer through `organization_id`, `location_id`, or `resource_id` changes.
3. Do not edit the times or room of an already-booked slot. This release's slot
   update is activation only; broader schedule edits need a separate reviewed design.
   Existing slot creation requires a start within the next 30 days; keep that
   consistent with the availability query and the frontend explanation.
4. Slot-state changes and booking creation must share an atomic database rule or
   locking strategy. A separate "no booking exists" read followed by a write
   leaves a race. Reject blocked changes with 409 and no partial mutation.
5. The current overlap constraint includes inactive slots too. Deactivation does
   not free the same interval for a duplicate slot record. Reactivate the eligible
   existing slot rather than dropping the overlap constraint as a quick fix.
6. Managed cancellation needs a new scoped database operation, for example a
   reviewed `cancel_managed_booking` RPC. The existing `cancel_own_booking` RPC
   intentionally authorizes the customer owner only; do not weaken it or use a
   privileged API key to make an admin cancellation work.
7. `/api/bookings` remains personal. An SDSU admin's personal UCSD booking can
   appear in My bookings but must not appear as an SDSU-managed reservation.
8. No general DELETE routes are scheduled: preserve history and foreign-key
   protections. No organization-creation or assignment-editing API is exposed
   to ordinary university admins. These are deliberate boundaries, not forgotten routes.

Current create-request fields, which must remain compatible:

| Existing POST endpoint | Browser sends | Server determines |
|---|---|---|
| `/api/admin/locations` | `name`, optional `address` | Authorized university and active initial state |
| `/api/admin/resources` | Selected `location_id`, `name`, optional `description` | Parent authorization and active initial state |
| `/api/admin/time-slots` | Selected `resource_id`, timezone-aware `start_time`, `end_time` | Parent authorization, valid future window and conflict behavior |
| `/api/bookings` | Selected `time_slot_id` | Verified user ID and active booking state |
| `/api/bookings/:bookingId/cancel` | Booking ID in path; no replacement owner/status | Owner authorization, cancellation time and preserved history |

The planned university derivation for location creation is part of the upcoming
scope change. It is not already enforced by the baseline global-admin API.
Use `apiRequest` rather than introducing a second frontend API client.

Register each planned endpoint in Flask with the matching URL parameters and
handler arguments. A React route does not create a backend endpoint. From the
project root, check the actual registered backend routes with:

```bash
./backend/.venv/bin/python -m flask --app backend.app routes
```

Then verify authenticated requests and responses. A missing backend route or a
failed preflight can appear as a fetch/CORS error in the browser; inspect the
route list, HTTP status and server log before weakening CORS or authentication.

## Team Responsibilities

| Person | Area | Main responsibility |
|---|---|---|
| Tony | Backend/database and integration | University ownership and permissions, database tests, shared contracts and merging reviewed work |
| Skechie | Backend/API | Scoped Flask endpoints, request validation, API tests and simultaneous-booking verification |
| Zalma | Admin frontend | Admin dashboard and correct location/room/time-slot selection |
| Sammy | User frontend | Booking/history/cancellation experience, mobile testing and video assembly |
| Marie | Server | Available host, deployment, Wi-Fi access, startup/recovery instructions and network evidence |

These are work assignments, not claims that the tasks are already finished.
Each member should confirm their GitHub username and availability in the team
channel. Do not assume a Discord name is a GitHub username.

### Tony

**Own:** database permissions, backend integration and release coordination.
**Review partner:** Skechie for permissions and API changes; Marie for deployment.

1. On Day 1, confirm the exact deadline, presentation requirements and rubric.
   Confirm the management-completion inventory and settle the user-management
   requirement. Record any instructor-approved cuts rather than leaving missing
   screens undecided until recording day.
2. Review the current schema, migrations 001/002 and shared database. Record what
   has actually run and make a usable backup before changing ownership rules.
   Previously downloaded migration drafts are not proof that anything was applied.
3. Agree with Skechie on the university model: one assigned university per admin,
   several admins allowed per university, locations carry the university ID, and
   rooms/slots/bookings inherit ownership through their parents.
4. Prepare a forward migration rather than rewriting the populated schema. Assign
   existing locations to SDSU and preserve all IDs and booking history. Assign
   admins explicitly through trusted setup; do not infer authority from email domains.
5. Replace broad global-admin database permissions with scoped rules. Check reads,
   creates, updates, parent transfers and cancellations. App accounts must not
   change global roles or grant themselves a university assignment.
6. Test SDSU success, UCSD success, both cross-university failures, inactive and
   unassigned admins, and ordinary user behavior. Use authenticated-role tests,
   not the SQL Editor's database-owner access as proof that RLS works.
7. Run the existing booking/cancellation SQL checks again. Review results with
   Skechie, then coordinate the database/API rollout. Only one person applies
   shared SQL; everyone else requests a reviewed change.
8. Review small PRs, merge dependencies in order and keep this README accurate.
   Record the tested release commit and coordinate the final submission. Each
   owner remains responsible for implementing and fixing their own work.

**Files:** `database/migrations/`, `database/tests/`, reviewed database setup scripts,
and `README.md`. Tony reviews `backend/app.py` changes without independently
rewriting it while Skechie is editing that file.

**First handoff:** by the end of Day 1, give Skechie the agreed assignment/helper
names and data shapes. Aim for verified development-database rules by Day 3.

**Done when:** university isolation and previous booking checks pass, existing
data/history remain intact, and Skechie can use the documented database contract.

### Skechie

**Own:** Flask routes, server-side validation and API test coverage.
**Review partner:** Tony; Zalma and Sammy review the frontend-facing contract.

1. Run the baseline and read `require_auth`, the admin endpoints, booking creation,
   personal history and owner-only cancellation before changing them.
2. Agree with Tony on a university-context response. A possible new route is
   `GET /api/admin/organization`; this is planned, not an existing endpoint.
   Give Zalma a clear response example before she connects the dashboard to it.
3. Keep verifying the actual token and active profile. Resolve the management
   university from trusted database assignments. An admin with no active assignment
   must be denied management access, not treated as an unrestricted admin.
4. Scope admin location/resource/slot lists to that university. Do not return all
   active rooms and expect JavaScript to provide the permission boundary.
5. Authorize each selected parent on writes. For example, an SDSU token submitting
   a UCSD resource ID must not create a UCSD slot, even if the user edits the request.
   Do not trust a browser-supplied owner or university field as permission.
6. Preserve ordinary booking/history/cancellation behavior and forward the user's
   token so database RLS still applies. Keep `/api/bookings` personal for admins
   too; a separate organization reservation view must not replace personal history.
7. Return clear validation, authentication, permission and conflict responses.
   Preserve timezone-aware timestamps, overlap handling and uncertain-write
   recovery. Do not automatically retry a timed-out booking POST.
8. Add repeatable tests with synthetic fixtures. Cover invalid/missing tokens,
   inactive/unassigned accounts, foreign IDs, malformed requests, cancellations
   and conflicts. Separate mocked tests from opt-in live tests that write data.
9. Run a true race with two different authenticated accounts and one fresh future
   slot. Start requests together, then verify one 201, one 409 and one active
   booking. A later click on a stale page is a different, useful conflict test.
10. Implement the management-completion routes in the missing-endpoint table:
    location/resource text edits, safe slot activation, managed reservation list
    and managed cancellation. Coordinate the required database guard/RPC with
    Tony; do not widen customer-owner cancellation permissions.

**Files:** `backend/app.py` and new tests under `backend/tests/`. Coordinate
dependency changes with Tony and server settings with Marie. No backend rewrite
or module split is required just to divide the work.

**First handoff:** publish the agreed endpoint/body/response examples in the PR
and this README by Day 2. Aim for live scoped endpoints by Day 5, with critical
regression/race evidence and the approved management routes by Day 8. Do not
make frontend owners wait silently.

**Done when:** the two university accounts pass the API permission matrix,
ordinary booking behavior is preserved, and another member can run the documented tests.

### Zalma

**Own:** administrator frontend and the location/room/time-slot experience.
**Review partner:** Sammy for usability; Skechie for API requests and scope.

1. Run the existing admin UI and reproduce the reported one-room selector behavior.
   Inspect the returned resource data before assuming the component is broken.
2. Test at least two active, authorized rooms. Two locations alone do not mean two
   rooms exist. Check each room's ID, parent location, active state and university.
3. Keep the current sidebar layout. Add a visible university label using the
   trusted API response; a university picker must not grant access by itself.
4. Make the slot workflow location → room/resource → date/start/end. Changing
   location clears an incompatible room choice. Do not silently select a different
   room when a list fails or the selected room becomes unavailable.
5. Submit the chosen room's numeric ID, not the location ID or a hardcoded Demo
   Study Room ID. Create a slot for room A and another for room B, then verify
   the stored resource IDs are different and correct.
6. Handle no eligible rooms, inactive rooms, missing assignment, loading and failed
   requests clearly. Prevent submission while required data is missing.
7. Preserve the explicit entry timezone, San Diego preview, future-time checks,
   overlap feedback and pending-click protection. Refresh dependent choices after
   location/room creation without wiping unrelated draft fields.
8. Repeat the flow with SDSU and UCSD admins. Check phone-sized screens, long room
   names, keyboard focus and readable buttons. Show saved state after refresh.

**Files:** `frontend/src/pages/AdminPage.jsx`, `frontend/src/components/admin/`,
and `frontend/src/styles/admin.css`. Discuss shared CSS/button changes with Sammy.
Do not rewrite participant pages or the auth provider as part of this task.

**First handoff:** send the selector reproduction/data findings to Skechie by
Day 2. UI work can use clearly labeled local fixtures while waiting for scoped
endpoints, but finish live integration by Days 6–7.

**Done when:** an admin can deliberately create slots for two different authorized
rooms, management lists show only the correct university, and saved IDs match
the choices. A fixture-only screenshot does not complete the live check.

For management completion, add small location/resource edit modes and the new
reservation panel described in the inventory. Agree on the six planned endpoints
with Skechie before wiring these controls and aim to finish by Day 8. Do not
introduce global user-role editing or destructive deletes. If the instructor
removes a feature from scope, record that decision rather than silently omitting it.

### Sammy

**Own:** participant frontend, user-workflow checks and video assembly.
**Review partner:** Zalma for UI; Skechie for request behavior.

1. Start immediately with the existing APIs. Run login, browse, choose a future
   slot, book, view My bookings, cancel, refresh availability and rebook.
2. Preserve the API helper and submit only the selected `time_slot_id` for booking.
   The server chooses the owner; the browser does not send replacement user IDs.
3. Improve loading, empty, booked, cancelled, error and success states. Make
   active bookings and history easy to distinguish without changing the data model.
4. Verify cancellation keeps history, releases the slot after Refresh and allows
   a new booking. A missing related display field must not crash the whole page.
5. Test repeated clicks and network failures. A lost write confirmation needs a
   read/Refresh before retry, not an automatic second POST or a false success message.
6. Test narrow screens, long names, visible focus, labels and enabled/disabled
   buttons. Keep session persistence, logout protection and admin personal-history
   behavior intact. Do not add a new calendar library just for appearance.
7. Coordinate final acceptance checks. Ask each owner for actual results from
   their area; report failures to that owner rather than taking over the subsystem.
8. Assemble the demonstration video from the tested release and each member's
   explanation. Check the final viewing link and hide credentials/private tabs.
9. Add simple location/name filters to the existing resource list. Clearly state
   if filtering applies only to the currently loaded list. Do not claim full-database
   search or add an unnecessary new page/API without an agreed requirement.

**Files:** `DashboardPage.jsx`, `ResourcesPage.jsx`, `TimeSlotsPage.jsx` and
`BookingsPage.jsx` under `frontend/src/pages/`. Auth/shared helper changes need
coordination with Tony. Discuss shared styles with Zalma first.

**First handoff:** report baseline/mobile problems by Day 2, complete focused UX
fixes by Day 5, and run cross-device checks with Marie by Days 7–8. Coordinate
release test results by Day 10 and assemble the video during Days 11–14.

**Done when:** the full participant flow works on desktop and phone, actual
results are recorded for the release, and the instructor can open the final video.

### Marie

**Own:** the server, network readiness and a repeatable wireless demonstration.
**Review partner:** Tony for integration; Sammy verifies from a client device.

1. On Day 1, confirm the actual host, operating system, power, storage, internet
   access and who can administer it. A planned Pi purchase is not an available host.
2. Test the intended network early. Confirm two clients can reach the host and the
   host can reach Supabase; some guest/campus networks isolate client devices.
   Check venue access and obtain permission before changing network settings.
3. If the Pi is not ready by Day 3, use an available team computer as the fallback
   if the rubric permits it. If the Pi itself is required, raise that hardware
   blocker immediately rather than silently substituting another machine.
4. Serve the built React app and Flask API from one agreed address. The target is
   Nginx serving the UI and forwarding `/api` to Gunicorn, a production Flask runner.
   Do not expose the Flask debug server or use Vite development serving as the
   finished deployment. Coordinate required server dependencies with Tony.
5. Verify the browser's actual API URL. A phone's `127.0.0.1` means the phone,
   not our server. The current helper can use an intentionally empty `VITE_API_URL`
   for same-origin `/api` requests; agree and test that build setting with Tony.
6. Preserve `/api` paths and Authorization through the proxy. Check that API calls
   return JSON, not the React HTML fallback. Direct refresh of `/admin` and
   `/bookings` must load the app and still enforce protected access.
7. Use trusted HTTPS before real credentials. Keep private keys and owner
   credentials outside Git; never disable TLS/auth/RLS checks to make a demo work.
   Any temporary plain-HTTP experiment is isolated disposable-account testing,
   not a secure or production-ready deployment. Public port exposure is not the default.
8. Coordinate Supabase redirect URLs with Tony if demonstrating email confirmation
   on the host. Existing confirmed test accounts can be used for the main demo.
9. Test two separate Wi-Fi clients. Disable cellular data on a test phone; book
   on client A, Refresh on B, cancel on A and Refresh on B again. Correlate the
   changes with sanitized server access logs. Do not claim instant real-time updates.
10. Add tested startup/restart/recovery instructions to this README. Have another
    member follow them. Keep the known working build and fallback ready before recording.

**Files:** future deployment configuration under `deploy/`, reviewed server
dependency configuration, and the server instructions in this README. These
deployment files are future task work, not files added by this README update.

**First handoff:** confirm host/network by Day 2 and the fallback by Day 3.
Aim for a working production build from another device by Day 7; complete the
two-client and restart checks with Sammy before Day 10.

**Done when:** another person can start/restart the tested release, two Wi-Fi
clients complete a protected workflow, and the real request path can be explained.
Supabase remains hosted, so the complete application still needs internet access.

## Handoffs and File Ownership

The critical order is **database ownership → scoped API → admin UI integration**.
Server preparation and participant testing start in parallel; they do not wait
for that chain to finish.

| Handoff | What must be shared | Target |
|---|---|---|
| Tony → Skechie | University model, trusted assignment/helper names, rollout order and test fixtures | Day 1 agreement; Day 3 live SQL verification |
| Skechie → Zalma | Scoped endpoint examples, current-university response and permission/error behavior | Day 2 contract; Day 5 live integration |
| Skechie ↔ Sammy | Preserve personal APIs; agree before changing fields, errors or retry behavior | Throughout frontend work |
| Marie ↔ Tony | Actual host, API base URL, proxy paths, dependencies and redirect settings | Start Day 1; deployed path by Day 7 |
| All owners → Sammy | Release commit, actual test results, screenshots/logs with secrets removed | Days 8–10 |
| All owners → final submission | Own contribution, demonstration segment and required AI-use record | Days 11–14 |

Skechie is the primary writer of `backend/app.py`; Tony reviews it while working
on SQL and integration. Zalma owns admin pages/styles; Sammy owns participant
pages. Marie owns deployment work. Tony coordinates `App.jsx`, `lib/api.js`, auth
providers, environment templates and lockfiles. Ask before editing a shared file.

Nobody should replace a teammate's full file with an older downloaded version.
Keep changes small enough to review. If an owner is unavailable, agree on a
specific file/task handoff rather than silently starting a competing rewrite.

## Fifteen Day Plan

Tony confirms the exact course deadline, timezone and rubric at kickoff. This
schedule uses relative days rather than guessing a submission date.

| Window | Goal |
|---|---|
| Days 1–2 | Everyone runs the baseline and confirms availability; agree on API/data fields; Marie confirms host/network; Tony checks deadline/rubric |
| Day 3 | University SQL has first verified results; host/fallback is decided; missing hardware or permission blockers are escalated |
| Days 4–5 | Skechie's scoped API works; Sammy's participant fixes are ready; Zalma connects to agreed responses |
| Days 6–7 | University admin flow works with multiple rooms; minimal management endpoints/panels are integrated; Marie's build works from another device |
| Day 8 | Finish approved management-completion items and first full regression/race results; no new optional work |
| Days 9–10 | Run permission, race, mobile and two-client checks on the integrated deployment; fix failures; freeze new features at end of Day 10 |
| Days 11–12 | Run complete rehearsals and a recovery drill; prepare video and summary drafts |
| Days 13–14 | Finish the recording, confirm viewing/submission permissions and aim to submit internally by Day 14 |
| Day 15 | Buffer for unexpected problems, not first-time server setup |

Server work starts in parallel. Do not wait for every feature before trying a
second device. If a critical milestone slips, remove optional polish and report
the blocker instead of silently adding more work.

Keep the existing design and working features. Do not add recurring bookings,
payments, a new calendar library, new authentication providers or a major rewrite.
Follow the inventory: minimal admin editing/reservation work is planned for
management completion; user-account administration needs a safe Day 1 scope
decision; password recovery/rescheduling stay optional unless the rubric requires
them. Remove lower-priority polish if required scope grows. Never weaken university
access or skip the actual wireless demonstration to add an optional feature.

## First Day Readiness Checklist

Each member completes this before starting feature work:

1. Clone or update `main`, install the project, and run both local servers using
   the setup section. Record your Node and Python versions if installation fails.
2. Get approved Supabase configuration and disposable test accounts from Tony.
   Do not ask for a shared owner password or invent credentials in source code.
3. Complete one existing user booking/cancellation flow. Frontend/admin owners
   also run the existing admin create flow with an approved admin test account.
4. Find your owner section, files and first handoff. Post your verified GitHub
   username, availability and first deliverable in the existing team channel.
5. Tony confirms the actual course deadline/rubric, current database state and
   required user-management behavior. Tony and Skechie confirm the proposed API
   contract. Marie confirms the actual host/network and hardware fallback.

After university access is implemented, Tony prepares SDSU admin, UCSD admin,
unassigned admin, inactive account and two regular-user test fixtures. Do not
describe those accounts as university-isolated before the code/database changes
have been applied and verified.

This README makes the implementation handoff explicit, but access, hardware and
course-specific requirements still need confirmation. A decision-needed item is
not automatically finished just because it appears in the plan.

## Simple Team Workflow

- Work in your assigned files. Ask before changing `App.jsx`, the shared API/auth
  helpers, global styles or dependency lockfiles.
- Use one small branch and PR per task. Another member reviews before merge.
- Post a short update: completed, next step, PR/evidence, blocker. Report blockers
  early with the exact error, without posting credentials.
- Only Tony coordinates changes to the shared database. Never recreate it to
  pick up a migration or delete booking history to reset a demo.
- Record actual test results. A mocked test or local screenshot is not proof of
  live university isolation, simultaneous booking or Wi-Fi operation.

Each member posts a short update in the existing team channel: what is done,
what comes next, PR/result, and blocker. Report a blocker after a reasonable
focused attempt, not after several silent days. If it threatens a milestone,
name the fix owner and decide what can be cut that day.

Tony keeps the shared plan current from those updates. Everyone does not need
to rewrite this README independently or create extra tracking documents.

With a clean working tree, create a feature branch from the project root:

```bash
git status --short
git switch main
git pull --ff-only origin main
git switch -c your-name-task
```

If status shows existing work, preserve it before switching; do not discard it.
Stage named files, review the staged diff, commit, push, then open a PR into `main`.

Example after finishing and testing a small task:

```bash
git add path/to/intended-file
git --no-pager diff --cached --name-only
git diff --cached --check
git commit -m "Describe the small completed task"
git push -u origin your-name-task
```

The PR should say what changed, who owns it, which checks actually ran and any
database/deployment impact. Another member reviews before merge. After a merged
branch is verified, it can be removed; do not force-delete unmerged work.

## Local Setup

The following commands run from the project root. Use the existing shared
Supabase project unless intentionally setting up an isolated test database.
Ask Tony for approved configuration/test access; do not share owner passwords.

Install Git, Node.js/npm and Python 3 with virtual-environment support first.
The current lockfile uses Vite 8.3.5, whose Node requirement is
`^20.19.0 || >=22.12.0`; use a compatible team-agreed version. Do not regenerate
the lockfile just to work around an outdated local Node installation.
For a new clone:

```bash
git clone https://github.com/zalma-farah/Booking-Scheduling-System.git
cd Booking-Scheduling-System
```

If already cloned, use your existing folder rather than creating another copy.
The project root contains both `frontend/` and `backend/`.

### Frontend

```bash
npm --prefix frontend ci
```

For a new setup only, copy `frontend/.env.example` to `frontend/.env`.
Do not overwrite an existing working environment file. Set:

```env
VITE_API_URL=http://127.0.0.1:5000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

```bash
npm --prefix frontend run dev
```

Open Vite's printed URL, usually `http://localhost:5173`. Restart Vite after
changing environment values.

### Backend

Open a second terminal in the project root. For a new setup:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python3 -m pip install -r backend/requirements.txt
```

Copy `backend/.env.example` to `backend/.env` only if it does not already exist.
Set values from the same Supabase project used by the frontend:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Start the local development API:

```bash
./backend/.venv/bin/python backend/app.py
```

Flask runs at `http://127.0.0.1:5000`. Keep both terminals running. The Python
environment is under `backend/`, not `frontend/`.

### Database and authentication

- For the existing shared database, apply only reviewed migrations that have not
  run yet. Tony coordinates this; do not rerun `database/schema.sql`.
- For an intentionally new empty database, run `schema.sql`, migration 001, then
  migration 002. Configure the Supabase auth Site URL and allowed login redirects.
- Local redirects normally include `http://localhost:5173/login`, optionally
  `http://localhost:5174/login`. The server demo needs its actual approved URL.
- New accounts are regular users. Ask the trusted project owner to provision
  test administrators. Changing global roles is not an ordinary admin UI action.
- The current baseline uses global admin roles. The planned university release
  will additionally require an explicit university assignment.

## Existing Routes and API

Frontend: `/login`, `/register`, `/dashboard`, `/admin`, `/resources`,
`/resources/:resourceId/slots`, and `/bookings`.

| API | Purpose |
|---|---|
| `GET /api/health` | Flask health |
| `GET /api/supabase-health` | Supabase Auth connectivity; not a complete database test |
| `GET /api/me` | Verify token and return the current profile |
| `GET /api/admin/health` | Verify administrator access |
| `GET /api/resources` | Active customer resource catalog |
| `GET /api/resources/:resourceId/slots` | Future availability |
| `POST /api/bookings` | Create a personal booking using `time_slot_id` |
| `GET /api/bookings` | Current account's personal history |
| `POST /api/bookings/:bookingId/cancel` | Cancel an owned booking, preserving history |
| `GET` / `POST /api/admin/locations` | List/create locations |
| `GET` / `POST /api/admin/resources` | List/create rooms/resources |
| `GET` / `POST /api/admin/time-slots` | List/create upcoming slots |

Protected calls need `Authorization: Bearer <user-access-token>`; the frontend
helper attaches it. Opening a protected URL directly in the address bar does not
attach that header, so 401 is expected. `GET /api/bookings` exists; it is not a 405.

The browser does not choose the booking owner. Normal Flask database operations
forward the verified user's token so Supabase RLS remains in effect. University
scoping is the next change, not an already completed permission guarantee.

## Checks Before a PR or Push

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
git diff --check
git check-ignore -v backend/.env frontend/.env backend/.venv/
git ls-files -- backend/.env frontend/.env backend/.venv/
git --no-pager diff --cached --name-only
```

The ignore check should show the expected rules, and `git ls-files` must print
nothing. Never commit real `.env`, `.venv`, access tokens, passwords, server private
keys or privileged Supabase keys. Commit placeholder `.env.example` files only.
Frontend `VITE_*` values reach the browser; only use a publishable key there.

Existing database checks, run as complete rollback scripts in a development/test
database with their prerequisites met:

- `database/tests/inactive_account.sql`
- `database/tests/booking_times.sql`
- `database/tests/booking_ownership.sql`

Never replace `ROLLBACK` with `COMMIT`. Run `ROLLBACK;` after a failed test before
continuing. These SQL checks do not replace real JWT/API/browser or race tests.

## Final Demonstration Checks

Use this table for the integrated release. Put actual results in the PR or the
team's agreed private test notes, including commit, environment, tester and date.
Until a check is executed, call it NOT RUN, not PASS.

| Check | Lead | Pass condition |
|---|---|---|
| Fresh setup | Everyone; Tony coordinates | Another member can install/run the baseline using these instructions |
| Authentication | Skechie + Sammy | Login/session/logout work; invalid tokens return 401; inactive/unauthorized accounts are blocked |
| University permissions | Tony + Skechie | SDSU/UCSD both work independently; foreign parent IDs and role/assignment changes are denied with no foreign mutation |
| Room selection | Zalma | Two eligible rooms can be deliberately selected; stored slot resource IDs match the choices |
| Detail editing | Zalma + Skechie | Authorized text changes persist after refresh; foreign record and owner/parent-field changes are denied |
| Slot validation | Zalma + Skechie | Past/invalid/overlapping creates fail; adjacent intervals work; timezone is explicit |
| Slot activation | Tony + Skechie + Zalma | Only an authorized future unbooked slot can change state; booked-slot attempts/races do not partially mutate data |
| Managed reservations | Skechie + Zalma | List/cancel operates only within the assigned university, preserves history and does not replace My bookings |
| Personal booking flow | Sammy | Book, refresh, history, cancel and rebook work; cancelled history remains |
| Ownership | Sammy + Skechie | Another account cannot cancel the owner's booking; admin My bookings remains personal |
| True concurrency | Skechie | Two accounts start together: one 201, one 409 and exactly one active database booking |
| Uncertain write | Sammy + Skechie | No blind POST retry; read/Refresh checks whether the original write completed |
| Mobile and keyboard | Sammy + Zalma | Core controls remain visible, readable, labeled and usable |
| Deployed routes | Marie | Deep-page refresh works; API returns JSON; real protected operations work, not just health |
| Two Wi-Fi clients | Marie + Sammy | Both reach the real host and agree on saved booking/cancellation state after Refresh |
| Restart/recovery | Marie + another member | A second person can restart the tested release and repeat a protected flow |
| Final materials | All five | Summary/video open correctly; contributions and AI-use records are accurate; claims match the release |

A stale page's later conflict is useful but is not a true simultaneous test.
If the race returns 401/403 or a timeout, diagnose it; do not record it as the
expected conflict. Refresh/read database state before repeating an uncertain write.

Use test accounts and current future slots. Never paste JWTs or passwords into
evidence. A direct SQL owner query does not prove RLS, and a healthy localhost
page does not prove another Wi-Fi client can reach the server.

### When the project is ready to submit

- Required and management-completion inventory items are implemented, or a
  specific instructor-approved removal is recorded. Decision-needed items are resolved.
- All release endpoints are actually registered, connected to their UI controls,
  and tested with allowed and denied accounts. Planned documentation is not implementation.
- Each owner's completion checks pass; the reviewed work is merged and the same
  integrated commit is deployed. No untracked local file is required to run it.
- No known permission, wrong-owner cancellation, duplicate-booking or data-loss
  failure remains. No safeguard was disabled to make a demonstration appear successful.
- Two separate Wi-Fi clients and another member's restart check pass on the real
  host, with the hosted Supabase/internet dependency explained accurately.
- The summary, video/viewing link, contribution notes and required AI-use records
  are complete and independently checked before the actual course deadline.

## Showcase and Submission

Rehearse this short sequence before recording:

1. **Marie and Tony:** explain the actual host, Wi-Fi clients, Flask API and hosted
   Supabase dependency. Do not describe the project as offline.
2. **Zalma:** show the assigned university, choose a non-default room and create
   future availability. Show the correct saved room after refresh.
3. **Sammy:** book from client A and show personal history. Client B refreshes and
   sees the booked state. Cancel, keep the history and show released availability.
4. **Skechie:** explain token/parent validation and show sanitized university-denial
   and true-race results. Do not paste tokens live or call sequential clicks a race.
5. **Marie:** show sanitized host request evidence and the tested restart procedure.

Also demonstrate the management features included in the release: Zalma shows a
saved location/room text edit and the university reservation list. Use a separate
test booking for admin cancellation so it does not disrupt Sammy's owner-cancel
walkthrough. Do not claim an instructor-approved omitted feature is implemented.

Sammy assembles the video, Zalma edits the one-page summary from everyone's
contributions, Marie supplies network evidence, and Tony verifies the release
and submission. Each person supplies and explains their own actual work.
Keep required AI prompts in an approved course/team location with secrets removed;
do not invent missing prompts or copy unrelated private conversations into Git.

Confirm the instructor's exact time limit, file format and viewing requirements
at kickoff. Have a second member open the final video link and deliverables.
Use Day 14 as the internal submission target so the final day remains a buffer.

Before public/real-credential deployment, use a production WSGI server and a
trusted HTTPS setup. Do not expose Flask debug mode or the Vite development server
as the finished deployment. References: [Flask deployment](https://flask.palletsprojects.com/en/stable/deploying/),
[Gunicorn](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/),
and [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## User Workflow

![Booking and Scheduling System user workflow](https://github.com/user-attachments/assets/46805f86-7fae-421d-9e40-6eda484bc236)
