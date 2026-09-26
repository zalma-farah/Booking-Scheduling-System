# Booking and Scheduling System(Basic Version)

A web-based application that allows users to view available resources and time slots, make reservations, and manage their bookings.

Administrators can manage users, resources, availability, and reservations.

## Project Status

The initial project configuration is complete. Feature development is currently in progress.

Currently working:

- React and Vite frontend
- Flask backend
- React Router installation
- Flask CORS configuration
- Backend health-check endpoint
- Git and GitHub workflow

## Technology Stack

### Frontend

- React
- Vite
- React Router
- JavaScript
- CSS

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

A regular user will be able to:

- Create an account and log in
- View locations and resources
- View available dates and times
- Make a booking
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

- Users must log in before making a booking.
- A time slot cannot be booked twice.
- Users can only cancel their own reservations.
- Administrators can manage every reservation.
- A canceled time slot becomes available again.

## System Architecture

The React frontend sends HTTP requests to the Flask backend.

The Flask backend validates each request, communicates with Supabase, and returns a JSON response to the frontend.

```text
React frontend
      |
      | HTTP/JSON
      v
Flask backend
      |
      v
Supabase database and authentication
```

## Project Structure

```text
Booking-Scheduling-System/
├── frontend/
│   ├── public/
│   ├── src/
│   └── package.json
├── backend/
│   ├── app.py
│   └── requirements.txt
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

Install the frontend packages:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Vite will display the local frontend address in the terminal.

## Backend Setup

From the project root, enter the backend folder:

```bash
cd backend
```

Create a virtual environment:

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

Start the Flask server:

```bash
python3 app.py
```

The backend runs at:

```text
http://127.0.0.1:5000
```

Test the backend health endpoint at:

```text
http://127.0.0.1:5000/api/health
```

## Environment Variables

Supabase credentials will be stored in `backend/.env`.

The `.env` file must never be committed to GitHub because it may contain private keys.

Supabase configuration will be added during the database integration stage.

## Git Workflow

Create a separate branch before beginning new work:

```bash
git switch main
git pull origin main
git switch -c your-name-feature
```

After making changes:

```bash
git add .
git commit -m "Describe your changes"
git push -u origin your-name-feature
```

Create a pull request on GitHub so the work can be reviewed before being merged into `main`.

## Next Development Steps

- Connect the React frontend to Flask
- Configure Supabase environment variables
- Connect Flask to Supabase
- Create the database tables
- Implement authentication
- Create user and administrator pages
- Implement booking and cancellation
- Prevent duplicate bookings



#Roles:
1._Configuration and Integration
Create the GitHub repository, configure React and Flask, manage branches, configure Flask-CORS and .env files, create the first React-to-Flask connection, maintain the README, integrate everyone’s work, and coordinate integration testing.

2._Participant Frontend
Create registration and login screens, the search page, availability calendar, booking form, participant dashboard, and booking cancellation interface.

3._Organizer and Administrator Frontend
Create the organizer dashboard, resource creation page, availability management, reservation list, simple administrator page, shared CSS, and navigation.

4._Backend/API
Create API routes for resources, availability, and bookings. Validate requests, verify user roles, implement booking and cancellation rules, and return appropriate error responses.

5._Database and Authentication
Create the Supabase tables and relationships, configure authentication, store user roles, configure database permissions, prevent duplicate bookings, create test data, and test the database.

## User Flow
<img width="841" height="649" alt="Screenshot 2026-09-26 at 8 55 40 AM" src="https://github.com/user-attachments/assets/46805f86-7fae-421d-9e40-6eda484bc236" />

