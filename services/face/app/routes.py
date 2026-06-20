"""Endpoints do Face: /challenge (emite flash), /enroll, /verify.

Anti-spoof primeiro: o challenge de flash é assinado pelo servidor (o cliente não o escolhe) e
validado ANTES da liveness; o enroll só cadastra com vivacidade provada — ataca o bug conhecido do
cmtec-face (enroll cadastra rápido demais SEM mostrar a tela colorida). Motor numpy injetável (o
modelo SOTA entra atrás da interface `FaceEmbedder` quando instalável no ambiente).
"""

from __future__ import annotations

import base64
import binascii

from fastapi import APIRouter, HTTPException, status

from app.challenge import new_challenge, verify_token
from app.embedding import DeterministicEmbedder
from app.engine import (
    Frame,
    InMemoryTemplateStore,
    enroll,
    verify,
)
from app.models import (
    ChallengeResponse,
    EnrollRequest,
    EnrollResponse,
    FrameIn,
    VerifyRequest,
    VerifyResponse,
)

router = APIRouter()

# Motor v1 (processo único). O store real persiste por user em DB/Storage; o embedder real é o modelo.
_EMBEDDER = DeterministicEmbedder()
_STORE = InMemoryTemplateStore()


def _decode_frames(frames: list[FrameIn]) -> list[Frame]:
    """Descodifica os frames base64 → bytes. Base64 inválido → 400 (sem falha silenciosa)."""
    out: list[Frame] = []
    for f in frames:
        try:
            image_bytes = base64.b64decode(f.image_b64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="frame base64 inválido",
            ) from exc
        out.append(Frame(image_bytes=image_bytes, measured_color=f.measured_color))
    return out


@router.post("/challenge", response_model=ChallengeResponse)
def challenge() -> ChallengeResponse:
    """Emite uma sequência de flash + token assinado. O cliente pisca as cores e captura os frames."""
    sequence, token = new_challenge()
    return ChallengeResponse(sequence=sequence, token=token)


@router.post("/enroll", response_model=EnrollResponse)
def enroll_route(req: EnrollRequest) -> EnrollResponse:
    seq = verify_token(req.challenge_token)
    if seq is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="challenge inválido ou expirado",
        )
    frames = _decode_frames(req.frames)
    outcome = enroll(req.user_id, seq, frames, embedder=_EMBEDDER, store=_STORE)
    return EnrollResponse(
        enrolled=outcome.enrolled,
        liveness_ok=outcome.liveness.ok,
        reason=outcome.reason,
    )


@router.post("/verify", response_model=VerifyResponse)
def verify_route(req: VerifyRequest) -> VerifyResponse:
    seq = verify_token(req.challenge_token)
    if seq is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="challenge inválido ou expirado",
        )
    frames = _decode_frames(req.frames)
    outcome = verify(req.user_id, seq, frames, embedder=_EMBEDDER, store=_STORE)
    return VerifyResponse(
        match=outcome.match,
        score=outcome.score,
        liveness_ok=outcome.liveness_ok,
        reason=outcome.reason,
    )
