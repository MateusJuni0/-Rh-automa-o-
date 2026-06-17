# Arquitetura de Integração — contratos, módulos, env e wiring

> **Propósito:** tornar a spec *dispatch-ready*. Aqui ficam as 4 peças de cola que
> permitem **subagentes construir em paralelo sem colidir** e as peças **encaixarem**
> sem retrabalho: (1) estrutura de módulos, (2) contratos das junções, (3) inventário
> de env, (4) mapa de wiring + divisão em carris. **Regra de ouro:** ninguém inventa
> uma junção — constrói-se contra o contrato em `packages/core`.

---

## 1. Estrutura do repo / fronteiras de módulo (quem é dono de quê)

Monorepo (pnpm workspaces). Cada subagente é dono de **uma pasta** → zero colisão.

```
rh-copiloto/
├── apps/
│   ├── web/         # Next.js 15 (App Router): UI + route handlers (/api/*) — TODO o "resto"
│   ├── desktop/     # App de SECRETÁRIA (Electron; Tauri = alt. mais leve): overlay ao vivo + CAPTA áudio local
│   ├── ws/          # Servidor WebSocket (Node): empurra estado vivo → overlay desktop
│   ├── realtime/    # Worker: LiveKit (bot entra na call) + Soniox (STT multi-idioma + diarização)
│   └── bot/         # Ingestão: Telegram (grammy) + WhatsApp (Evolution API)
├── packages/
│   ├── db/          # Drizzle schema + migrations  ← ÚNICA fonte do MODELO-DADOS.md
│   ├── core/        # tipos + Zod schemas + CONTRATOS (importado por todos, incl. desktop)
│   ├── ai/          # wrappers Claude: rubric, briefing, parecer, tick + prompts
│   └── knowledge/   # Role Profile (Exa/Brave) + RAG pgvector (candidato/cliente)
├── docker-compose.yml   # web + ws + realtime + bot + (supabase já existe na VPS)
└── .env.enc             # sops+age (padrão CMTec) → decriptado no boot
```

### Dois clientes, um backend (decisão 2026-06-17)
- **`apps/desktop` = SÓ o "durante"** (overlay ao vivo + captura de áudio local). É um
  **app desktop**, não um separador de browser — uma página web não fica *always-on-top*
  por cima do Zoom/Meet. **Electron** (leve, multiplataforma); **Tauri** anotado como
  alternativa mais leve a avaliar na construção.
- **`apps/web` = TODO o resto** (cadastros cliente/vaga/candidato, Role Profile/rubric,
  relatórios, Q&A, agenda do assistente proativo).
- **Mesmo backend** (`/api/*` do Next.js + `packages/*`) serve os dois. O desktop é um
  cliente "fino": autentica-se na API, abre WebSocket para o estado vivo, e empurra o
  áudio captado para `realtime`. Não tem lógica de negócio própria — importa de `core`.
- **Single-tenant v1 (só IRIS):** sem multi-tenant/RLS por agência nesta versão (ver
  `MODELO-DADOS.md` §RLS). O `agency_id` permanece no schema como costura para o
  futuro, mas a v1 não o usa para isolar — acesso interno é total.

**Princípio:** toda a lógica partilhada (tipos, schemas, contratos) vive em
`packages/core` e `packages/db`. As `apps/*` e os outros `packages/*` **importam**
de lá — nunca redefinem.

---

## 2. Contratos das junções (os "seams" — construir contra isto)

Cada contrato fica em `packages/core` como tipo + Zod schema. Fonte de verdade.

### 2.1 Dados (de `packages/db`, Drizzle → tipos gerados)
Schema completo em [`MODELO-DADOS.md`](./MODELO-DADOS.md). Todos importam os tipos
gerados; ninguém escreve SQL fora de `packages/db`.

### 2.2 Shapes de IA (de `packages/core`)
- `RoleProfile` — definido em [`CAMADA-CONHECIMENTO.md`](./CAMADA-CONHECIMENTO.md) (JSON).
- `Rubric` — fraca/ok/forte por requisito ([`INTAKE-E-JULGAMENTO.md`](./INTAKE-E-JULGAMENTO.md) Parte B).
- `EstadoVivo` (tick) — JSON em [`ARQUITETURA-TEMPO-REAL.md §2`](./ARQUITETURA-TEMPO-REAL.md) (requisitos + interesses_cliente + sugestão).
- `Parecer`, `IntakeExtraction`, `MatchResult` — campos em [`ACESSO-E-CONHECIMENTO.md`](./ACESSO-E-CONHECIMENTO.md) / `MODELO-DADOS.md`.

### 2.3 API (route handlers em `apps/web`, request/response em `packages/core`)
| Rota | Faz | Chama |
|---|---|---|
| `POST /api/intake` | doc do cliente → extrai → **preview** (não grava) | `ai` (Haiku) |
| `POST /api/intake/confirm` | grava após confirmação da Filipa (proveniência) | `db`, `knowledge` (RAG cliente) |
| `POST /api/vagas` | cria vaga (+ extrai requisitos de texto colado) | `ai`, `db` |
| `POST /api/vagas/:id/role-profile` | trigger conhecimento externo | `knowledge` (Exa+Brave) → `db` |
| `POST /api/candidatos` | upload CV → extrai perfil | `ai`, `db` |
| `POST /api/candidatos/:id/match` | candidato vs vaga | `ai` (Sonnet) → `db` |
| `POST /api/briefing` | gera roteiro (3 lentes + boa_resposta) | `ai` (Opus) + RoleProfile + RAG cliente |
| `POST /api/interviews` | inicia entrevista → devolve sala/token LiveKit | `realtime`, `db` |
| `POST /api/interviews/:id/report` | gera parecer + destila memória | `ai` (Opus), `knowledge` (RAG candidato) |
| `POST /api/candidatos/:id/verdict` | veredito do cliente (calibração) | `db`, `knowledge` |
| `GET  /api/candidatos/:id/chat` | Q&A RAG sobre a pasta | `knowledge`, `ai` |

