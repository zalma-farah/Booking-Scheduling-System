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

        # Only log short error-code-style values.
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
    """Verify the access token and account profile."""

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

            token = parts[1]

            # Keep each user's token local to this request.
            headers = {
                "apikey": SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {token}",
            }

            try:
                # Ask Supabase Auth to verify the supplied token.
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

                # Read the profile using the verified user's ID.
                # Their access token keeps database RLS in effect.
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
                    return api_error(
                        "Invalid profile response.",
                        502,
                    )

                if len(profiles) != 1:
                    return api_error(
                        "An account profile is required.",
                        403,
                    )

                profile = profiles[0]

                if not isinstance(profile, dict):
                    return api_error(
                        "Invalid profile response.",
                        502,
                    )

                if profile.get("is_active") is not True:
                    return api_error(
                        "Your account is inactive.",
                        403,
                    )

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

            # These values exist only for the current request.
            g.user = user
            g.profile = profile

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
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY,
            },
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


if __name__ == "__main__":
    # Development server only.
    app.run(debug=True, port=5000)