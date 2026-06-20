"""Testes do challenge assinado (HMAC + expiração). Anti-spoof: o cliente não escolhe o challenge."""

from __future__ import annotations

from app.challenge import CHALLENGE_TTL_SECONDS, new_challenge, verify_token
from app.liveness import MIN_CHALLENGE_LEN


def test_new_challenge_assina_e_valida() -> None:
    seq, token = new_challenge(now=1000.0)
    assert len(seq) >= MIN_CHALLENGE_LEN
    recovered = verify_token(token, now=1000.0)
    assert recovered == seq


def test_token_expirado_invalido() -> None:
    _, token = new_challenge(now=1000.0)
    assert verify_token(token, now=1000.0 + CHALLENGE_TTL_SECONDS + 1) is None


def test_token_adulterado_invalido() -> None:
    _, token = new_challenge(now=1000.0)
    # Troca um carácter do corpo → assinatura deixa de bater.
    tampered = ("X" + token[1:]) if token[0] != "X" else ("Y" + token[1:])
    assert verify_token(tampered, now=1000.0) is None


def test_token_sem_assinatura_invalido() -> None:
    assert verify_token("sem-ponto-nenhum", now=1000.0) is None
