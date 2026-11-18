from unittest.mock import Mock, patch

import pytest

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True

    with app.test_client() as test_client:
        yield test_client


def _unwrap(view_name):
    """Return the route without the authentication wrapper for mocked API tests."""
    return app.view_functions[view_name].__wrapped__


def _mock_request_context(user_id="test-user"):
    """Add the values normally created by require_auth."""
    from flask import g

    g.user = {"id": user_id}
    g.profile = {
        "id": user_id,
        "email": "student@example.com",
        "role": "user",
        "is_active": True,
    }
    g.supabase_headers = {
        "apikey": "test-key",
        "Authorization": "Bearer test-token",
    }


def test_create_booking_requires_authentication(client):
    response = client.post(
        "/api/bookings",
        json={"time_slot_id": 10},
    )

    assert response.status_code == 401
    assert response.get_json()["status"] == "error"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"time_slot_id": 0},
        {"time_slot_id": -1},
        {"time_slot_id": True},
        {"time_slot_id": "10"},
        {"time_slot_id": 10, "user_id": "someone-else"},
        {"time_slot_id": 10, "status": "active"},
    ],
)
def test_create_booking_rejects_invalid_payload(payload):
    view = _unwrap("create_booking")

    with app.test_request_context(
        "/api/bookings",
        method="POST",
        json=payload,
    ):
        _mock_request_context()

        response, status = view()

    assert status == 400
    assert response.get_json()["status"] == "error"


@patch("app.httpx.post")
def test_create_booking_success(mock_post):
    mock_response = Mock()
    mock_response.status_code = 201
    mock_response.json.return_value = [
        {
            "id": 50,
            "time_slot_id": 10,
            "status": "active",
            "created_at": "2026-11-18T18:00:00+00:00",
        }
    ]
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    view = _unwrap("create_booking")

    with app.test_request_context(
        "/api/bookings",
        method="POST",
        json={"time_slot_id": 10},
    ):
        _mock_request_context("user-one")

        response, status = view()

    assert status == 201

    data = response.get_json()

    assert data["status"] == "ok"
    assert data["booking"]["id"] == 50
    assert data["booking"]["time_slot_id"] == 10
    assert data["booking"]["status"] == "active"

    sent_json = mock_post.call_args.kwargs["json"]

    # Ownership must come from the authenticated user, not the browser.
    assert sent_json["user_id"] == "user-one"
    assert sent_json["time_slot_id"] == 10


@patch("app.httpx.post")
def test_create_booking_duplicate_slot_returns_409(mock_post):
    mock_response = Mock()
    mock_response.status_code = 409
    mock_response.json.return_value = {
        "code": "23505",
        "message": "duplicate key value violates unique constraint",
    }
    mock_post.return_value = mock_response

    view = _unwrap("create_booking")

    with app.test_request_context(
        "/api/bookings",
        method="POST",
        json={"time_slot_id": 10},
    ):
        _mock_request_context("user-two")

        response, status = view()

    assert status == 409

    data = response.get_json()

    assert data["status"] == "error"
    assert "already booked" in data["message"].lower()


@patch("app.httpx.post")
def test_create_booking_foreign_key_conflict_returns_409(mock_post):
    mock_response = Mock()
    mock_response.status_code = 409
    mock_response.json.return_value = {
        "code": "23503",
        "message": "foreign key violation",
    }
    mock_post.return_value = mock_response

    view = _unwrap("create_booking")

    with app.test_request_context(
        "/api/bookings",
        method="POST",
        json={"time_slot_id": 999},
    ):
        _mock_request_context()

        response, status = view()

    assert status == 409
    assert response.get_json()["status"] == "error"


def test_cancel_booking_requires_authentication(client):
    response = client.post("/api/bookings/1/cancel")

    assert response.status_code == 401
    assert response.get_json()["status"] == "error"


@patch("app.httpx.post")
def test_cancel_own_booking_success(mock_post):
    mock_response = Mock()
    mock_response.status_code = 204
    mock_response.content = b""
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    view = _unwrap("cancel_booking")

    with app.test_request_context(
        "/api/bookings/25/cancel",
        method="POST",
    ):
        _mock_request_context("booking-owner")

        response = view(25)

    assert response.status_code == 200

    data = response.get_json()

    assert data["status"] == "ok"
    assert data["booking"]["id"] == 25
    assert data["booking"]["status"] == "cancelled"

    assert mock_post.call_args.kwargs["json"] == {
        "booking_id": 25
    }


@patch("app.httpx.post")
def test_cancel_missing_or_other_users_booking_returns_404(mock_post):
    mock_response = Mock()
    mock_response.status_code = 400
    mock_response.json.return_value = {
        "code": "P0001",
        "message": "Booking not found",
    }
    mock_post.return_value = mock_response

    view = _unwrap("cancel_booking")

    with app.test_request_context(
        "/api/bookings/999/cancel",
        method="POST",
    ):
        _mock_request_context("user-one")

        response, status = view(999)

    assert status == 404

    data = response.get_json()

    assert data["status"] == "error"

    # The response intentionally does not reveal whether the booking
    # is missing, cancelled, or belongs to another user.
    assert "not found" in data["message"].lower()