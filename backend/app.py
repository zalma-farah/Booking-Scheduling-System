import os
from functools import wraps

import httpx
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from supabase import Client, create_client


# Load backend/.env regardless of the working directory.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://localhost:5174",
            ]
        }
    },
    allow_headers=["Authorization", "Content-Type"],
)

supabase: Client | None = None

if SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY:
    supabase = create_client(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
    )


def api_error(message, status_code):
    return jsonify(
        {
            "status": "error",
            "message": message,
        }
    ), status_code


def log_auth_rejection(response, stage):
    """Log a limited diagnostic reason, never credentials."""

    try:
        details = response.json()
    except ValueError:
        details = {}

    if not isinstance(details, dict):
        details = {}

    if "invalid api key" in response.text.lower():
        reason = "Invalid API key"
    else:
        code = details.get("code") or details.get("error_code")

        if (
            isinstance(code, str)
            and len(code) <= 80
            and all(
                character.isalnum() or character in "_-"
                for character in code
            )
        ):
            reason = code
        else:
            reason = "No error code provided"

    app.logger.warning(
        "Supabase auth rejected request: stage=%s, status=%s, reason=%s",
        stage,
        response.status_code,
        reason,
    )


def require_auth(admin_only=False):
    """Verify the access token and current account profile."""

    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            authorization = request.headers.get("Authorization", "")
            parts = authorization.split()

            if len(parts) != 2 or parts[0].lower() != "bearer":
                return api_error(
                    "A Bearer access token is required.",
                    401,
                )

            if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
                return api_error(
                    "Authentication is not configured.",
                    503,
                )

            # These headers belong only to the current request.
            headers = {
                "apikey": SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {parts[1]}",
            }

            try:
                user_response = httpx.get(
                    f"{SUPABASE_URL}/auth/v1/user",
                    headers=headers,
                    timeout=10.0,
                )

                if user_response.status_code in (400, 401, 403):
                    log_auth_rejection(user_response, "user")
                    return api_error(
                        "Invalid or expired access token.",
                        401,
                    )

                user_response.raise_for_status()
                user = user_response.json()

                if not isinstance(user, dict) or not user.get("id"):
                    return api_error(
                        "Invalid authentication response.",
                        502,
                    )

                profile_response = httpx.get(
                    f"{SUPABASE_URL}/rest/v1/profiles",
                    headers=headers,
                    params={
                        "select": "id,email,role,is_active",
                        "id": f"eq.{user['id']}",
                    },
                    timeout=10.0,
                )

                if profile_response.status_code == 401:
                    log_auth_rejection(profile_response, "profile")
                    return api_error(
                        "Invalid or expired access token.",
                        401,
                    )

                profile_response.raise_for_status()
                profiles = profile_response.json()

                if not isinstance(profiles, list):
                    return api_error("Invalid profile response.", 502)

                if len(profiles) != 1:
                    return api_error(
                        "An account profile is required.",
                        403,
                    )

                profile = profiles[0]

                if not isinstance(profile, dict):
                    return api_error("Invalid profile response.", 502)

                if profile.get("is_active") is not True:
                    return api_error("Your account is inactive.", 403)

                if profile.get("role") not in (
                    "user",
                    "administrator",
                ):
                    return api_error(
                        "Your account role is invalid.",
                        403,
                    )

                if admin_only and profile["role"] != "administrator":
                    return api_error(
                        "Administrator access is required.",
                        403,
                    )

            except httpx.TimeoutException:
                return api_error(
                    "Authentication service timed out. Please try again.",
                    503,
                )

            except (httpx.HTTPError, ValueError):
                return api_error(
                    "Unable to verify your account. Please try again.",
                    502,
                )

            # Available only during the current request.
            g.user = user
            g.profile = profile
            g.supabase_headers = headers

            return view(*args, **kwargs)

        return wrapped

    return decorator


@app.get("/api/health")
def health_check():
    return jsonify(
        {
            "status": "ok",
            "message": "Booking System API is running",
        }
    )


@app.get("/api/supabase-health")
def supabase_health():
    if supabase is None:
        return api_error(
            "Supabase environment variables are missing",
            500,
        )

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/health",
            headers={"apikey": SUPABASE_PUBLISHABLE_KEY},
            timeout=5.0,
        )
        response.raise_for_status()

        return jsonify(
            {
                "status": "ok",
                "message": "Flask successfully connected to Supabase",
            }
        )

    except httpx.HTTPError:
        return api_error(
            "Flask could not connect to Supabase",
            502,
        )


