"""Smoke do esqueleto: /health vivo; enroll/verify em 501 até à lógica de biometria."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_enroll_not_implemented() -> None:
    res = client.post("/enroll", json={"user_id": "u1", "frames_b64": []})
    assert res.status_code == 501


def test_verify_not_implemented() -> None:
    res = client.post("/verify", json={"user_id": "u1", "frames_b64": []})
    assert res.status_code == 501
