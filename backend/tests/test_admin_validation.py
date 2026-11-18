import pytest

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True

    with app.test_client() as test_client:
        yield test_client


def test_location_patch_requires_authentication(client):
    response = client.patch(
        "/api/admin/locations/1",
        json={"name": "Updated Location"},
    )

    assert response.status_code == 401
    assert response.get_json()["status"] == "error"


def test_resource_patch_requires_authentication(client):
    response = client.patch(
        "/api/admin/resources/1",
        json={"name": "Updated Resource"},
    )

    assert response.status_code == 401
    assert response.get_json()["status"] == "error"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"organization_id": 1},
        {"name": "Room", "organization_id": 1},
        {"location_id": 2},
    ],
)
def test_location_patch_rejects_invalid_fields(client, monkeypatch, payload):
    monkeypatch.setattr(
        "app.require_auth",
        lambda *args, **kwargs: lambda function: function,
    )

    # Authentication decorators are already attached when app.py is imported,
    # so invalid-field behavior is covered separately through the
    # undecorated Flask view.
    view = app.view_functions["update_admin_location"]
    undecorated_view = view.__wrapped__

    with app.test_request_context(
        "/api/admin/locations/1",
        method="PATCH",
        json=payload,
    ):
        response, status = undecorated_view(1)

    assert status == 400
    assert response.get_json()["status"] == "error"


@pytest.mark.parametrize(
    "payload",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 121},
        {"name": 123},
    ],
)
def test_location_patch_rejects_invalid_name(client, payload):
    view = app.view_functions["update_admin_location"]
    undecorated_view = view.__wrapped__

    with app.test_request_context(
        "/api/admin/locations/1",
        method="PATCH",
        json=payload,
    ):
        response, status = undecorated_view(1)

    assert status == 400


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"location_id": 2},
        {"organization_id": 1},
        {"name": "Room", "location_id": 2},
    ],
)
def test_resource_patch_rejects_invalid_fields(client, payload):
    view = app.view_functions["update_admin_resource"]
    undecorated_view = view.__wrapped__

    with app.test_request_context(
        "/api/admin/resources/1",
        method="PATCH",
        json=payload,
    ):
        response, status = undecorated_view(1)

    assert status == 400
    assert response.get_json()["status"] == "error"


@pytest.mark.parametrize(
    "payload",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 121},
        {"name": False},
    ],
)
def test_resource_patch_rejects_invalid_name(client, payload):
    view = app.view_functions["update_admin_resource"]
    undecorated_view = view.__wrapped__

    with app.test_request_context(
        "/api/admin/resources/1",
        method="PATCH",
        json=payload,
    ):
        response, status = undecorated_view(1)

    assert status == 400


def test_location_patch_rejects_long_address(client):
    view = app.view_functions["update_admin_location"]
    undecorated_view = view.__wrapped__

    with app.test_request_context(
        "/api/admin/locations/1",
        method="PATCH",
        json={"address": "x" * 251},
    ):
        response, status = undecorated_view(1)

    assert status == 400


def test_resource_patch_rejects_long_description(client):
    view = app.view_functions["update_admin_resource"]
    undecorated_view = view.__wrapped__

    with app.test_request_context(
        "/api/admin/resources/1",
        method="PATCH",
        json={"description": "x" * 1001},
    ):
        response, status = undecorated_view(1)

    assert status == 400


# ------------------------------------------------------------
# Time-slot activation validation
# ------------------------------------------------------------

def test_time_slot_patch_requires_authentication(client):
    response = client.patch(
        "/api/admin/time-slots/1",
        json={"is_active": False},
    )

    assert response.status_code == 401
    assert response.get_json()["status"] == "error"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"is_active": "false"},
        {"is_active": 0},
        {"is_active": 1},
        {"is_active": None},
        {"is_active": False, "resource_id": 2},
        {"status": False},
    ],
)
def test_time_slot_patch_rejects_invalid_payload(payload):
    view = app.view_functions["update_admin_time_slot"]
    undecorated_view = view.__wrapped__

    with app.test_request_context(
        "/api/admin/time-slots/1",
        method="PATCH",
        json=payload,
    ):
        response, status = undecorated_view(1)

    assert status == 400
    assert response.get_json()["status"] == "error"


@pytest.mark.parametrize(
    "slot_id",
    [
        0,
        -1,
        9223372036854775808,
    ],
)
def test_time_slot_patch_rejects_invalid_id(slot_id):
    view = app.view_functions["update_admin_time_slot"]
    undecorated_view = view.__wrapped__

    with app.test_request_context(
        f"/api/admin/time-slots/{slot_id}",
        method="PATCH",
        json={"is_active": False},
    ):
        response, status = undecorated_view(slot_id)

    assert status == 400
    assert response.get_json()["status"] == "error"