"""Motor de biometria: enroll/verify com flash liveness + embedding facial.

Fluxo (anti-spoof primeiro):
- ENROLL: valida a sequência de flash (liveness). SÓ se viva → extrai o template (média dos
  embeddings dos frames) e guarda-o. Sem liveness → NÃO cadastra (ataca o bug do cmtec-face).
- VERIFY: valida a sequência de flash. Se viva → compara o embedding com o template guardado
  (cosseno ≥ threshold). Sem liveness OU sem template → não há match.

Puro/injetável: o `FaceEmbedder` e o `TemplateStore` entram por parâmetro (testável sem câmara/DB).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np

from app.embedding import FaceEmbedder, average_embedding, cosine_similarity
from app.liveness import LivenessResult, verify_flash_sequence

# Limiar de cosseno para considerar o mesmo rosto (template v1; afina-se com o modelo real).
DEFAULT_MATCH_THRESHOLD = 0.92


@dataclass(frozen=True)
class Frame:
    """Um frame da sequência: bytes da imagem + cor dominante medida (extraída no cliente/servidor)."""

    image_bytes: bytes
    measured_color: tuple[int, int, int]


class TemplateStore(Protocol):
    def save(self, user_id: str, template: np.ndarray) -> None:  # pragma: no cover - protocolo
        ...

    def get(self, user_id: str) -> np.ndarray | None:  # pragma: no cover - protocolo
        ...


class InMemoryTemplateStore:
    """Store em memória (v1/testes). O real persiste em DB/Storage (vetor por user, isolado)."""

    def __init__(self) -> None:
        self._templates: dict[str, np.ndarray] = {}

    def save(self, user_id: str, template: np.ndarray) -> None:
        self._templates[user_id] = template

    def get(self, user_id: str) -> np.ndarray | None:
        return self._templates.get(user_id)


@dataclass(frozen=True)
class EnrollOutcome:
    enrolled: bool
    liveness: LivenessResult
    reason: str | None = None


@dataclass(frozen=True)
class VerifyOutcome:
    match: bool
    score: float
    liveness_ok: bool
    reason: str | None = None


def enroll(
    user_id: str,
    challenge: list[tuple[int, int, int]],
    frames: list[Frame],
    *,
    embedder: FaceEmbedder,
    store: TemplateStore,
) -> EnrollOutcome:
    """Cadastra o rosto SÓ depois de provar vivacidade (flash liveness)."""
    if not user_id:
        return EnrollOutcome(
            enrolled=False,
            liveness=LivenessResult(ok=False, matched=0, expected=len(challenge)),
            reason="user_id_required",
        )
    liveness = verify_flash_sequence(challenge, [f.measured_color for f in frames])
    if not liveness.ok:
        # Fail-closed: sem liveness NÃO se cadastra (o cerne do anti-spoof).
        return EnrollOutcome(enrolled=False, liveness=liveness, reason="liveness_failed")
    template = average_embedding([embedder.embed(f.image_bytes) for f in frames])
    store.save(user_id, template)
    return EnrollOutcome(enrolled=True, liveness=liveness)


def verify(
    user_id: str,
    challenge: list[tuple[int, int, int]],
    frames: list[Frame],
    *,
    embedder: FaceEmbedder,
    store: TemplateStore,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
) -> VerifyOutcome:
    """Verifica o rosto: liveness + comparação com o template guardado."""
    liveness = verify_flash_sequence(challenge, [f.measured_color for f in frames])
    if not liveness.ok:
        return VerifyOutcome(match=False, score=0.0, liveness_ok=False, reason="liveness_failed")
    template = store.get(user_id)
    if template is None:
        return VerifyOutcome(match=False, score=0.0, liveness_ok=True, reason="not_enrolled")
    probe = average_embedding([embedder.embed(f.image_bytes) for f in frames])
    score = cosine_similarity(probe, template)
    return VerifyOutcome(match=score >= threshold, score=score, liveness_ok=True)
