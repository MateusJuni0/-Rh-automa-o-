"""Smoke do esqueleto: /health vivo; endpoints-contrato em 501 até às chaves."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_suggest_not_implemented() -> None:
    res = client.post("/proactive/suggest", json={"process_id": "p1"})
    assert res.status_code == 501


def test_sourcing_not_implemented() -> None:
    res = client.post("/sourcing/search", json={"job_id": "j1"})
    assert res.status_code == 501
