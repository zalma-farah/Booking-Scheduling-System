import os
from datetime import datetime, timedelta, timezone
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


def _is_location_record(value):
    """Check the small response shape used by the admin location screen."""

    return (
        isinstance(value, dict)
        and type(value.get("id")) is int
        and value["id"] > 0
        and isinstance(value.get("name"), str)
        and bool(value["name"].strip())
        and (value.get("address") is None or isinstance(value["address"], str))
        and type(value.get("is_active")) is bool
    )


@app.get("/api/admin/locations")
@require_auth(admin_only=True)
def list_admin_locations():
    """List the latest locations, including inactive ones, for administrators."""

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/locations",
            headers=g.supabase_headers,
            params={
                "select": "id,name,address,is_active,created_at",
                "order": "created_at.desc,id.desc",
                "limit": "100",
            },
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error("Your session expired. Please sign in again.", 401)

        if response.status_code == 403:
            return api_error("Administrator access to locations was denied.", 403)

        response.raise_for_status()
        locations = response.json()

        if not isinstance(locations, list) or not all(
            _is_location_record(location) for location in locations
        ):
            return api_error("Invalid location list response.", 502)

        result = jsonify({"status": "ok", "locations": locations})
        result.headers["Cache-Control"] = "no-store"
        return result

    except httpx.TimeoutException:
        return api_error(
            "Loading locations timed out. Please try again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error("Unable to load locations. Please try again.", 502)


@app.post("/api/admin/locations")
@require_auth(admin_only=True)
def create_admin_location():
    """Create an active location using the verified administrator's token."""

    payload = request.get_json(silent=True)

    if (
        not isinstance(payload, dict)
        or "name" not in payload
        or set(payload) - {"name", "address"}
    ):
        return api_error(
            "Send a JSON object containing name and an optional address.",
            400,
        )

    name = payload["name"]

    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
        return api_error("Location name must be between 1 and 120 characters.", 400)

    name = name.strip()
    address = payload.get("address")

    if address is not None:
        if not isinstance(address, str) or len(address.strip()) > 250:
            return api_error("Address must be text of at most 250 characters.", 400)

        address = address.strip() or None

    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/locations",
            headers={
                **g.supabase_headers,
                "Prefer": "return=representation",
            },
            params={"select": "id,name,address,is_active,created_at"},
            json={"name": name, "address": address, "is_active": True},
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error("Your session expired. Please sign in again.", 401)

        if response.status_code == 403:
            return api_error("Administrator permission to create locations was denied.", 403)

        if response.status_code == 409:
            return api_error(
                "The location could not be created because of a data conflict. "
                "Refresh the list before trying again.",
                409,
            )

        response.raise_for_status()
        locations = response.json()

        if (
            response.status_code != 201
            or not isinstance(locations, list)
            or len(locations) != 1
            or not _is_location_record(locations[0])
            or locations[0]["name"] != name
            or locations[0].get("address") != address
            or locations[0]["is_active"] is not True
        ):
            return api_error(
                "The new location could not be confirmed. "
                "Refresh the location list before trying again.",
                502,
            )

        result = jsonify(
            {
                "status": "ok",
                "message": "Location created successfully.",
                "location": locations[0],
            }
        )
        result.headers["Cache-Control"] = "no-store"
        return result, 201

    except httpx.TimeoutException:
        # A write may have committed even when its confirmation was lost.
        return api_error(
            "Location confirmation timed out. "
            "Refresh the location list before trying again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error(
            "Unable to confirm the new location. "
            "Refresh the location list before trying again.",
            502,
        )


def _is_resource_record(value):
    """Validate the resource fields returned to the administrator screen."""

    return (
        isinstance(value, dict)
        and type(value.get("id")) is int
        and value["id"] > 0
        and type(value.get("location_id")) is int
        and value["location_id"] > 0
        and isinstance(value.get("name"), str)
        and bool(value["name"].strip())
        and (
            value.get("description") is None
            or isinstance(value["description"], str)
        )
        and type(value.get("is_active")) is bool
        and (
            value.get("location") is None
            or (
                _is_location_record(value["location"])
                and value["location"]["id"] == value["location_id"]
            )
        )
    )


@app.get("/api/admin/resources")
@require_auth(admin_only=True)
def list_admin_resources():
    """List the latest resources, including inactive ones, for administrators."""

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/resources",
            headers=g.supabase_headers,
            params={
                "select": (
                    "id,location_id,name,description,is_active,created_at,"
                    "location:locations(id,name,is_active)"
                ),
                "order": "created_at.desc,id.desc",
                "limit": "100",
            },
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error("Your session expired. Please sign in again.", 401)

        if response.status_code == 403:
            return api_error("Administrator access to resources was denied.", 403)

        response.raise_for_status()
        resources = response.json()

        if not isinstance(resources, list) or not all(
            _is_resource_record(resource) for resource in resources
        ):
            return api_error("Invalid administrator resource response.", 502)

        result = jsonify({"status": "ok", "resources": resources})
        result.headers["Cache-Control"] = "no-store"
        return result

    except httpx.TimeoutException:
        return api_error("Loading resources timed out. Please try again.", 503)

    except (httpx.HTTPError, ValueError):
        return api_error("Unable to load administrator resources. Please try again.", 502)


@app.post("/api/admin/resources")
@require_auth(admin_only=True)
def create_admin_resource():
    """Create a resource at an active location with the administrator's token."""

    payload = request.get_json(silent=True)

    if (
        not isinstance(payload, dict)
        or not {"location_id", "name"} <= set(payload)
        or set(payload) - {"location_id", "name", "description"}
    ):
        return api_error(
            "Send location_id, name, and an optional description.",
            400,
        )

    location_id = payload["location_id"]
    name = payload["name"]
    description = payload.get("description")

    if (
        type(location_id) is not int
        or location_id < 1
        or location_id > 9223372036854775807
    ):
        return api_error("location_id must be a positive integer.", 400)

    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
        return api_error("Resource name must be between 1 and 120 characters.", 400)

    name = name.strip()

    if description is not None:
        if not isinstance(description, str) or len(description.strip()) > 1000:
            return api_error("Description must be text of at most 1000 characters.", 400)

        description = description.strip() or None

    try:
        # Two short database calls leave time for the existing auth checks.
        # Keep using the user's token; never use a service-role key here.
        location_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/locations",
            headers=g.supabase_headers,
            params={
                "select": "id,name,is_active",
                "id": f"eq.{location_id}",
                "is_active": "eq.true",
                "limit": "1",
            },
            timeout=5.0,
        )

        if location_response.status_code == 401:
            return api_error("Your session expired. Please sign in again.", 401)

        if location_response.status_code == 403:
            return api_error("Access to the selected location was denied.", 403)

        location_response.raise_for_status()
        locations = location_response.json()

        if not isinstance(locations, list):
            return api_error("Invalid selected location response.", 502)

        if len(locations) == 0:
            return api_error("Choose an existing active location. Refresh the list.", 404)

        if (
            len(locations) != 1
            or not _is_location_record(locations[0])
            or locations[0]["id"] != location_id
            or locations[0]["is_active"] is not True
        ):
            return api_error("Invalid selected location response.", 502)

        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/resources",
            headers={
                **g.supabase_headers,
                "Prefer": "return=representation",
            },
            params={"select": "id,location_id,name,description,is_active,created_at"},
            json={
                "location_id": location_id,
                "name": name,
                "description": description,
                "is_active": True,
            },
            timeout=5.0,
        )

        if response.status_code == 401:
            return api_error("Your session expired. Please sign in again.", 401)

        if response.status_code == 403:
            return api_error("Administrator permission to create resources was denied.", 403)

        if response.status_code == 409:
            return api_error(
                "The resource could not be created because its related data changed "
                "or a data conflict occurred. Refresh the lists before trying again.",
                409,
            )

        response.raise_for_status()
        resources = response.json()

        if (
            response.status_code != 201
            or not isinstance(resources, list)
            or len(resources) != 1
            or not _is_resource_record(resources[0])
            or resources[0]["location_id"] != location_id
            or resources[0]["name"] != name
            or resources[0].get("description") != description
            or resources[0]["is_active"] is not True
        ):
            return api_error(
                "The new resource could not be confirmed. "
                "Refresh the resource list before trying again.",
                502,
            )

        result = jsonify(
            {
                "status": "ok",
                "message": "Resource created successfully.",
                "resource": resources[0],
            }
        )
        result.headers["Cache-Control"] = "no-store"
        return result, 201

    except httpx.TimeoutException:
        return api_error(
            "Resource confirmation timed out. "
            "Refresh the resource list before trying again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error(
            "Unable to confirm the new resource. "
            "Refresh the resource list before trying again.",
            502,
        )


