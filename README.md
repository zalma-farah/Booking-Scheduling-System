# Booking and Scheduling System

A semester project for booking locations and resources.

The application uses React for the interface, Flask for the API, and Supabase for authentication and database storage.

## Current Status

Implemented:

- Account registration and email confirmation
- Login and logout
- Persistent login sessions
- User and administrator roles
- Protected frontend routes
- Role-based login redirects
- Flask access-token verification
- Administrator-only API access
- Inactive-account blocking in Flask and protected pages
- Database schema and row-level security policies
- Database constraints for overlapping slots and duplicate active bookings
- Resource browsing and future time-slot availability
- Database checks against booking past slots
- Active-account and ownership checks for booking cancellation
- Repeatable SQL regression scripts for the booking rules

The current dashboards provide navigation and authentication test buttons.

Booking creation now has a Flask endpoint and a time-slot button in this branch. Live browser-to-Flask-to-Supabase verification is still required before marking that workflow complete.

Still to implement:

- Administrator management forms
- Booking history and cancellation pages/API
- Live booking-creation and simultaneous-booking verification
- Automated application tests and CI
- Production deployment on our own server

Database rules have been checked with SQL role tests. These tests do not replace browser, HTTP authentication, or simultaneous-request tests. The complete book/view/cancel workflow is not finished yet.

## Technology Stack

Frontend:

- JavaScript
- React and Vite
- React Router
- Tailwind CSS
- shadcn/ui and Radix UI

Backend:

- Python and Flask
- Flask-CORS
- HTTP/JSON API

Database and authentication:

- Supabase Authentication
- Supabase PostgreSQL
- Row-level security

## How the Application Connects

React communicates directly with Supabase for registration, login, sessions, and profile loading.

For protected API requests, React sends an access token to Flask.

Flask verifies the token with Supabase and checks the account's current role and active status. Database requests use the user's token so row-level security remains in effect.

## Project Folders

- `frontend/`: React application
- `backend/`: Flask API
- `database/schema.sql`: initial database schema for a new, empty database
- `database/migrations/`: ordered changes to an existing database
- `database/tests/`: rollback-based database regression checks
- `database/seed_demo_slots.sql`: optional slots for tomorrow's demonstration
- `README.md`: project setup and development guide

## Local Setup

Requirements:

- Node.js and npm
- Python 3.11 recommended
- Git
- Access to the team's Supabase project

Clone the repository:

```bash
git clone https://github.com/zalma-farah/Booking-Scheduling-System.git
cd Booking-Scheduling-System
```

If you already have the repository, use your existing project folder.

The following commands assume you are in the project root.

### Frontend

Install dependencies:

```bash
npm --prefix frontend ci
```

For a new setup, copy the environment template:

```bash
cp frontend/.env.example frontend/.env
```

Do not overwrite an existing working `.env`.

Fill in `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:5000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Use values from the team's Supabase project.

Start React:

```bash
npm --prefix frontend run dev
```

Open the address printed by Vite, usually:

```text
http://localhost:5173
```

Restart Vite after changing environment variables.

### Backend

Open a second terminal in the project root.

For a new setup, create the Python environment:

```bash
python3 -m venv backend/.venv
```

Activate it on macOS or Linux:

```bash
source backend/.venv/bin/activate
```

Install dependencies:

```bash
python3 -m pip install -r backend/requirements.txt
```

For a new setup, copy the environment template:

```bash
cp backend/.env.example backend/.env
```

Do not overwrite an existing working `.env`.

Fill in `backend/.env`:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

The frontend and backend must use the same Supabase project.

Start Flask:

```bash
python3 backend/app.py
```

Flask runs at:

```text
http://127.0.0.1:5000
```

Keep both terminals running when testing the complete application.

## Supabase Setup

Use the shared team project unless you are intentionally creating an isolated development environment.

For a new, empty database:

1. Open the Supabase SQL Editor.
2. Review and run `database/schema.sql` once.
3. Run `database/migrations/001_resource_availability.sql`.
4. Run `database/migrations/002_booking_rules.sql`.
5. Configure the authentication Site URL and allowed redirects.
6. Add the project URL and publishable key to your local environment files.

Do not rerun the initial schema against an existing database. It creates tables and policies that may already exist.

For local authentication, configure:

- Site URL: `http://localhost:5173`
- Redirect URL: `http://localhost:5173/login`
- Optional second development port: `http://localhost:5174/login`

