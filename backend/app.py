import os

import httpx
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from supabase import Client, create_client


# Always load backend/.env, even if Flask is started from another folder.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
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
)

# Prepare the Supabase client for future database routes.
supabase: Client | None = None

if SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY:
    supabase = create_client(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
    )


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
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Supabase environment variables are missing",
                }
            ),
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

    except httpx.HTTPError as error:
        app.logger.error("Supabase connection failed: %s", error)

        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Flask could not connect to Supabase",
                }
            ),
            502,
        )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
