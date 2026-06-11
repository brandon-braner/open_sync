import pytest


@pytest.fixture()
def env(tmp_path, monkeypatch):
    """Isolated DB + home directory for every test."""
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setenv("OPENSYNC_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("OPENSYNC_HOME", str(home))

    from opensync.db import init_db

    init_db()
    return tmp_path


@pytest.fixture()
def home(env):
    return env / "home"


@pytest.fixture()
def project(env):
    """A registered project with its directory."""
    from opensync import store

    project_dir = env / "proj"
    project_dir.mkdir()
    return store.add_project("demo", str(project_dir))