Email confirmation returns the user to the login page.

For an existing team database, apply only migrations that have not already been applied. Coordinate with the team before changing the shared database. Do not recreate the database to pick up a migration.

The optional slot seed expects an active resource named `Demo Study Room` at an active location named `Wireless Demo Location`. The shared demo database already has these records. A new database needs those records created first, using the Table Editor until administrator forms are available.

`database/seed_demo_slots.sql` adds tomorrow's 9–10, 10–11, and 11–12 slots in San Diego time. It preserves existing records. Once slots have passed, rerun the optional slot seed if the demonstration needs new future slots.

## First Administrator

New accounts receive the `user` role automatically.

To create an administrator:

1. Register the account through the application.
2. Confirm its email.
3. Confirm a matching row exists in `public.profiles`.
4. Run this separately in the Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'administrator'
WHERE email = 'replace-with-the-existing-account-email'
RETURNING id, role, is_active;
```

Verify that exactly the intended account was updated.

Sign out and back in after changing roles. Keep separate user and administrator accounts for testing.

## Database Regression Checks

Run these only against a development/test database, using the SQL Editor's default `postgres` role:

- `database/tests/inactive_account.sql`
- `database/tests/booking_times.sql`
- `database/tests/booking_ownership.sql`

Prerequisites: the initial schema and both migrations are applied; an active regular user exists; and a second different active account exists for the ownership test. Register and confirm separate test accounts through the application.

Run each complete script, including `BEGIN`, its assertions, and `ROLLBACK`. Do not run only the final SELECT that displays PASS messages. Unexpected behavior raises an error before that final query.

The scripts simulate authenticated database users and roll back temporary row changes. Sequence IDs can still advance. Never replace `ROLLBACK` with `COMMIT`; if a script errors, issue `ROLLBACK` before continuing.

These checks cover inactive-account cancellation, future versus past bookings, ownership, cancellation, and reopened availability. They do not exercise real JWT validation, Flask routes, the browser, or concurrent requests.

## Application Routes

| Route | Access |
|---|---|
| `/login` | Login page |
| `/register` | Registration page |
| `/dashboard` | Active signed-in users |
| `/admin` | Active administrators |
| `/resources` | Active signed-in users |
| `/resources/:resourceId/slots` | Active signed-in users |

After login, administrators go to `/admin` and regular users go to `/dashboard`.

Frontend routing improves navigation. Flask and database permissions enforce access to protected data.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Check that Flask is running |
| `GET /api/supabase-health` | Check Supabase Auth connectivity |
| `GET /api/me` | Verify the token and return the account profile |
| `GET /api/admin/health` | Verify administrator access |
| `GET /api/resources` | List active resources at active locations |
| `GET /api/resources/:resourceId/slots` | List future availability |
| `POST /api/bookings` | Create a personal booking |

Protected endpoints require:

```text
Authorization: Bearer <user-access-token>
```

The frontend attaches the token automatically.

Opening a protected GET endpoint directly in the address bar does not attach that token, so a 401 response is expected. Opening `/api/bookings` in the address bar sends GET rather than POST and should return 405.

The Supabase health endpoint does not test all database operations.

### Create a Booking

The frontend submits only the slot ID returned by the availability endpoint:

```json
{"time_slot_id": 1}
```

Flask derives `user_id` from the verified token. Do not send an owner, status, booking ID, or timestamp from the browser.

- 201: booking created and returned.
- 400: invalid request body or slot ID.
- 401/403: authentication or permission failure.
- 409: duplicate active booking or a related record changed.
- 502/503: the result could not be confirmed; the write may have completed.

The button blocks repeat clicks while a request is pending. Confirmed bookings and slot conflicts trigger a fresh availability load. An uncertain result requires clicking Refresh before another attempt. Requests are never automatically resubmitted.

The database's unique active-booking index is the final protection against simultaneous reservations. A successful mocked test is not proof that the live concurrent workflow has been tested.

## Authentication Testing

Run both servers and use the dashboard test buttons.

| Test | Active user | Active administrator |
|---|---|---|
| Test my account | 200 | 200 |
| Test admin access | 403 | 200 |
| Test invalid token | 401 | 401 |

Also verify:

- Email confirmation works.
- Login redirects to the correct dashboard.
- Refreshing preserves the session.
- Logout removes access to protected pages.
- Regular users cannot open `/admin`.
- Flask returns 403 for an inactive account.

Restore test accounts to their intended role and active status afterward.

These are manual application checks. Database regression scripts are listed above; automated application tests and CI still need to be added.

## Booking Creation Check

After installing these changes locally:

1. Run Flask and React in separate terminals.
2. Sign in as an active regular user.
3. Open Browse resources, then View time slots.
4. Click Book this slot on a future available slot.
5. Confirm a success message with a booking ID, a Booked badge, and a POST `/api/bookings` response of 201.
6. Confirm in Supabase that the booking belongs to the signed-in account.
7. Verify that refreshing preserves the Booked state.

To check a conflict, load the same available slot in two separately signed-in browsers. Book in one, then attempt the stale slot in the other without refreshing first. Only one active booking should exist, and the second request should return 409 and refresh availability. A true simultaneous-request test is still required separately.

Do not use real customer data for demonstrations. Viewing and cancelling personal bookings through the website are the next workflow features.

## Environment Safety

Never commit:

- Real `.env` files
- Python `.venv/` folders
- Access tokens or passwords
- Supabase secret or service-role keys

Commit `.env.example` files containing placeholders.

Frontend `VITE_*` values are included in the browser build. Only use the Supabase publishable key there, never a secret key.

Before each push, run from the project root:

```bash
git check-ignore -v backend/.env frontend/.env backend/.venv
git ls-files -- backend/.env frontend/.env backend/.venv
git diff --cached --name-only
```

The `git ls-files` command should print nothing.

If it prints a path, stop and resolve the tracked file before pushing. Adding a file to `.gitignore` does not untrack an existing committed file.

## Quality Checks

From the project root:

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
git diff --check
```

Lint and build checks do not replace functional or security tests.

## Team Git Workflow

Start with a clean working tree:

```bash
git status
git switch main
git pull --ff-only origin main
git switch -c your-name-feature
```

Make and test your changes.

Stage only the intended files, review them, and commit:

```bash
git add path/to/changed-file
git diff --cached
git commit -m "Describe the change"
git push -u origin your-name-feature
```

Open a pull request into `main` for review.

Do not push directly to `main`.

## Next Milestone

Complete one booking workflow:

1. An administrator creates a location and resource.
2. An administrator creates available time slots.
3. A user views availability.
4. The user creates a booking.
5. The user views and cancels the booking.
6. The cancelled slot becomes available again.

Test simultaneous booking attempts to confirm that only one succeeds.

## Server Deployment Plan

Planned deployment:

- Our own Linux machine hosts the application.
- Nginx serves the React production build and handles HTTPS.
- Gunicorn runs Flask behind Nginx.
- Supabase remains hosted for authentication and database storage.

Deployment is not implemented yet.

Do not deploy using Flask debug mode or the Vite development server.

## User Workflow

![Booking and Scheduling System user workflow](https://github.com/user-attachments/assets/46805f86-7fae-421d-9e40-6eda484bc236)