def _parse_slot_timestamp(value):
    """Require an explicit timezone and normalize API timestamps to UTC."""

    if not isinstance(value, str) or len(value) > 50 or "T" not in value:
        raise ValueError("An ISO timestamp with a timezone is required")

    try:
        normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
        parsed = datetime.fromisoformat(normalized)

        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("A timezone is required")

        return parsed.astimezone(timezone.utc)

    except (ValueError, OverflowError) as error:
        raise ValueError("Invalid timezone-aware timestamp") from error


def _is_slot_record(value):
    """Validate the time-slot data used by the administrator screen."""

    if (
        not isinstance(value, dict)
        or type(value.get("id")) is not int
        or value["id"] < 1
        or type(value.get("resource_id")) is not int
        or value["resource_id"] < 1
        or type(value.get("is_active")) is not bool
        or (
            value.get("resource") is not None
            and (
                not _is_resource_record(value["resource"])
                or value["resource"]["id"] != value["resource_id"]
            )
        )
    ):
        return False

    try:
        return _parse_slot_timestamp(value.get("end_time")) > _parse_slot_timestamp(
            value.get("start_time")
        )
    except ValueError:
        return False


@app.get("/api/admin/time-slots")
@require_auth(admin_only=True)
def list_admin_time_slots():
    """List the next upcoming slots without exposing booking owners."""

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/time_slots",
            headers=g.supabase_headers,
            params={
                "select": (
                    "id,resource_id,start_time,end_time,is_active,created_at,"
                    "resource:resources(id,location_id,name,is_active,"
                    "location:locations(id,name,is_active)),bookings(status)"
                ),
                "start_time": f"gt.{datetime.now(timezone.utc).isoformat()}",
                "bookings.status": "eq.active",
                "order": "start_time.asc,id.asc",
                "limit": "100",
            },
            timeout=10.0,
        )

        if response.status_code == 401:
            return api_error("Your session expired. Please sign in again.", 401)

        if response.status_code == 403:
            return api_error("Administrator access to time slots was denied.", 403)

        response.raise_for_status()
        slots = response.json()

        if not isinstance(slots, list) or not all(
            _is_slot_record(slot) for slot in slots
        ):
            return api_error("Invalid administrator time-slot response.", 502)

        for slot in slots:
            bookings = slot.pop("bookings", None)

            if not isinstance(bookings, list) or any(
                not isinstance(booking, dict)
                or booking.get("status") not in ("active", "cancelled")
                for booking in bookings
            ):
                return api_error("Invalid slot availability response.", 502)

            resource = slot.get("resource")
            location = resource.get("location") if resource is not None else None
            slot["is_available"] = (
                slot["is_active"] is True
                and resource is not None
                and resource["is_active"] is True
                and location is not None
                and location["is_active"] is True
                and not any(booking["status"] == "active" for booking in bookings)
            )

        result = jsonify({"status": "ok", "slots": slots})
        result.headers["Cache-Control"] = "no-store"
        return result

    except httpx.TimeoutException:
        return api_error("Loading time slots timed out. Please try again.", 503)

    except (httpx.HTTPError, ValueError):
        return api_error("Unable to load administrator time slots. Please try again.", 502)


