"""Fluxo de API ponta-a-ponta: /challenge → /enroll → /verify (FastAPI TestClient, sem câmara)."""

from __future__ import annotations

import base64

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _b64(tag: str, i: int) -> str:
    return base64.b64encode(f"{tag}-{i}".encode()).decode()


def _frames(sequence: list[list[int]], tag: str, *, colors: list[list[int]] | None = None) -> list:
    """Frames cuja cor medida = a sequência do challenge (rosto vivo), salvo `colors` (spoof)."""
    used = colors if colors is not None else sequence
    return [{"image_b64": _b64(tag, i), "measured_color": used[i]} for i in range(len(sequence))]


def _challenge() -> tuple[list[list[int]], str]:
    res = client.post("/challenge")
    assert res.status_code == 200
    body = res.json()
    return body["sequence"], body["token"]


def test_enroll_then_verify_same_face_matches() -> None:
    seq, token = _challenge()
    enroll = client.post(
        "/enroll",
        json={"user_id": "filipa", "challenge_token": token, "frames": _frames(seq, "filipa")},
    )
    assert enroll.status_code == 200
    assert enroll.json() == {"enrolled": True, "liveness_ok": True, "reason": None}

    seq2, token2 = _challenge()
    res = client.post(
        "/verify",
        json={"user_id": "filipa", "challenge_token": token2, "frames": _frames(seq2, "filipa")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["liveness_ok"] is True
    assert body["match"] is True


def test_enroll_rejected_when_liveness_fails() -> None:
    seq, token = _challenge()
    spoof_colors = [[0, 0, 0] for _ in seq]  # foto estática: não segue o flash
    res = client.post(
        "/enroll",
        json={
            "user_id": "spoofy",
            "challenge_token": token,
            "frames": _frames(seq, "spoofy", colors=spoof_colors),
        },
    )
    assert res.status_code == 200
    assert res.json()["enrolled"] is False
    assert res.json()["liveness_ok"] is False


def test_verify_different_face_no_match() -> None:
    seq, token = _challenge()
    client.post(
        "/enroll",
        json={"user_id": "ines", "challenge_token": token, "frames": _frames(seq, "ines-face")},
    )
    seq2, token2 = _challenge()
    res = client.post(
        "/verify",
        json={
            "user_id": "ines",
            "challenge_token": token2,
            "frames": _frames(seq2, "outra-face"),
        },
    )
    assert res.status_code == 200
    assert res.json()["liveness_ok"] is True
    assert res.json()["match"] is False


def test_invalid_challenge_token_400() -> None:
    res = client.post(
        "/verify",
        json={"user_id": "x", "challenge_token": "lixo", "frames": []},
    )
    assert res.status_code == 400


def test_invalid_base64_frame_400() -> None:
    seq, token = _challenge()
    bad = [{"image_b64": "!!!nao-base64!!!", "measured_color": c} for c in seq]
    res = client.post(
        "/enroll",
        json={"user_id": "x", "challenge_token": token, "frames": bad},
    )
    assert res.status_code == 400
