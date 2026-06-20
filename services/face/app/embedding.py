"""Deteção + embedding facial.

v1 (sem modelo pesado): descritor determinístico a partir dos bytes do frame, normalizado L2 —
permite enroll/verify por distância de cosseno e é 100% reproduzível/testável SEM GPU nem wheels
nativos. A interface (`FaceEmbedder`) está pronta para trocar pelo modelo real (insightface/dlib/
facenet) quando instalável no ambiente — só muda a implementação, não os chamadores.

NOTA de ambiente (Ω-4): libs de embedding facial SOTA (dlib/face_recognition/insightface/mediapipe)
exigem wheels nativos/CMake e muitas vezes NÃO instalam em Python 3.14/Windows. Por isso o motor real
fica atrás desta interface; o adapter pesado entra quando o ambiente o permitir (Linux/CI com modelo).
"""

from __future__ import annotations

import hashlib
from typing import Protocol

import numpy as np

# Dimensão do descritor (fixa — enroll e verify têm de bater).
EMBEDDING_DIM = 128


class FaceEmbedder(Protocol):
    def embed(self, frame_bytes: bytes) -> np.ndarray:  # pragma: no cover - protocolo
        ...


def _expand_to_dim(seed: bytes, dim: int) -> np.ndarray:
    """Expande um seed em `dim` floats determinísticos (hash em cadeia → bytes → float)."""
    out = np.empty(dim, dtype=np.float64)
    block = seed
    i = 0
    while i < dim:
        block = hashlib.sha256(block).digest()  # 32 bytes
        for b in block:
            if i >= dim:
                break
            out[i] = (b / 255.0) * 2.0 - 1.0  # ∈ [-1, 1]
            i += 1
    return out


def l2_normalize(v: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(v))
    if norm == 0.0:
        return v
    return v / norm


class DeterministicEmbedder:
    """Embedder determinístico v1 (sem modelo). Mesmo frame → mesmo vetor; frames diferentes →
    vetores diferentes. NÃO é reconhecimento facial real — é o stand-in testável atrás da interface."""

    def __init__(self, dim: int = EMBEDDING_DIM) -> None:
        self.dim = dim

    def embed(self, frame_bytes: bytes) -> np.ndarray:
        if not frame_bytes:
            raise ValueError("frame vazio — nada para extrair")
        return l2_normalize(_expand_to_dim(frame_bytes, self.dim))


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Similaridade de cosseno entre dois vetores (assume-os ~normalizados; robusto a norma 0)."""
    an = l2_normalize(a)
    bn = l2_normalize(b)
    return float(np.dot(an, bn))


def average_embedding(vectors: list[np.ndarray]) -> np.ndarray:
    """Template = média L2-normalizada dos embeddings dos frames do enroll (mais robusto que 1 só)."""
    if not vectors:
        raise ValueError("sem vetores para o template")
    return l2_normalize(np.mean(np.stack(vectors), axis=0))
