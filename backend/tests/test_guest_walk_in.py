from unittest.mock import patch
import httpx
import pytest
from tests.test_management_integration import client, identity, reply, HEADERS

KEY = '10000000-0000-4000-8000-000000000001'
END = '2026-11-22T19:30:00+00:00'
BODY = {'end_time': END, 'request_id': KEY}
RECEIPT = {'resource_id': 7, 'start_time': '2026-11-22T18:30:00Z', 'end_time': END, 'request_id': KEY, 'status': 'active'}
QUOTE = {'resource_id': 7, 'checked_at': '2026-11-22T18:30:00Z', 'available_until': END, 'max_minutes': 120}


def test_guest_create_no_auth_or_user_identity(client):
    with patch('app.httpx.get') as auth, patch('app.httpx.post', return_value=reply({**RECEIPT, 'private': 'do-not-return'})) as rpc:
        response = client.post('/api/public/rooms/7/walk-in', json=BODY, headers=HEADERS)
    assert response.status_code == 200
    assert response.json['reservation']['request_id'] == KEY
    assert 'private' not in response.get_data(as_text=True)
    assert 'Authorization' not in rpc.call_args.kwargs['headers']
    assert rpc.call_args.args[0].endswith('/rpc/create_guest_walk_in')
    assert rpc.call_args.kwargs['json'] == {'p_resource_id': 7, 'p_end_time': END, 'p_request_id': KEY}
    assert response.headers['Cache-Control'] == 'no-store'
    auth.assert_not_called()


@pytest.mark.parametrize('body', [None, {}, {'end_time': END}, {**BODY, 'user_id': 'spoof'},
    {**BODY, 'end_time': 'bad'}, {**BODY, 'end_time': '2026-11-22T19:30:00'},
    {**BODY, 'request_id': None}, {**BODY, 'request_id': '123'}, {**BODY, 'request_id': 4}])
def test_invalid_guest_requests_never_reach_database(client, body):
    with patch('app.httpx.post') as rpc:
        assert client.post('/api/public/rooms/7/walk-in', json=body).status_code == 400
        rpc.assert_not_called()


@pytest.mark.parametrize('record_id', [0, 9007199254740992])
def test_invalid_guest_room(client, record_id):
    with patch('app.httpx.post') as rpc:
        assert client.post(f'/api/public/rooms/{record_id}/walk-in', json=BODY).status_code == 400
        rpc.assert_not_called()


@pytest.mark.parametrize('code,expected', [('23514',409), ('23505',409), ('23P01',409),
    ('P0002',404), ('22023',400), ('PGRST202',503)])
def test_guest_errors_are_not_success(client, code, expected):
    with patch('app.httpx.post', return_value=reply({'code': code, 'message': 'private-detail'}, 404 if code=='PGRST202' else 400)):
        response = client.post('/api/public/rooms/7/walk-in', json=BODY)
    assert response.status_code == expected
    assert 'reservation' not in response.json
    assert 'private-detail' not in response.get_data(as_text=True)


@pytest.mark.parametrize('change', [lambda d:d.update(resource_id=8), lambda d:d.update(request_id='wrong'),
    lambda d:d.update(end_time='2026-11-22T20:30:00Z'), lambda d:d.update(status='unknown')])
def test_invalid_confirmation_cannot_claim_saved(client, change):
    value = dict(RECEIPT); change(value)
    with patch('app.httpx.post', return_value=reply(value)):
        assert client.post('/api/public/rooms/7/walk-in', json=BODY).status_code == 502


def test_guest_timeout_is_uncertain_not_failure_to_save(client):
    with patch('app.httpx.post', side_effect=httpx.ReadTimeout('test')):
        response = client.post('/api/public/rooms/7/walk-in', json=BODY)
    assert response.status_code == 503
    assert 'same request' in response.json['message']


def test_quote_is_public_and_whitelisted(client):
    with patch('app.httpx.post', return_value=reply({**QUOTE, 'source_slot_id': 99})):
        response = client.get('/api/public/rooms/7/walk-in')
    assert response.status_code == 200
    assert 'source_slot_id' not in response.json


@pytest.mark.parametrize('change', [lambda d:d.update(max_minutes=500), lambda d:d.update(available_until='bad'),
    lambda d:d.update(available_until='2026-11-22T21:30:00Z'), lambda d:d.update(resource_id=8)])
def test_bad_quote_fails_closed(client, change):
    value = dict(QUOTE); change(value)
    with patch('app.httpx.post', return_value=reply(value)):
        assert client.get('/api/public/rooms/7/walk-in').status_code == 502


def test_public_room_directory_projection(client):
    data = {'rooms':[{'id':7,'name':'Room','location':{'id':1,'name':'Library','address':'private'}}], 'next_after':None}
    with patch('app.httpx.post', return_value=reply(data)):
        response = client.get('/api/public/walk-in/rooms')
    assert response.status_code == 200
    assert 'private' not in response.get_data(as_text=True)


@pytest.mark.parametrize('query', ['after=-1','after=bad','after=9007199254740992','other=true'])
def test_bad_directory_cursor_no_rpc(client, query):
    with patch('app.httpx.post') as rpc:
        assert client.get('/api/public/walk-in/rooms?'+query).status_code == 400
        rpc.assert_not_called()


@pytest.mark.parametrize('path', ['/api/admin/walk-ins', '/api/admin/walk-ins/1/cancel'])
def test_guest_cannot_list_or_cancel_walk_ins(client, path):
    method = client.post if path.endswith('cancel') else client.get
    with patch('app.httpx.post') as rpc:
        assert method(path).status_code == 401
        rpc.assert_not_called()


def test_admin_cancel_uses_user_token_and_validates_result(client):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', side_effect=[
        reply([{'id':7,'code':'SDSU','name':'SDSU'}]), reply({'id':1,'status':'cancelled'})]) as rpc:
        response = client.post('/api/admin/walk-ins/1/cancel', headers=HEADERS)
    assert response.status_code == 200
    assert rpc.call_args.kwargs['headers']['Authorization'] == HEADERS['Authorization']


def test_normal_user_cannot_cancel_guests(client):
    with patch('app.httpx.get', side_effect=identity('user')), patch('app.httpx.post') as rpc:
        assert client.post('/api/admin/walk-ins/1/cancel', headers=HEADERS).status_code == 403
        rpc.assert_not_called()
