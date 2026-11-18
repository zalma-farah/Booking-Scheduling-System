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

    # ------------------------------------------------------------
# Administrator managed-booking list tests
# ------------------------------------------------------------

def test_admin_bookings_requires_authentication(client):
    response = client.get("/api/admin/bookings")

    assert response.status_code == 401
    assert response.get_json()["status"] == "error"


@pytest.mark.parametrize(
    "query_string",
    [
        "status=banana",
        "status=ACTIVE",
        "resource_id=abc",
        "resource_id=0",
        "resource_id=-1",
        "resource_id=1.5",
        "organization_id=1",
        "user_id=test-user",
        "status=active&unknown=value",
    ],
)
def test_admin_bookings_rejects_invalid_filters(query_string):
    view = _unwrap("list_admin_bookings")

    with app.test_request_context(
        f"/api/admin/bookings?{query_string}",
        method="GET",
    ):
        _mock_request_context("admin-user")

        response, status = view()

    assert status == 400
    assert response.get_json()["status"] == "error"


@patch("app.httpx.get")
def test_admin_bookings_lists_all_bookings(mock_get):
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "id": 101,
            "user_id": "customer-one",
            "time_slot_id": 25,
            "status": "active",
            "created_at": "2026-11-18T18:00:00+00:00",
            "cancelled_at": None,
            "slot": {
                "id": 25,
                "resource_id": 5,
                "start_time": "2026-11-20T18:00:00+00:00",
                "end_time": "2026-11-20T19:00:00+00:00",
                "resource": {
                    "id": 5,
                    "location_id": 2,
                    "name": "Study Room",
                    "location": {
                        "id": 2,
                        "name": "Library",
                    },
                },
            },
        }
    ]
    mock_response.raise_for_status.return_value = None
    mock_get.return_value = mock_response

    view = _unwrap("list_admin_bookings")

    with app.test_request_context(
        "/api/admin/bookings",
        method="GET",
    ):
        _mock_request_context("admin-user")

        response = view()

    assert response.status_code == 200

    data = response.get_json()

    assert data["status"] == "ok"
    assert len(data["bookings"]) == 1
    assert data["bookings"][0]["id"] == 101
    assert data["bookings"][0]["status"] == "active"

    params = mock_get.call_args.kwargs["params"]

    assert "status" not in params
    assert "slot.resource_id" not in params
    assert params["limit"] == "100"
    assert params["order"] == "created_at.desc,id.desc"


@patch("app.httpx.get")
def test_admin_bookings_applies_status_filter(mock_get):
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = []
    mock_response.raise_for_status.return_value = None
    mock_get.return_value = mock_response

    view = _unwrap("list_admin_bookings")

    with app.test_request_context(
        "/api/admin/bookings?status=cancelled",
        method="GET",
    ):
        _mock_request_context("admin-user")

        response = view()

    assert response.status_code == 200

    params = mock_get.call_args.kwargs["params"]

    assert params["status"] == "eq.cancelled"


@patch("app.httpx.get")
def test_admin_bookings_applies_resource_filter(mock_get):
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = []
    mock_response.raise_for_status.return_value = None
    mock_get.return_value = mock_response

    view = _unwrap("list_admin_bookings")

    with app.test_request_context(
        "/api/admin/bookings?resource_id=5",
        method="GET",
    ):
        _mock_request_context("admin-user")

        response = view()

    assert response.status_code == 200

    params = mock_get.call_args.kwargs["params"]

    assert params["slot.resource_id"] == "eq.5"


@patch("app.httpx.get")
def test_admin_bookings_applies_combined_filters(mock_get):
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = []
    mock_response.raise_for_status.return_value = None
    mock_get.return_value = mock_response

    view = _unwrap("list_admin_bookings")

    with app.test_request_context(
        "/api/admin/bookings?status=active&resource_id=8",
        method="GET",
    ):
        _mock_request_context("admin-user")

        response = view()

    assert response.status_code == 200

    params = mock_get.call_args.kwargs["params"]

    assert params["status"] == "eq.active"
    assert params["slot.resource_id"] == "eq.8"

    # ------------------------------------------------------------
# Administrator managed-booking cancellation tests
# ------------------------------------------------------------

def test_admin_cancel_booking_requires_authentication(client):
    response = client.post(
        "/api/admin/bookings/10/cancel"
    )

    assert response.status_code == 401
    assert response.get_json()["status"] == "error"


@pytest.mark.parametrize(
    "booking_id",
    [
        0,
        -1,
        9223372036854775808,
    ],
)
def test_admin_cancel_booking_rejects_invalid_id(booking_id):
    view = _unwrap("cancel_admin_booking")

    with app.test_request_context(
        f"/api/admin/bookings/{booking_id}/cancel",
        method="POST",
    ):
        _mock_request_context("admin-user")

        response, status = view(booking_id)

    assert status == 400
    assert response.get_json()["status"] == "error"


def test_admin_cancel_booking_rejects_client_body():
    view = _unwrap("cancel_admin_booking")

    with app.test_request_context(
        "/api/admin/bookings/10/cancel",
        method="POST",
        json={
            "user_id": "another-user",
            "status": "cancelled",
        },
    ):
        _mock_request_context("admin-user")

        response, status = view(10)

    assert status == 400
    assert response.get_json()["status"] == "error"


@patch("app.httpx.post")
def test_admin_cancel_booking_success(mock_post):
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "id": 10,
        "time_slot_id": 25,
        "status": "cancelled",
        "created_at": "2026-11-18T18:00:00+00:00",
        "cancelled_at": "2026-11-18T19:00:00+00:00",
    }
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    view = _unwrap("cancel_admin_booking")

    with app.test_request_context(
        "/api/admin/bookings/10/cancel",
        method="POST",
    ):
        _mock_request_context("admin-user")

        response = view(10)

    assert response.status_code == 200

    data = response.get_json()

    assert data["status"] == "ok"
    assert data["booking"]["id"] == 10
    assert data["booking"]["status"] == "cancelled"
    assert data["booking"]["cancelled_at"] is not None

    assert mock_post.call_args.kwargs["json"] == {
        "booking_id": 10
    }

    assert (
        "/rpc/cancel_managed_booking"
        in mock_post.call_args.args[0]
    )


@patch("app.httpx.post")
def test_admin_cancel_foreign_or_missing_booking_returns_404(mock_post):
    mock_response = Mock()
    mock_response.status_code = 400
    mock_response.json.return_value = {
        "code": "P0001",
        "message": "Booking cannot be managed",
    }
    mock_post.return_value = mock_response

    view = _unwrap("cancel_admin_booking")

    with app.test_request_context(
        "/api/admin/bookings/999/cancel",
        method="POST",
    ):
        _mock_request_context("admin-user")

        response, status = view(999)

    assert status == 404

    data = response.get_json()

    assert data["status"] == "error"
    assert "not found" in data["message"].lower()


@patch("app.httpx.post")
def test_admin_cancel_booking_conflict_returns_409(mock_post):
    mock_response = Mock()
    mock_response.status_code = 409
    mock_response.json.return_value = {
        "code": "23514",
        "message": "booking state changed",
    }
    mock_post.return_value = mock_response

    view = _unwrap("cancel_admin_booking")

    with app.test_request_context(
        "/api/admin/bookings/10/cancel",
        method="POST",
    ):
        _mock_request_context("admin-user")

        response, status = view(10)

    assert status == 409
    assert response.get_json()["status"] == "error"