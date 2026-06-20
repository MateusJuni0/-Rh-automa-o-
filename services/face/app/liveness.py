"""Flash liveness / anti-spoofing (cerne da biometria da Vera).

O servidor emite um *challenge*: uma sequência de cores de flash (a "tela colorida"). O ecrã do
cliente pisca essas cores e captura um frame por cor. Um rosto VIVO reflete a cor do flash na pele
(a cor dominante do frame aproxima-se da cor emitida); uma FOTO/écran estático não acompanha a
sequência. Validar isto é o que impede o spoof — e ataca o bug conhecido do cmtec-face (enroll que
cadastra rápido demais SEM exigir a sequência de flash). Aqui: SEM sequência válida → liveness falha.

Determinístico e puro (testável sem câmara). O extrator de cor dominante é injetável: o real extrai
da imagem (numpy); o contrato/teste passa a cor já medida.
"""

from __future__ import annotations

from dataclasses import dataclass

# Paleta de flash possível (cores saturadas, distinguíveis na reflexão da pele).
FLASH_PALETTE: tuple[tuple[int, int, int], ...] = (
    (255, 0, 0),  # vermelho
    (0, 255, 0),  # verde
    (0, 0, 255),  # azul
    (255, 255, 0),  # amarelo
    (255, 0, 255),  # magenta
)

# Distância euclidiana máxima (em RGB 0-255) entre a cor medida e a emitida para contar como "seguiu".
DEFAULT_COLOR_TOLERANCE = 110.0

# Comprimento mínimo do challenge (menos do que isto é trivial de forjar).
MIN_CHALLENGE_LEN = 3


@dataclass(frozen=True)
class LivenessResult:
    ok: bool
    matched: int
    expected: int
    reason: str | None = None


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    """Distância euclidiana entre duas cores RGB."""
    return float(sum((ai - bi) ** 2 for ai, bi in zip(a, b, strict=True)) ** 0.5)


def verify_flash_sequence(
    challenge: list[tuple[int, int, int]],
    measured: list[tuple[int, int, int]],
    *,
    tolerance: float = DEFAULT_COLOR_TOLERANCE,
) -> LivenessResult:
    """Valida que as cores medidas seguem o challenge de flash, na ordem.

    Regras (fail-closed):
    - challenge curto demais (< MIN_CHALLENGE_LEN) → falha (anti-replay trivial);
    - nº de frames medidos ≠ challenge → falha (não se "completa" o que falta);
    - CADA cor medida tem de ficar dentro da tolerância da cor emitida correspondente (ordem importa).
    """
    expected = len(challenge)
    if expected < MIN_CHALLENGE_LEN:
        return LivenessResult(ok=False, matched=0, expected=expected, reason="challenge_too_short")
    if len(measured) != expected:
        return LivenessResult(ok=False, matched=0, expected=expected, reason="frame_count_mismatch")
    matched = 0
    for emitted, seen in zip(challenge, measured, strict=True):
        if color_distance(emitted, seen) <= tolerance:
            matched += 1
    ok = matched == expected
    return LivenessResult(
        ok=ok,
        matched=matched,
        expected=expected,
        reason=None if ok else "color_sequence_mismatch",
    )
