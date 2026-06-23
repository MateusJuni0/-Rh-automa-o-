# Design Tokens — Vera (HUD escuro)

> Fonte única de cor/tipografia/espaço para o frontend (overlay desktop + web app), para
> os mockups não divergirem na implementação. Direção LOCKED: **dark HUD "Apollo"**
> (`UI-DESIGN`). Valores derivados dos mockups aprovados. Implementar como CSS
> variables / tema Tailwind.

## Cor

### Superfícies (escuro — não preto puro)
| Token | Hex | Uso |
|---|---|---|
| `bg/base` | `#0E1116` | fundo principal (overlay, app) |
| `bg/raised` | `#11151B` | barra lateral, zonas elevadas |
| `bg/card` | `#161B22` | cartões, inputs, artefactos |
| `border/default` | `#262C36` | bordas de cartão/input |
| `border/subtle` | `#20252D` | divisórias internas |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `text/primary` | `#E6E8EB` | títulos, conteúdo |
| `text/secondary` | `#9AA0A8` | apoio, metadados |
| `text/tertiary` | `#6B7280` / `#5F6670` | hints, placeholders |

### Acento de marca (teal "Vera")
| Token | Hex | Uso |
|---|---|---|
| `accent` | `#5DCAA5` | marca, CTAs, foco, barra de acento |
| `accent/bg` | `#10312A` | fundo do círculo do bot, chips de acento |
| `accent/text` | `#9FE1CB` | texto de acento sobre escuro |
| `on-accent` | `#0E1116` | texto sobre botão teal cheio |

### Estado (semáforo — só para status, não decoração)
| Token | Hex |
|---|---|
| `state/strong` (coberto-com-prova) | `#5DCAA5` / forte `#1D9E75` |
| `state/shallow` (raso) | `#EF9F27` (texto `#F0C475`) |
| `state/alert` (contradito/atenção) | `#E24B4A` (texto `#F09595`) |
| `state/untouched` (não-tocado) | `#5F6670` |
| `state/info` (pesquisa ao vivo) | `#85B7EB` |

> Mapa para os 4 estados do frame: ✅ `strong` · 🟡 `shallow` · ⬜ `untouched` · ⚠ `alert`.

## Raio de canto
| Token | Valor | Uso |
|---|---|---|
| `radius/pill` | 22px | a pílula compacta do overlay |
| `radius/card` | 12px | cartões, painéis |
| `radius/md` | 8px | botões, chips, inputs |

## Tipografia
- **Família:** Inter (sans). Sentence case sempre; pesos 400 / 500 (nunca 600+).
- **Overlay** (denso, glanceable): pergunta 13–14px · apoio 11px · labels/uppercase-hint 10px.
- **Web app** (mais respiro): h 18–22px · corpo 14–16px · meta 12–13px. line-height ~1.5.
- Mono (`var(--font-mono)`) só para URLs/IDs (ex.: link de repo na pesquisa ao vivo).

## Espaço & layout
- Gaps internos: 8 / 12 / 16px. Ritmo vertical (web): 1rem / 1.5rem / 2rem.
- **Overlay compacto (pílula):** ~300×44px. **Overlay expandido:** ~360px largura.
- Flat: **sem gradientes, sombras, blur, glow** (regra da casa + legibilidade no escuro).

## Acessibilidade
- Contraste alto mas não branco puro (cansa em call longa). Fonte mínima 11px no overlay.
- Indicador 🔴 de gravação sempre visível durante a captura.