@app.post("/api/admin/time-slots")
@require_auth(admin_only=True)
def create_admin_time_slot():
    """Create a future slot; PostgreSQL atomically prevents overlaps."""

    payload = request.get_json(silent=True)

    if not isinstance(payload, dict) or set(payload) != {
        "resource_id", "start_time", "end_time"
    }:
        return api_error(
            "Send a JSON object containing only resource_id, start_time, and end_time.",
            400,
        )

    resource_id = payload["resource_id"]

    if (
        type(resource_id) is not int
        or resource_id < 1
        or resource_id > 9223372036854775807
    ):
        return api_error("resource_id must be a positive integer.", 400)

    try:
        start = _parse_slot_timestamp(payload["start_time"])
        end = _parse_slot_timestamp(payload["end_time"])
    except ValueError:
        return api_error("Start and end must be valid timestamps with a timezone.", 400)

    now = datetime.now(timezone.utc)

    if start <= now:
        return api_error("The slot must start in the future.", 400)

    if start >= now + timedelta(days=30):
        return api_error("Choose a start within the next 30 days.", 400)

    if end <= start:
        return api_error("The end time must be after the start time.", 400)

    try:
        parent_response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/resources",
            headers=g.supabase_headers,
            params={
                "select": "id,location_id,name,is_active,location:locations!inner(id,name,is_active)",
                "id": f"eq.{resource_id}",
                "is_active": "eq.true",
                "location.is_active": "eq.true",
                "limit": "1",
            },
            timeout=5.0,
        )

        if parent_response.status_code == 401:
            return api_error("Your session expired. Please sign in again.", 401)

        if parent_response.status_code == 403:
            return api_error("Access to the selected resource was denied.", 403)

        parent_response.raise_for_status()
        resources = parent_response.json()

        if not isinstance(resources, list):
            return api_error("Invalid selected resource response.", 502)

        if len(resources) == 0:
            return api_error("Choose an active room at an active location. Refresh the lists.", 404)

        if (
            len(resources) != 1
            or not _is_resource_record(resources[0])
            or resources[0]["id"] != resource_id
            or resources[0]["is_active"] is not True
            or resources[0].get("location") is None
            or resources[0]["location"]["is_active"] is not True
        ):
            return api_error("Invalid selected resource response.", 502)

        # The parent check can take time; do not insert a start that has since passed.
        if start <= datetime.now(timezone.utc):
            return api_error("The start time has already passed. Choose a future time.", 400)

        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/time_slots",
            headers={
                **g.supabase_headers,
                "Prefer": "return=representation",
            },
            params={"select": "id,resource_id,start_time,end_time,is_active,created_at"},
            json={
                "resource_id": resource_id,
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "is_active": True,
            },
            timeout=5.0,
        )

        if response.status_code == 401:
            return api_error("Your session expired. Please sign in again.", 401)

        if response.status_code == 403:
            return api_error("Administrator permission to create time slots was denied.", 403)

        if response.status_code in (400, 409):
            details = response.json()
            error_code = details.get("code") if isinstance(details, dict) else None

            # PostgREST may report an exclusion-constraint failure as HTTP 400.
            if error_code == "23P01":
                return api_error(
                    "This time overlaps an existing slot for this room. "
                    "Choose another time; adjacent slots are allowed.",
                    409,
                )

            if error_code in ("23503", "23505"):
                return api_error(
                    "The room changed or a data conflict occurred. Refresh before trying again.",
                    409,
                )

            if error_code == "23514":
                return api_error("The time slot does not meet the database rules.", 400)

        response.raise_for_status()
        slots = response.json()

        if (
            response.status_code != 201
            or not isinstance(slots, list)
            or len(slots) != 1
            or not _is_slot_record(slots[0])
            or slots[0]["resource_id"] != resource_id
            or slots[0]["is_active"] is not True
            or _parse_slot_timestamp(slots[0]["start_time"]) != start
            or _parse_slot_timestamp(slots[0]["end_time"]) != end
        ):
            return api_error(
                "The new slot could not be confirmed. Refresh the time-slot list before trying again.",
                502,
            )

        result = jsonify(
            {
                "status": "ok",
                "message": "Time slot created successfully.",
                "slot": slots[0],
            }
        )
        result.headers["Cache-Control"] = "no-store"
        return result, 201

    except httpx.TimeoutException:
        return api_error(
            "Time-slot confirmation timed out. Refresh the time-slot list before trying again.",
            503,
        )

    except (httpx.HTTPError, ValueError):
        return api_error(
            "Unable to confirm the new time slot. Refresh the time-slot list before trying again.",
            502,
        )


if __name__ == "__main__":
    # Local development only.
    app.run(debug=True, port=5000)