@app.get("/api/me")
@require_auth()
def current_user():
    return jsonify(
        {
            "status": "ok",
            "profile": g.profile,
        }
    )


@app.get("/api/admin/health")
@require_auth(admin_only=True)
def administrator_health():
    return jsonify(
        {
            "status": "ok",
            "message": "Administrator access verified by Flask",
        }
    )


@app.get("/api/resources")
@require_auth()
def list_resources():
    """List active resources at active locations."""

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/resources",
            headers=g.supabase_headers,
            params={
                "select": (
                    "id,name,description,"
                    "location:locations!inner(id,name,address)"
                ),
                "is_active": "eq.true",
                "location.is_active": "eq.true",
                "order": "name.asc,id.asc",
                "limit": "100",
            },
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error(
                "Your session expired. Please sign in again.",
                401,
            )

        if response.status_code == 403:
            return api_error(
                "Access to resources was denied.",
                403,
            )

        response.raise_for_status()
        resources = response.json()

        if not isinstance(resources, list):
            return api_error("Invalid resource response.", 502)

        return jsonify(
            {
                "status": "ok",
                "message": f"Loaded {len(resources)} active resource(s).",
                "resources": resources,
            }
        )

    except httpx.TimeoutException:
        return api_error(
            "Loading resources timed out. Please try again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error(
            "Unable to load resources. Please try again.",
            502,
        )


@app.get("/api/resources/<int:resource_id>/slots")
@require_auth()
def list_resource_slots(resource_id):
    """List future time slots and availability for one resource."""

    if resource_id < 1 or resource_id > 9223372036854775807:
        return api_error("Invalid resource ID.", 400)

    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/get_resource_availability",
            headers=g.supabase_headers,
            json={
                "p_resource_id": resource_id,
            },
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error(
                "Your session expired. Please sign in again.",
                401,
            )

        if response.status_code == 403:
            return api_error(
                "Access to availability was denied.",
                403,
            )

        response.raise_for_status()
        slots = response.json()

        if not isinstance(slots, list):
            return api_error("Invalid availability response.", 502)

        return jsonify(
            {
                "status": "ok",
                "slots": slots,
            }
        )

    except httpx.TimeoutException:
        return api_error(
            "Loading availability timed out. Please try again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error(
            "Unable to load availability. Please try again.",
            502,
        )


@app.get("/api/bookings")
@require_auth()
def list_my_bookings():
    """List only this account's latest bookings, including cancelled history."""

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers=g.supabase_headers,
            params={
                "select": (
                    "id,user_id,time_slot_id,status,created_at,cancelled_at,"
                    "slot:time_slots(id,start_time,end_time,"
                    "resource:resources(id,name,location:locations(id,name)))"
                ),
                # Administrators also see only their OWN bookings here.
                "user_id": f"eq.{g.user['id']}",
                "order": "created_at.desc,id.desc",
                "limit": "100",
            },
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error(
                "Your session expired. Please sign in again.",
                401,
            )

        if response.status_code == 403:
            return api_error(
                "Access to your bookings was denied.",
                403,
            )

        response.raise_for_status()
        bookings = response.json()

        if not isinstance(bookings, list) or any(
            not isinstance(booking, dict)
            or booking.get("id") is None
            or booking.get("user_id") != g.user["id"]
            or booking.get("status") not in ("active", "cancelled")
            for booking in bookings
        ):
            return api_error("Invalid booking list response.", 502)

        # Keep booking rows even if RLS hides an inactive related resource.
        # Return only the fields this personal view needs, not account IDs.
        fields = (
            "id", "time_slot_id", "status",
            "created_at", "cancelled_at", "slot",
        )
        result = jsonify(
            {
                "status": "ok",
                "bookings": [
                    {field: booking.get(field) for field in fields}
                    for booking in bookings
                ],
            }
        )
        result.headers["Cache-Control"] = "no-store"
        return result

    except httpx.TimeoutException:
        return api_error(
            "Loading your bookings timed out. Please try again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error(
            "Unable to load your bookings. Please try again.",
            502,
        )


