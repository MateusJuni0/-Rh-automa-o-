"""Testes da lógica de biometria: liveness (anti-spoof), embedding, enroll/verify. Sem câmara/GPU."""

from __future__ import annotations

import numpy as np

from app.embedding import (
    DeterministicEmbedder,
    average_embedding,
    cosine_similarity,
    l2_normalize,
)
from app.engine import (
    Frame,
    InMemoryTemplateStore,
    enroll,
    verify,
)
from app.liveness import MIN_CHALLENGE_LEN, verify_flash_sequence

CHALLENGE = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]


def frames_for(colors: list[tuple[int, int, int]], tag: bytes = b"face-a") -> list[Frame]:
    """Frames com a cor medida = cor do flash (rosto vivo) e bytes determinísticos por tag."""
    return [Frame(image_bytes=tag + bytes([i]), measured_color=c) for i, c in enumerate(colors)]


# ───────────────────────────── liveness ─────────────────────────────


def test_liveness_ok_quando_segue_a_sequencia() -> None:
    res = verify_flash_sequence(CHALLENGE, list(CHALLENGE))
    assert res.ok
    assert res.matched == res.expected == 3


def test_liveness_falha_com_cor_fora_de_ordem() -> None:
    measured = [(0, 255, 0), (255, 0, 0), (0, 0, 255)]  # trocou as 2 primeiras
    res = verify_flash_sequence(CHALLENGE, measured)
    assert not res.ok
    assert res.reason == "color_sequence_mismatch"


def test_liveness_falha_com_numero_de_frames_errado() -> None:
    res = verify_flash_sequence(CHALLENGE, list(CHALLENGE)[:2])
    assert not res.ok
    assert res.reason == "frame_count_mismatch"


def test_liveness_falha_challenge_curto_demais() -> None:
    short = CHALLENGE[: MIN_CHALLENGE_LEN - 1]
    res = verify_flash_sequence(short, short)
    assert not res.ok
    assert res.reason == "challenge_too_short"


def test_liveness_tolera_pequena_variacao_de_cor() -> None:
    measured = [(240, 15, 10), (10, 245, 12), (8, 9, 250)]  # reflexo da pele, perto das cores
    res = verify_flash_sequence(CHALLENGE, measured)
    assert res.ok


# ───────────────────────────── embedding ─────────────────────────────


def test_embedding_deterministico_e_normalizado() -> None:
    e = DeterministicEmbedder()
    v1 = e.embed(b"frame-x")
    v2 = e.embed(b"frame-x")
    assert np.allclose(v1, v2)
    assert abs(float(np.linalg.norm(v1)) - 1.0) < 1e-9


def test_embeddings_diferentes_para_frames_diferentes() -> None:
    e = DeterministicEmbedder()
    assert cosine_similarity(e.embed(b"frame-x"), e.embed(b"frame-y")) < 0.99


def test_average_embedding_normalizado() -> None:
    vs = [l2_normalize(np.array([1.0, 0.0, 0.0])), l2_normalize(np.array([0.0, 1.0, 0.0]))]
    avg = average_embedding(vs)
    assert abs(float(np.linalg.norm(avg)) - 1.0) < 1e-9


# ───────────────────────────── enroll / verify ─────────────────────────────


def test_enroll_vivo_cadastra_e_verify_o_mesmo_rosto_da_match() -> None:
    store = InMemoryTemplateStore()
    embedder = DeterministicEmbedder()
    out = enroll("u1", CHALLENGE, frames_for(CHALLENGE, b"face-a"), embedder=embedder, store=store)
    assert out.enrolled

    v = verify("u1", CHALLENGE, frames_for(CHALLENGE, b"face-a"), embedder=embedder, store=store)
    assert v.liveness_ok
    assert v.match
    assert v.score >= 0.92


def test_enroll_recusa_sem_liveness() -> None:
    store = InMemoryTemplateStore()
    embedder = DeterministicEmbedder()
    spoof = [(0, 0, 0), (0, 0, 0), (0, 0, 0)]  # foto estática: não segue o flash
    out = enroll("u1", CHALLENGE, frames_for(spoof, b"face-a"), embedder=embedder, store=store)
    assert not out.enrolled
    assert out.reason == "liveness_failed"
    assert store.get("u1") is None


def test_verify_rosto_diferente_nao_da_match() -> None:
    store = InMemoryTemplateStore()
    embedder = DeterministicEmbedder()
    enroll("u1", CHALLENGE, frames_for(CHALLENGE, b"face-a"), embedder=embedder, store=store)

    v = verify("u1", CHALLENGE, frames_for(CHALLENGE, b"face-b"), embedder=embedder, store=store)
    assert v.liveness_ok
    assert not v.match


def test_verify_sem_enroll_nao_da_match() -> None:
    store = InMemoryTemplateStore()
    embedder = DeterministicEmbedder()
    v = verify("novo", CHALLENGE, frames_for(CHALLENGE), embedder=embedder, store=store)
    assert not v.match
    assert v.reason == "not_enrolled"


def test_verify_spoof_falha_liveness_mesmo_com_template() -> None:
    store = InMemoryTemplateStore()
    embedder = DeterministicEmbedder()
    enroll("u1", CHALLENGE, frames_for(CHALLENGE, b"face-a"), embedder=embedder, store=store)

    spoof = [(0, 0, 0), (0, 0, 0), (0, 0, 0)]
    v = verify("u1", CHALLENGE, frames_for(spoof, b"face-a"), embedder=embedder, store=store)
    assert not v.liveness_ok
    assert not v.match
    assert v.reason == "liveness_failed"
