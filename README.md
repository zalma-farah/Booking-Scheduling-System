# Booking and Scheduling System

A web application that allows users to view resources, check available time slots, make reservations, and manage their bookings.

Administrators can manage locations, resources, availability, users, and reservations.

## Project Status

The project foundation is complete, including:

- React and Vite frontend
- React Router
- Tailwind CSS
- shadcn/ui with Radix UI
- Python and Flask backend
- React-to-Flask API connection
- Flask-to-Supabase connection
- Supabase PostgreSQL database schema
- Supabase Authentication foundation
- Environment-variable configuration
- GitHub feature-branch workflow

The current development stage is authentication and user-interface implementation.

## Technology Stack

### Frontend

- React
- Vite
- JavaScript
- React Router
- Tailwind CSS
- shadcn/ui
- Radix UI

### Backend

- Python
- Flask
- Flask-CORS
- HTTP/JSON API

### Database and Authentication

- Supabase
- PostgreSQL
- Supabase Authentication

## Application Roles

### User

A user will be able to:

- Create an account and log in
- View locations and resources
- View available dates and times
- Create a booking
- View their bookings
- Cancel their own bookings

### Administrator

An administrator will be able to:

- Manage users
- Add and update locations
- Add and update resources
- Create available time slots
- View and manage all reservations

## System Rules

- Users must log in before creating a booking.
- A time slot cannot be booked twice.
- Overlapping time slots for the same resource are not allowed.
- Users can only cancel their own reservations.
- Administrators can manage every reservation.
- A cancelled time slot becomes available again.
- Booking history is preserved.

## System Architecture

```text
React and Vite frontend
          |
          | HTTP/JSON
          v
      Flask API
          |
          v
Supabase Authentication and PostgreSQL
```

The React frontend displays the application interface and sends requests to Flask.

Flask validates requests, applies application rules, communicates with Supabase, and returns JSON responses.

Supabase stores users, locations, resources, time slots, and bookings.

## Project Structure

```text
Booking-Scheduling-System/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/
│   │   ├── lib/
│   │   ├── App.jsx
│   │   └── index.css
│   ├── components.json
│   ├── jsconfig.json
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

## Requirements

Install the following before running the project:

- Node.js
- npm
- Python 3
- Git

## Clone the Repository

```bash
git clone https://github.com/zalma-farah/Booking-Scheduling-System.git
cd Booking-Scheduling-System
```

## Frontend Setup

Enter the frontend folder:

```bash
cd frontend
```

Install the packages:

```bash
npm install
```

Create the frontend environment file:

```bash
cp .env.example .env
```

The frontend `.env` should contain:

```env
VITE_API_URL=http://127.0.0.1:5000
```

Start the frontend:

```bash
npm run dev
```

Vite will display the local frontend address in the terminal.

## Backend Setup

Open another terminal and enter the backend folder:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python3 -m venv .venv
```

Activate it on macOS or Linux:

```bash
source .venv/bin/activate
```

Install the backend packages:

```bash
python3 -m pip install -r requirements.txt
```

Create the backend environment file:

```bash
cp .env.example .env
```

Add the Supabase project values:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Start Flask:

```bash
python3 app.py
```

The backend runs at:

```text
http://127.0.0.1:5000
```

## API Health Checks

Test the Flask server:

```text
http://127.0.0.1:5000/api/health
```

Test the Supabase connection:

```text
http://127.0.0.1:5000/api/supabase-health
```

## Database Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Copy the contents of `database/schema.sql`.
4. Run the schema in the SQL Editor.
5. Add the Supabase URL and publishable key to `backend/.env`.

The schema creates:

- User profiles
- Locations
- Resources
- Time slots
- Bookings
- User and administrator roles
- Row-level security policies
- Double-booking protection
- Overlapping-time-slot protection

## Environment Variable Safety

Never commit `.env` files to GitHub.

Only `.env.example` files containing placeholders should be committed.

Never place a Supabase secret or service-role key in frontend code.

## Frontend Quality Checks

Run ESLint:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Both commands should pass before opening a pull request.

## Git Workflow

Update your local `main` branch:

```bash
git switch main
git pull origin main
```

Create a feature branch:

```bash
git switch -c your-name-feature
```

After completing and testing the work:

```bash
git add .
git commit -m "Describe your changes"
git push -u origin your-name-feature
```

Create a pull request so another team member can review the changes before merging them into `main`.

## Next Development Steps

- Create registration and login pages
- Connect the login forms to Supabase Authentication
- Add protected routes
- Add user and administrator navigation
- Create location and resource pages
- Display available time slots
- Implement booking creation
- Implement booking cancellation
- Create participant and administrator dashboards
- Complete integration testing

## User Workflow

![Booking and Scheduling System user workflow](https://github.com/user-attachments/assets/46805f86-7fae-421d-9e40-6eda484bc236)