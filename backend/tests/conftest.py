import pytest
from app.config import settings

@pytest.fixture(autouse=True)
def configure_test_settings(tmp_path, monkeypatch):
    # Force settings.workspace_base to point to the temporary path for this test
    monkeypatch.setattr(settings, "workspace_base", str(tmp_path))
    # Make sure default workspace exists
    (tmp_path / "default").mkdir(parents=True, exist_ok=True)
    return tmp_path
