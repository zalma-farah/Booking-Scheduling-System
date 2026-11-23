"""Public status must not authenticate visitors or grant reservation access."""
from unittest.mock import patch
import httpx
import pytest
import app as module
from tests.test_management_integration import client, reply
from tests.test_kiosk_status import snapshot


@pytest.fixture(autouse=True)
def public_config(client, monkeypatch):
    monkeypatch.setattr(module, 'SUPABASE_URL', 'https://example.invalid')
    monkeypatch.setattr(module, 'SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')


def test_public_status_without_session_and_without_forwarded_credentials(client):
    with patch('app.httpx.get') as auth, patch('app.httpx.post', return_value=reply(snapshot())) as rpc:
        response = client.get('/api/public/rooms/7/status', headers={'Authorization': 'Bearer visitor-secret'})
    assert response.status_code == 200
    assert response.json['state'] == 'in_use'
    assert response.headers['Cache-Control'] == 'no-store'
    auth.assert_not_called()
    assert rpc.call_args.args[0].endswith('/rpc/get_public_room_kiosk_status')
    assert rpc.call_args.kwargs['headers'] == {'apikey': 'sb_publishable_test'}
    assert rpc.call_args.kwargs['json'] == {'p_resource_id': 7}


def test_public_response_strips_private_fields(client):
    data = snapshot()
    data['email'] = 'private@example.invalid'
    data['resource']['address'] = 'private-address'
    data['slots'][0]['user_id'] = 'private-user'
    with patch('app.httpx.post', return_value=reply(data)):
        response = client.get('/api/public/rooms/7/status')
    assert response.status_code == 200
    assert 'private' not in response.get_data(as_text=True)


@pytest.mark.parametrize('room_id', [0, 9007199254740992])
def test_public_invalid_id_never_calls_rpc(client, room_id):
    with patch('app.httpx.post') as rpc:
        assert client.get(f'/api/public/rooms/{room_id}/status').status_code == 400
        rpc.assert_not_called()


def test_missing_config_fails_closed(client, monkeypatch):
    monkeypatch.setattr(module, 'SUPABASE_PUBLISHABLE_KEY', '')
    with patch('app.httpx.post') as rpc:
        assert client.get('/api/public/rooms/7/status').status_code == 503
        rpc.assert_not_called()


@pytest.mark.parametrize('payload,status,expected', [
    ({'code': 'P0002'}, 400, 404), ({'code': 'PGRST202'}, 404, 503),
    ({'code': '42501'}, 403, 502), ({'secret': 'private'}, 500, 502),
    (None, 200, 502), ({'state': 'available'}, 200, 502),
])
def test_public_errors_do_not_become_available(client, payload, status, expected):
    with patch('app.httpx.post', return_value=reply(payload, status)):
        response = client.get('/api/public/rooms/7/status')
    assert response.status_code == expected
    assert response.headers['Cache-Control'] == 'no-store'
    assert 'state' not in response.json
    assert 'private' not in response.get_data(as_text=True)


def test_public_timeout_fails_closed(client):
    with patch('app.httpx.post', side_effect=httpx.ReadTimeout('test')):
        assert client.get('/api/public/rooms/7/status').status_code == 503


def test_public_route_has_no_write_methods(client):
    for method in ['post', 'patch', 'delete']:
        assert getattr(client, method)('/api/public/rooms/7/status').status_code == 405


def test_existing_booking_and_management_still_require_auth(client):
    with patch('app.httpx.post') as rpc:
        assert client.post('/api/bookings', json={'time_slot_id': 1}).status_code == 401
        assert client.get('/api/admin/locations').status_code == 401
        assert client.get('/api/resources/7/status').status_code == 401
        rpc.assert_not_called()
