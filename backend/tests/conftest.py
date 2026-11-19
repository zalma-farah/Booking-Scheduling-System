
import os
import pytest
import httpx

# Unit-test imports must not initialize clients with a developer's real .env.
os.environ['SUPABASE_URL'] = ''
os.environ['SUPABASE_PUBLISHABLE_KEY'] = ''

def pytest_addoption(parser):
    parser.addoption('--run-live', action='store_true', default=False)

def pytest_collection_modifyitems(config, items):
    if not config.getoption('--run-live'):
        for item in items:
            if item.get_closest_marker('live'):
                item.add_marker(pytest.mark.skip(reason='Live writes require --run-live and disposable development fixtures.'))

@pytest.fixture(autouse=True)
def no_accidental_network(request, monkeypatch):
    if request.node.get_closest_marker('live') and request.config.getoption('--run-live'):
        return
    def blocked(*args, **kwargs):
        raise AssertionError('Unit tests must mock external HTTP requests')
    monkeypatch.setattr(httpx.Client, 'send', blocked)