### 2.4 WebSocket (entre `apps/ws` e a UI do painel)
Mensagens (tipos em `packages/core`):
```jsonc
{ "type": "tick.update",      "interviewId": "...", "estado": { /* EstadoVivo */ } }
{ "type": "suggestion.next",  "interviewId": "...", "pergunta": "...", "lente": "tecnica|cliente|gap" }
{ "type": "coverage.update",  "interviewId": "...", "requisitos": [ /* status */ ] }
{ "type": "alert",            "interviewId": "...", "texto": "5 anos dito, CV diz 3" }
```

### 2.5 Realtime → ws (interno)
`apps/realtime` emite `transcript.partial`/`transcript.final` (falante+timestamp) →
agrega num tick → `packages/ai` (Sonnet) devolve `EstadoVivo` → publica em `apps/ws`.

---

## 3. Inventário de env / secrets (um só lugar — sops+age)

```bash
# Supabase (self-hosted VPS — já existe)
SUPABASE_URL=            SUPABASE_ANON_KEY=       SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=            # para Drizzle
# Claude
ANTHROPIC_API_KEY=
# Conhecimento externo
EXA_API_KEY=             BRAVE_API_KEY=
# Tempo real
LIVEKIT_URL=             LIVEKIT_API_KEY=         LIVEKIT_API_SECRET=
SONIOX_API_KEY=
# Ingestão
TELEGRAM_BOT_TOKEN=      EVOLUTION_API_URL=       EVOLUTION_API_KEY=
# App
WS_URL=                  NEXT_PUBLIC_WS_URL=      REDIS_URL=   # sessões de intake
```
Guardar como `.env.enc` (sops+age, padrão CMTec) → decriptado no boot via systemd/compose.

---

## 4. Mapa de wiring (quem-chama-quem)

```
INGESTÃO        bot ──► /api/intake ──► ai(Haiku) ──► preview ──► /api/intake/confirm ──► db + knowledge(RAG cliente)
ANTES (vaga)    web ──► /api/vagas ──► ai(extrai) ──► db
                            └► /api/vagas/:id/role-profile ──► knowledge(Exa+Brave) ──► db.role_profile
ANTES (cand.)   web ──► /api/candidatos ──► ai(CV) ──► db
                            └► /api/.../match ──► ai(Sonnet) ──► db
ANTES (roteiro) web ──► /api/briefing ──► ai(Opus, usa role_profile+rubric+RAG cliente) ──► db
DURANTE         desktop(capta áudio local) ─► realtime(LiveKit sala + Soniox STT/diariz.) ─► tick ─► ai(Sonnet) ─► EstadoVivo ─► ws ─► desktop(overlay)
                desktop(chat ao vivo "ele falou de salário?") ─► ws/api ─► ai(responde do estado+transcrição corrente, sem parar a captura)
DEPOIS          /api/interviews/:id/report ──► ai(Opus parecer) ──► db ; destila ──► knowledge(RAG candidato, pgvector)
CALIBRAÇÃO      /api/candidatos/:id/verdict ──► db.client_verdict ──► knowledge(afia RAG cliente)
```

---

## 5. Divisão em carris de subagente (ordem + sem colisão)

**Agente 1 — Fundação (vai PRIMEIRO, todos dependem dele):**
`packages/db` (schema+migrations) + `packages/core` (tipos+contratos+Zod) + scaffold +
`docker-compose` + Auth + RLS multi-tenant. **Garantia:** os outros 5 importam tipos
de `core`/`db` e arrancam.

**Depois, em paralelo (cada um na sua pasta, contra os contratos de `core`):**
| Agente | Dono de | Entrega |
|---|---|---|
| 2 — Conhecimento | `packages/knowledge` | Role Profile (Exa+Brave) + RAG pgvector |
| 3 — IA | `packages/ai` | prompts + rubric/briefing/parecer/tick |
| 4 — Web "antes" | `apps/web` | rotas + UI: vaga, candidato, match, briefing, parecer, acesso |
| 5 — Tempo real | `apps/realtime` + `apps/ws` + `apps/desktop` | LiveKit+Soniox (multi-idioma) + WebSocket + **app desktop overlay/captura** |
| 6 — Ingestão | `apps/bot` | Telegram + WhatsApp (mesmo motor de intake) |

Cada carril valida-se com o seu bloco em [`TESTES-ACEITACAO.md`](./TESTES-ACEITACAO.md)
e os passos de [`PLANO-CONSTRUCAO.md`](./PLANO-CONSTRUCAO.md).

---

## 6. Regra de ouro para os subagentes
> Constrói contra o contrato em `packages/core`. **Nunca inventes uma junção.** Se um
> contrato precisa mudar, muda-se em `core` primeiro (um sítio) e os dois lados seguem.
> É isto que torna a construção paralela determinística — e sem achismo nas costuras.
