"""Vera — Face (biometria). Esqueleto FastAPI: /health vivo, enroll/verify em stub (lógica depois)."""

from __future__ import annotations

from fastapi import FastAPI

from app.routes import router

app = FastAPI(title="Vera — Face (biometria)", version="0.0.0")
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "face"}
