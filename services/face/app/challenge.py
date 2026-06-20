"""Challenge de flash liveness — emissão + validação sem estado de sessão (HMAC assinado).

O servidor gera uma sequência de cores aleatória, assina-a (HMAC + expiração) e devolve. O cliente
pisca as cores, captura frames e reenvia o token + a sequência; o servidor valida o token (assinatura
+ não-expirado) ANTES de validar a liveness. Assim: o cliente não escolhe o challenge (anti-spoof),
não há estado partilhado, e o token não pode ser reutilizado depois de expirar (anti-replay).

O segredo vem do env (`FACE_S2S_SECRET`) — NUNCA hardcoded. Em dev, sem env, usa-se um default de dev
(documentado): inseguro para produção, suficiente para correr localmente.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time

from app.liveness import FLASH_PALETTE, MIN_CHALLENGE_LEN

# Comprimento do challenge emitido (≥ MIN_CHALLENGE_LEN).
CHALLENGE_LEN = 4
# Validade do challenge (segundos) — curta: o flash demora poucos segundos.
CHALLENGE_TTL_SECONDS = 60

_DEV_SECRET = "vera-face-dev-secret-change-me"  # noqa: S105 - default de dev, não é segredo real


def _secret() -> bytes:
    return (os.environ.get("FACE_S2S_SECRET") or _DEV_SECRET).encode("utf-8")


def _sign(payload: str) -> str:
    return hmac.new(_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def new_challenge(
    *, length: int = CHALLENGE_LEN, now: float | None = None
) -> tuple[list[tuple[int, int, int]], str]:
    """Gera uma sequência de flash aleatória + um token assinado (sequência+expiração)."""
    n = max(length, MIN_CHALLENGE_LEN)
    seq = [tuple(secrets.choice(FLASH_PALETTE)) for _ in range(n)]
    exp = (now if now is not None else time.time()) + CHALLENGE_TTL_SECONDS
    body = json.dumps({"seq": seq, "exp": exp}, separators=(",", ":"))
    token = f"{body}.{_sign(body)}"
    return seq, token


def verify_token(token: str, *, now: float | None = None) -> list[tuple[int, int, int]] | None:
    """Valida o token (assinatura tempo-constante + expiração). Devolve a sequência ou `None`."""
    if "." not in token:
        return None
    body, _, sig = token.rpartition(".")
    expected = _sign(body)
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None
    exp = data.get("exp")
    seq = data.get("seq")
    if not isinstance(exp, (int, float)) or not isinstance(seq, list):
        return None
    if (now if now is not None else time.time()) > exp:
        return None
    return [tuple(c) for c in seq]