@app.post("/api/bookings")
@require_auth()
def create_booking():
    """Create an active booking for the verified signed-in user."""

    payload = request.get_json(silent=True)

    if not isinstance(payload, dict) or set(payload) != {"time_slot_id"}:
        return api_error(
            "Send a JSON object containing only time_slot_id.",
            400,
        )

    time_slot_id = payload["time_slot_id"]

    # bool is a subclass of int in Python, so use an exact type check.
    if (
        type(time_slot_id) is not int
        or time_slot_id < 1
        or time_slot_id > 9223372036854775807
    ):
        return api_error("time_slot_id must be a positive integer.", 400)

    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/bookings",
            headers={
                **g.supabase_headers,
                "Prefer": "return=representation",
            },
            params={
                "select": "id,time_slot_id,status,created_at",
            },
            json={
                # Never accept the booking owner from the browser.
                "user_id": g.user["id"],
                "time_slot_id": time_slot_id,
            },
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error(
                "Your session expired. Please sign in again.",
                401,
            )

        if response.status_code == 403:
            return api_error(
                "Booking is not permitted for this account or time slot.",
                403,
            )

        if response.status_code == 409:
            details = response.json()
            code = details.get("code") if isinstance(details, dict) else None

            if code == "23505":
                return api_error(
                    "This time slot is already booked. "
                    "Refresh availability and choose another slot.",
                    409,
                )

            if code == "23503":
                return api_error(
                    "The account or time slot is no longer available. "
                    "Refresh before trying again.",
                    409,
                )

        response.raise_for_status()
        bookings = response.json()

        if (
            not isinstance(bookings, list)
            or len(bookings) != 1
            or not isinstance(bookings[0], dict)
            or bookings[0].get("id") is None
            or bookings[0].get("time_slot_id") != time_slot_id
            or bookings[0].get("status") != "active"
        ):
            return api_error(
                "The booking result could not be confirmed. "
                "Refresh availability before trying again.",
                502,
            )

        return jsonify(
            {
                "status": "ok",
                "message": "Booking created successfully.",
                "booking": bookings[0],
            }
        ), 201

    except httpx.TimeoutException:
        # The write might have completed even if its response timed out.
        return api_error(
            "Booking confirmation timed out. "
            "Refresh availability before trying again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error(
            "Unable to confirm the booking. "
            "Refresh availability before trying again.",
            502,
        )


@app.post("/api/bookings/<int:booking_id>/cancel")
@require_auth()
def cancel_booking(booking_id):
    """Cancel the verified user's own booking without deleting its history."""

    if (
        type(booking_id) is not int
        or booking_id < 1
        or booking_id > 9223372036854775807
    ):
        return api_error("Invalid booking ID.", 400)

    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/rpc/cancel_own_booking",
            headers=g.supabase_headers,
            # Ownership comes from auth.uid() inside the database function.
            # Never accept an owner or a replacement status from the browser.
            json={"booking_id": booking_id},
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error(
                "Your session expired. Please sign in again.",
                401,
            )

        if response.status_code == 403:
            return api_error(
                "Cancellation is not permitted for this account.",
                403,
            )

        if response.status_code == 400:
            details = response.json()
            code = details.get("code") if isinstance(details, dict) else None

            if code == "P0001":
                # Use the same message for absent, cancelled and other-owned IDs.
                return api_error(
                    "Booking not found, already cancelled, "
                    "or does not belong to your account. Refresh your bookings.",
                    404,
                )

            if code == "22023":
                return api_error("Invalid booking ID.", 400)

        response.raise_for_status()

        # Current VOID responses are empty (204); legacy ones may be JSON null.
        # Never try to decode an empty body as JSON.
        void_result = response.status_code in (200, 204)

        if response.status_code == 200 and response.content.strip():
            void_result = response.json() is None

        if not void_result:
            return api_error(
                "The cancellation result could not be confirmed. "
                "Refresh your bookings before trying again.",
                502,
            )

        result = jsonify(
            {
                "status": "ok",
                "message": "Booking cancelled successfully.",
                "booking": {"id": booking_id, "status": "cancelled"},
            }
        )
        result.headers["Cache-Control"] = "no-store"
        return result

    except httpx.TimeoutException:
        # The change may have committed even if its response never arrived.
        return api_error(
            "Cancellation confirmation timed out. "
            "Refresh your bookings before trying again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error(
            "Unable to confirm the cancellation. "
            "Refresh your bookings before trying again.",
            502,
        )


if __name__ == "__main__":
    # Local development only.
    app.run(debug=True, port=5000)
