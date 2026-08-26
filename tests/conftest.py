import os

import pytest
import httpx

# Docker compose publishes cad-server on host port 6000 (container 5000).
# Override with CAD_SERVER_URL env when running against a bare-metal server on 5000.
CAD_SERVER_URL = os.environ.get("CAD_SERVER_URL", "http://localhost:6000")
AI_SERVER_URL = os.environ.get("AI_SERVER_URL", "http://localhost:4000")


@pytest.fixture(scope="session")
def cad_server():
    """Check CAD server is running. Skip all tests if not."""
    try:
        r = httpx.get(f"{CAD_SERVER_URL}/health", timeout=5)
        assert r.status_code == 200
    except Exception:
        pytest.skip("CAD server not running — start with: cd backend && docker compose up -d")
    return CAD_SERVER_URL


@pytest.fixture(scope="session")
def ai_server():
    """Check AI server is running. Skip all tests if not."""
    try:
        r = httpx.get(f"{AI_SERVER_URL}/api/health", timeout=5)
        assert r.status_code == 200
    except Exception:
        pytest.skip("AI server not running — start with: cd backend && docker compose up -d")
    return AI_SERVER_URL
