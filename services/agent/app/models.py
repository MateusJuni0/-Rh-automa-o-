"""Contratos pydantic do serviço Agent (assistente proativo). Espelham o que o apps/web envia/recebe."""

from __future__ import annotations

from pydantic import BaseModel


class SuggestRequest(BaseModel):
    process_id: str


class NextAction(BaseModel):
    kind: str  # follow_up|schedule|nudge|...
    detail: str


class SuggestResponse(BaseModel):
    actions: list[NextAction]


class SourcingRequest(BaseModel):
    job_id: str


class SourcingCandidate(BaseModel):
    name: str
    source: str  # linkedin|github|...
    url: str | None = None


class SourcingResponse(BaseModel):
    candidates: list[SourcingCandidate]
