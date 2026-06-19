"""Endpoints-contrato do Face. Stub 501 — biometria + flash liveness são trabalho real (lógica depois).

TODO(liveness): a sequência de flash liveness (tela colorida) é o cerne do anti-spoofing. Cuidado com o
bug conhecido do cmtec-face (enroll cadastra rápido demais SEM mostrar a tela colorida) — replicar só
DEPOIS de o resolver no cmtec-face. Ver MEMORY: project_cmtec_face_enroll_bug.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.models import (
    EnrollRequest,
    EnrollResponse,
    VerifyRequest,
    VerifyResponse,
)

router = APIRouter()


@router.post("/enroll", response_model=EnrollResponse)
def enroll(req: EnrollRequest) -> EnrollResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="enroll requer o motor de biometria + flash liveness (lógica por implementar)",
    )


@router.post("/verify", response_model=VerifyResponse)
def verify(req: VerifyRequest) -> VerifyResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="verify requer o motor de biometria + flash liveness (lógica por implementar)",
    )
