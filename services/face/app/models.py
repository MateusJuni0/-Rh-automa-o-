"""Contratos pydantic do serviço Face (biometria). Auth da Vera = email/senha OU biometria (§auth)."""

from __future__ import annotations

from pydantic import BaseModel


class EnrollRequest(BaseModel):
    user_id: str
    # frames da sequência de flash liveness (base64). Real: valida cor/ordem dos flashes.
    frames_b64: list[str]


class EnrollResponse(BaseModel):
    enrolled: bool
    template_id: str | None = None


class VerifyRequest(BaseModel):
    user_id: str
    frames_b64: list[str]


class VerifyResponse(BaseModel):
    match: bool
    score: float
    liveness_ok: bool
