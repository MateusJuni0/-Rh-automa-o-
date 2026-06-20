"""Contratos pydantic do serviço Face (biometria). Auth da Vera = email/senha OU biometria (§auth)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FrameIn(BaseModel):
    """Um frame da sequência de flash: imagem (base64) + cor dominante medida nesse frame."""

    image_b64: str
    measured_color: tuple[int, int, int]


class ChallengeResponse(BaseModel):
    """Sequência de cores a piscar + token assinado (reenviado no enroll/verify)."""

    sequence: list[tuple[int, int, int]]
    token: str


class EnrollRequest(BaseModel):
    user_id: str = Field(min_length=1)
    challenge_token: str
    frames: list[FrameIn]


class EnrollResponse(BaseModel):
    enrolled: bool
    liveness_ok: bool
    reason: str | None = None


class VerifyRequest(BaseModel):
    user_id: str = Field(min_length=1)
    challenge_token: str
    frames: list[FrameIn]


class VerifyResponse(BaseModel):
    match: bool
    score: float
    liveness_ok: bool
    reason: str | None = None
