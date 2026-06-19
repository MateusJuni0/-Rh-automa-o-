"""Endpoints-contrato do Agent. Stub 501 até às chaves (KEYS-TODO): nada de chamadas externas."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.models import (
    SourcingRequest,
    SourcingResponse,
    SuggestRequest,
    SuggestResponse,
)

router = APIRouter()


@router.post("/proactive/suggest", response_model=SuggestResponse)
def proactive_suggest(req: SuggestRequest) -> SuggestResponse:
    # TODO(KEYS): Google Calendar (GOOGLE_OAUTH_*) — próximas ações/follow-ups por processo.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="proactive/suggest requer GOOGLE_OAUTH (KEYS-TODO)",
    )


@router.post("/sourcing/search", response_model=SourcingResponse)
def sourcing_search(req: SourcingRequest) -> SourcingResponse:
    # TODO(KEYS): Apify (APIFY_TOKEN) — sourcing de candidatos para uma vaga.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="sourcing/search requer APIFY_TOKEN (KEYS-TODO)",
    )
