"""Display-only kiosk contracts. No real users, database writes, or HTTP calls."""
from copy import deepcopy
from unittest.mock import patch
import httpx
import pytest
import app as module
from tests.test_management_integration import client, identity, reply, HEADERS


def snapshot():
    return {
        "timezone": "America/Los_Angeles",
        "checked_at": "2026-11-21T18:30:00Z",
        "day_start": "2026-11-21T08:00:00Z",
        "day_end": "2026-11-22T08:00:00Z",
        "resource": {"id": 7, "name": "Study room", "location": {"id": 1, "name": "Library"}},
        "slots": [
            {"id": 1, "start_time": "2026-11-21T18:00:00Z", "end_time": "2026-11-21T19:00:00Z", "is_booked": True},
            {"id": 2, "start_time": "2026-11-21T20:00:00Z", "end_time": "2026-11-21T21:00:00Z", "is_booked": True},
        ],
    }


def request_status(client, value, status=200):
    with patch('app.httpx.get', side_effect=identity('user')), patch('app.httpx.post', return_value=reply(value, status)) as rpc:
        response = client.get('/api/resources/7/status', headers=HEADERS)
        return response, rpc


def test_signed_in_user_sees_booked_and_next_slot(client):
    response, rpc = request_status(client, snapshot())
    assert response.status_code == 200
    assert response.json['state'] == 'in_use'
    assert response.json['current_slot']['id'] == 1
    assert response.json['next_booked_slot']['id'] == 2
    assert response.headers['Cache-Control'] == 'no-store'
    assert rpc.call_args.args[0].endswith('/rpc/get_room_kiosk_status')
    assert rpc.call_args.kwargs['json'] == {'p_resource_id': 7}
    assert rpc.call_args.kwargs['headers']['Authorization'] == HEADERS['Authorization']


def test_booking_cancellation_changes_display_to_available(client):
    value = snapshot()
    value['slots'][0]['is_booked'] = False
    response, _ = request_status(client, value)
    assert response.json['state'] == 'available'
    assert response.json['current_slot'] is None
    assert response.json['next_booked_slot']['id'] == 2


def test_empty_schedule_is_valid(client):
    value = snapshot()
    value['slots'] = []
    response, _ = request_status(client, value)
    assert response.status_code == 200
    assert response.json['slots'] == []
    assert response.json['state'] == 'available'


@pytest.mark.parametrize('checked,state,current', [
    ('2026-11-21T18:00:00Z','in_use',1),
    ('2026-11-21T19:00:00Z','available',None),
])
def test_start_inclusive_end_exclusive(client, checked, state, current):
    value = snapshot()
    value['checked_at'] = checked
    response, _ = request_status(client, value)
    assert response.json['state'] == state
    assert (response.json['current_slot'] or {}).get('id') == current


def test_schedule_sorted_before_selecting_next(client):
    value = snapshot()
    value['slots'].reverse()
    response, _ = request_status(client, value)
    assert [row['id'] for row in response.json['slots']] == [1, 2]


def test_overnight_slot_overlapping_today(client):
    value = snapshot()
    value['slots'] = [{'id': 1, 'start_time': '2026-11-21T07:00:00Z',
                       'end_time': '2026-11-21T09:00:00Z', 'is_booked': True}]
    value['checked_at'] = '2026-11-21T08:30:00Z'
    response, _ = request_status(client, value)
    assert response.json['state'] == 'in_use'


def test_extra_rpc_fields_are_not_exposed(client):
    value = snapshot()
    value['user_email'] = 'private@example.invalid'
    value['resource']['organization_admin_email'] = 'private@example.invalid'
    value['slots'][0]['bookings'] = [{'user_id': 'private-user'}]
    response, _ = request_status(client, value)
    assert response.status_code == 200
    assert 'private' not in response.get_data(as_text=True)
    assert 'bookings' not in response.json['slots'][0]


def test_no_token_denied(client):
    assert client.get('/api/resources/7/status').status_code == 401


def test_inactive_account_denied_before_rpc(client):
    with patch('app.httpx.get', side_effect=identity('user', active=False)), patch('app.httpx.post') as rpc:
        assert client.get('/api/resources/7/status', headers=HEADERS).status_code == 403
        rpc.assert_not_called()


@pytest.mark.parametrize('record_id', [0,9007199254740992])
def test_invalid_id_denied_before_rpc(client, record_id):
    with patch('app.httpx.get', side_effect=identity('user')), patch('app.httpx.post') as rpc:
        assert client.get(f'/api/resources/{record_id}/status', headers=HEADERS).status_code == 400
        rpc.assert_not_called()


@pytest.mark.parametrize('code,status,expected', [
    ('PGRST202',404,503), ('P0002',400,404), ('42501',403,403), ('bad-token',401,401), ('XX000',500,502),
])
def test_rpc_failures_never_report_available(client, code, status, expected):
    response, _ = request_status(client, {'code':code}, status)
    assert response.status_code == expected
    assert response.json.get('state') != 'available'
    assert response.headers['Cache-Control'] == 'no-store'


def test_timeout_is_not_available(client):
    with patch('app.httpx.get', side_effect=identity('user')), patch('app.httpx.post', side_effect=httpx.ReadTimeout('test')):
        assert client.get('/api/resources/7/status',headers=HEADERS).status_code == 503


@pytest.mark.parametrize('change', [
    lambda v: v.update(timezone='UTC'),
    lambda v: v.update(checked_at='broken'),
    lambda v: v.update(day_end='2026-11-23T08:00:00Z'),
    lambda v: v.update(slots=None),
    lambda v: v.update(slots=[deepcopy(v['slots'][0])] * 501),
    lambda v: v['resource'].update(id=8),
    lambda v: v['resource'].update(name=''),
    lambda v: v['resource'].update(location=None),
    lambda v: v['slots'][0].update(id=True),
    lambda v: v['slots'][0].update(is_booked=1),
    lambda v: v['slots'][0].update(start_time='2026-11-21T18:00:00'),
    lambda v: v['slots'][0].update(end_time='2026-11-21T17:00:00Z'),
    lambda v: v['slots'][1].update(id=1),
    lambda v: v['slots'][1].update(start_time='2026-11-21T18:45:00Z'),
    lambda v: v['slots'][0].update(start_time='2026-11-20T01:00:00Z',end_time='2026-11-20T02:00:00Z'),
])
def test_invalid_snapshots_fail_closed(client, change):
    value = snapshot()
    change(value)
    response, _ = request_status(client, value)
    assert response.status_code == 502
    assert 'state' not in response.json


@pytest.mark.parametrize('start,end', [('2026-03-08T08:00:00Z','2026-03-09T07:00:00Z'),('2026-11-01T07:00:00Z','2026-11-02T08:00:00Z')])
def test_dst_day_lengths_accepted(client, start, end):
    value = snapshot()
    value.update(day_start=start,day_end=end,checked_at=start,slots=[])
    response, _ = request_status(client,value)
    assert response.status_code == 200
