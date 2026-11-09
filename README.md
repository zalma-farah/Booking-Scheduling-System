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

The current dashboards are placeholders with authentication test buttons.

Still to implement:

- Location and resource browsing
- Administrator management forms
- Available time-slot display
- Booking creation, viewing, and cancellation
- Automated tests
- Production deployment on our own server

Database booking rules exist, but the complete booking workflow still needs implementation and testing.

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
- `database/schema.sql`: initial database schema
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
2. Review and run `database/schema.sql`.
3. Configure the authentication Site URL and allowed redirects.
4. Add the project URL and publishable key to your local environment files.

Do not rerun the initial schema against an existing database. It creates tables and policies that may already exist.

For local authentication, configure:

- Site URL: `http://localhost:5173`
- Redirect URL: `http://localhost:5173/login`
- Optional second development port: `http://localhost:5174/login`

Email confirmation returns the user to the login page.

Future database changes should be recorded as versioned migrations.

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

## Application Routes

| Route | Access |
|---|---|
| `/login` | Login page |
| `/register` | Registration page |
| `/dashboard` | Active signed-in users |
| `/admin` | Active administrators |

After login, administrators go to `/admin` and regular users go to `/dashboard`.

Frontend routing improves navigation. Flask and database permissions enforce access to protected data.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Check that Flask is running |
| `GET /api/supabase-health` | Check Supabase Auth connectivity |
| `GET /api/me` | Verify the token and return the account profile |
| `GET /api/admin/health` | Verify administrator access |

Protected endpoints require:

```text
Authorization: Bearer <user-access-token>
```

The frontend attaches the token automatically.

Opening a protected endpoint directly in the address bar does not attach that token, so a 401 response is expected.

The Supabase health endpoint does not test all database operations.

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

These are manual checks. Automated tests still need to be added.

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