"""Smoke do esqueleto: /health vivo. (enroll/verify reais cobertos em test_api.py)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
