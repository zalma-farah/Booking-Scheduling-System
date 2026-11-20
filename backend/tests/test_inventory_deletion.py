"""API contracts; all Supabase responses are mocked."""
from unittest.mock import patch
import httpx
import pytest
from tests.test_management_integration import client, identity, reply, HEADERS, ORG


@pytest.mark.parametrize('kind', ['locations', 'resources'])
def test_delete_requires_admin(client, kind):
    with patch('app.httpx.get', side_effect=identity('user')), patch('app.httpx.post') as post:
        response = client.delete(f'/api/admin/{kind}/7', headers=HEADERS, json={'confirmation': 'DELETE'})
        assert response.status_code == 403
        post.assert_not_called()


def test_delete_requires_token(client):
    assert client.delete('/api/admin/locations/7', json={'confirmation': 'DELETE'}).status_code == 401


@pytest.mark.parametrize('body', [None, {}, {'confirmation': 'delete'}, {'confirmation': 'DELETE', 'organization_id': 7}])
def test_explicit_confirmation_required(client, body):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', return_value=reply([ORG])) as post:
        response = client.delete('/api/admin/locations/7', headers=HEADERS, json=body)
        assert response.status_code == 400
        assert post.call_count == 1  # trusted organization lookup only


@pytest.mark.parametrize('kind', ['locations', 'resources'])
def test_delete_passes_user_context_to_atomic_rpc(client, kind):
    deleted = {'id': 7, 'type': kind, 'deleted': True}
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', side_effect=[reply([ORG]), reply(deleted)]) as post:
        response = client.delete(f'/api/admin/{kind}/7', headers=HEADERS, json={'confirmation': 'DELETE'})
        assert response.status_code == 200
        assert response.json['deleted'] == deleted
        assert response.headers['Cache-Control'] == 'no-store'
        assert post.call_args.args[0].endswith('/rpc/delete_archived_inventory')
        assert post.call_args.kwargs['json'] == {'record_kind': kind, 'record_id': 7}
        assert post.call_args.kwargs['headers']['Authorization'] == HEADERS['Authorization']


@pytest.mark.parametrize('code,status,expected', [('PGRST202',404,503),('42501',403,404),('23514',400,409),('23503',409,409),('22023',400,400),('XX000',500,502)])
def test_delete_failure_mapping(client, code, status, expected):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', side_effect=[reply([ORG]), reply({'code': code}, status)]):
        assert client.delete('/api/admin/locations/7', headers=HEADERS, json={'confirmation': 'DELETE'}).status_code == expected


@pytest.mark.parametrize('data', [[], {}, {'id': True,'type': 'resources','deleted': True}, {'id': 7.0,'type': 'resources','deleted': True}, {'id': 7,'type': 'locations','deleted': True}, {'id':7,'type':'resources','deleted':False}])
def test_ambiguous_delete_never_reports_success(client, data):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', side_effect=[reply([ORG]), reply(data)]):
        assert client.delete('/api/admin/resources/7', headers=HEADERS, json={'confirmation':'DELETE'}).status_code == 502


def test_delete_timeout_requires_refresh(client):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', side_effect=[reply([ORG]), httpx.ReadTimeout('synthetic timeout')]) as post:
        response = client.delete('/api/admin/resources/7', headers=HEADERS, json={'confirmation':'DELETE'})
        assert response.status_code == 503
        assert 'Refresh' in response.json['message']
        assert post.call_count == 2  # No automatic retry of the delete operation.


@pytest.mark.parametrize('kind', ['locations','resources'])
@pytest.mark.parametrize('state,value', [('active','eq.true'),('archived','eq.false'),('all',None)])
def test_visibility_filter_applied_before_limit(client, kind, state, value):
    with patch('app.httpx.get', side_effect=identity()+[reply([])]) as get, patch('app.httpx.post',return_value=reply([ORG])):
        assert client.get(f'/api/admin/{kind}?state={state}',headers=HEADERS).status_code == 200
        assert get.call_args.kwargs['params'].get('is_active') == value
        assert get.call_args.kwargs['params']['limit'] == '100'


@pytest.mark.parametrize('kind', ['locations', 'resources'])
@pytest.mark.parametrize('query', ['state=unknown','state=','state=active&state=archived'])
def test_bad_visibility_rejected(client, kind, query):
    with patch('app.httpx.get', side_effect=identity()) as get, patch('app.httpx.post', return_value=reply([ORG])):
        assert client.get(f'/api/admin/{kind}?'+query, headers=HEADERS).status_code == 400
        assert get.call_count == 2  # auth and profile only; no inventory fetch


@pytest.mark.parametrize('record_id', [0, 9223372036854775808])
@pytest.mark.parametrize('kind', ['locations', 'resources'])
def test_invalid_delete_id_never_reaches_mutation(client, kind, record_id):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', return_value=reply([ORG])) as post:
        response = client.delete(f'/api/admin/{kind}/{record_id}', headers=HEADERS, json={'confirmation':'DELETE'})
        assert response.status_code == 400
        assert post.call_count == 1


def test_inactive_admin_cannot_delete(client):
    with patch('app.httpx.get', side_effect=identity(active=False)), patch('app.httpx.post') as post:
        assert client.delete('/api/admin/locations/7', headers=HEADERS, json={'confirmation':'DELETE'}).status_code == 403
        post.assert_not_called()


def test_unassigned_admin_cannot_delete(client):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', return_value=reply([])) as post:
        assert client.delete('/api/admin/locations/7', headers=HEADERS, json={'confirmation':'DELETE'}).status_code == 403
        assert post.call_count == 1


@pytest.mark.parametrize('status', [401,403])
def test_rpc_session_or_permission_failure(client, status):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', side_effect=[reply([ORG]),reply({},status)]):
        assert client.delete('/api/admin/resources/7', headers=HEADERS, json={'confirmation':'DELETE'}).status_code == status


def test_boolean_id_cannot_confirm_record_one(client):
    # Python considers True == 1; the response contract must still reject it.
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', side_effect=[reply([ORG]),reply({'id':True,'type':'resources','deleted':True})]):
        assert client.delete('/api/admin/resources/1', headers=HEADERS, json={'confirmation':'DELETE'}).status_code == 502
