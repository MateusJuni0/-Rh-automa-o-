"""Vera — Agent (assistente proativo). Esqueleto FastAPI: /health vivo, restante contrato em stub."""

from __future__ import annotations

from fastapi import FastAPI

from app.routes import router

app = FastAPI(title="Vera — Agent (assistente proativo)", version="0.0.0")
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "agent"}
