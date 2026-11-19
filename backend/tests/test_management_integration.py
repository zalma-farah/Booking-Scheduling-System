from unittest.mock import patch
import httpx
import pytest
import app as module

def reply(value, status=200):
    return httpx.Response(status, json=value, request=httpx.Request('GET', 'https://review.invalid'))

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(module, 'SUPABASE_URL', 'https://review.invalid')
    monkeypatch.setattr(module, 'SUPABASE_PUBLISHABLE_KEY', 'synthetic-key')
    module.app.config['TESTING'] = True
    return module.app.test_client()

def identity(role='administrator', active=True):
    return [reply({'id':'test-user'}), reply([{'id':'test-user','role':role,'is_active':active}])]

HEADERS = {'Authorization':'Bearer synthetic-token'}
ORG = {'id':7,'code':'SDSU','name':'San Diego State University'}

def test_unassigned_admin_denied(client):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', return_value=reply([])):
        assert client.get('/api/admin/locations', headers=HEADERS).status_code == 403

def test_missing_organization_migration_fails_closed(client):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post', return_value=reply({'code':'PGRST202'},404)):
        assert client.get('/api/admin/locations', headers=HEADERS).status_code == 503

@pytest.mark.parametrize('path', ['/api/admin/locations','/api/admin/resources','/api/admin/time-slots','/api/admin/bookings','/api/admin/organization'])
def test_regular_user_cannot_manage(client,path):
    with patch('app.httpx.get', side_effect=identity('user')), patch('app.httpx.post') as rpc:
        assert client.get(path, headers=HEADERS).status_code == 403
        rpc.assert_not_called()

@pytest.mark.parametrize('path,scope', [('/api/admin/locations','organization_id'),('/api/admin/resources','location.organization_id'),('/api/admin/time-slots','resource.location.organization_id'),('/api/admin/bookings','slot.resource.location.organization_id')])
def test_admin_list_explicitly_filters_university(client,path,scope):
    with patch('app.httpx.get', side_effect=identity()+[reply([])]) as get, patch('app.httpx.post',return_value=reply([ORG])):
        assert client.get(path,headers=HEADERS).status_code == 200
        assert get.call_args.kwargs['params'][scope]=='eq.7'

def test_location_create_uses_trusted_assignment(client):
    location={'id':1,'name':'Building','address':None,'is_active':True}
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post',side_effect=[reply([ORG]),reply([location],201)]) as post:
        assert client.post('/api/admin/locations',headers=HEADERS,json={'name':'Building'}).status_code == 201
        assert post.call_args.kwargs['json']['organization_id']==7

@pytest.mark.parametrize('kind', ['locations','resources'])
def test_archive_foreign_record_cannot_report_success(client,kind):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post',return_value=reply([ORG])), patch('app.httpx.patch',return_value=reply([])):
        assert client.post(f'/api/admin/{kind}/99/archive',headers=HEADERS).status_code==404

@pytest.mark.parametrize('status,expected', [(409,409),(403,403),(200,200)])
def test_archive_result_mapping(client,status,expected):
    data=[{'id':1,'name':'Building','is_active':False}] if status==200 else {'code':'23514'}
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post',return_value=reply([ORG])), patch('app.httpx.patch',return_value=reply(data,status)):
        assert client.post('/api/admin/locations/1/archive',headers=HEADERS).status_code==expected

@pytest.mark.parametrize('method,path,payload', [('patch','/api/admin/time-slots/1',{'is_active':False}),('post','/api/admin/bookings/1/cancel',None)])
def test_missing_operation_rpc_is_setup_error(client,method,path,payload):
    with patch('app.httpx.get', side_effect=identity()), patch('app.httpx.post',side_effect=[reply([ORG]),reply({'code':'PGRST202'},404)]):
        args={'json':payload} if payload else {}
        assert getattr(client,method)(path,headers=HEADERS,**args).status_code == 503
