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
│   ├── desktop/     # App de SECRETÁRIA (Electron; Tauri = alt.): overlay ao vivo + CAPTA áudio local
│   ├── ws/          # Servidor WebSocket (Node): empurra estado vivo → overlay desktop
│   ├── realtime/    # Worker: LiveKit (bot entra na call) + Soniox (STT multi-idioma + diarização)
│   └── bot/         # Ingestão: Telegram (grammy) + WhatsApp (Evolution API)
├── packages/
│   ├── db/          # Drizzle schema + migrations  ← ÚNICA fonte do MODELO-DADOS.md
│   ├── core/        # tipos + Zod schemas + CONTRATOS (importado por todos, incl. desktop)
│   ├── ai/          # wrappers de LLM por SLOT (EXTRACTOR/ARCHITECT/LIVE via OpenRouter) + prompts
│   └── knowledge/   # Role Profile (Exa/Brave) + RAG pgvector + ciclo de pesquisa (source_doc)
├── services/                          # serviços Python (não pnpm) — sidecars no compose
│   ├── agent/       # ⭐ ASSISTENTE PESSOAL: motor Hermes/Lince CLONADO (FastAPI+LangGraph+tools+auditoria) — ASSISTENTE-PESSOAL.md
│   └── face/        # ⭐ BIOMETRIA: clone do cmtec-face (FastAPI + ONNX YuNet/SFace/liveness) — AUTENTICACAO.md
├── docker-compose.yml   # web + ws + realtime + bot + agent + face + (supabase já na VPS)
└── .env.enc             # sops+age (padrão CMTec) → decriptado no boot
```

> **Adicionado 2026-06-17 (Fase 2):** `services/agent` (o assistente pessoal — motor
> Hermes clonado, **vendorizado**, não puxa do nosso repo) e `services/face` (biometria
> clonada). São **Python/FastAPI** → vivem em `services/` (não no pnpm), ligados por
> contrato HTTP/WS, deployados como containers no compose e no bundle de migração
> (`INFRA-E-MIGRACAO.md`).

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
| **`POST /api/assistant/chat`** | o assistente pessoal (geral + tools) | `services/agent` |
| **`POST /api/assistant/action/confirm`** | confirma ação `gravar`/`enviar_fora` pendente | `services/agent`, `db` |
| **`POST /api/assistant/onboarding`** | guarda respostas da lista → `recruiter_memory_fact` | `services/agent`, `db` |
| **`POST /api/compare`** | comparar candidatos (matriz vs critérios) | `ai`(ARCHITECT), `db` |
| **`POST /api/sourcing`** | sourcing Apify (lead-scraper + enricher) → cria process | `services/agent`(Apify), `db` |
| **`POST /api/auth/face/start`** \| **`/complete`** | login biométrico → sessão Supabase | `services/face`, Supabase Auth |
| **`GET/POST /api/settings/models`** | ler/gravar o modelo por slot (catálogo OpenRouter) | `db` |
| **`POST /api/calendar/sync`** | Google Calendar OAuth → `agenda_event` | `services/agent` |
| **`POST /api/interviews/join`** | "vou para uma reunião"/link → o assistente põe o bot na call | `services/agent`, `realtime` |

### 2.4 WebSocket (entre `apps/ws` e a UI do painel)
Mensagens de dados (tipos em `packages/core`):
```jsonc
{ "type": "tick.update",      "interviewId": "...", "estado": { /* EstadoVivo */ } }
{ "type": "suggestion.next",  "interviewId": "...", "pergunta": "...", "lente": "tecnica|cliente|gap" }
{ "type": "coverage.update",  "interviewId": "...", "requisitos": [ /* status */ ] }
{ "type": "alert",            "interviewId": "...", "texto": "5 anos dito, CV diz 3" }
{ "type": "interview.active", "interviewId": "...", "on": true }   // arranca/encerra o overlay
```
**Frames de CONTROLO (auth + jobs assíncronos) — detalhe em `AGENTE-TOOLS-E-WS.md` (2026-06-17):**
```jsonc
// 1ª mensagem do cliente: JWT (NUNCA em query-string) → ver AUTENTICACAO §4
{ "type": "auth",             "accessToken": "<jwt supabase>", "interviewId": "..." }   // nome canónico: accessToken (não 'token'/'access_token')
{ "type": "auth.ok" }   { "type": "auth.error", "code": "4401|4403" }   // recusa = close 44xx
{ "type": "auth.refresh_needed" }   // JWT a expirar → cliente reata com refresh silencioso
// progresso de ferramenta longa do agente (sourcing, etc.)
{ "type": "job.progress",     "jobId": "...", "estado": "a procurar… 3 perfis", "pct": 40 }
{ "type": "job.done",         "jobId": "...", "resultRef": "..." }
```
> Estes frames de controlo + close codes `44xx` foram introduzidos pelos docs de Fase 2
> e **devem entrar em `packages/core`** na construção (eram um gap do contrato — anotado).

### 2.5 Realtime → ws (interno)
`apps/realtime` emite `transcript.partial`/`transcript.final` (falante+timestamp) →
agrega num tick → `packages/ai` (Sonnet) devolve `EstadoVivo` → publica em `apps/ws`.

---

## 3. Inventário de env / secrets (um só lugar — sops+age)

```bash
# Supabase (self-hosted VPS — já existe)
SUPABASE_URL=            SUPABASE_ANON_KEY=       SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=            # para Drizzle
# LLM — via OpenRouter (agnóstico; modelo por slot escolhido na app) — MODELOS-E-API.md
OPENROUTER_API_KEY=      # MODEL_EXTRACTOR= MODEL_ARCHITECT= MODEL_LIVE= (defaults; trocáveis na UI)
EMBEDDER_API_KEY=        # embeddings (ex. OpenAI) — fora do OpenRouter
# Conhecimento externo + sourcing
EXA_API_KEY=             BRAVE_API_KEY=           APIFY_TOKEN=   # (5 tokens + broker já no Hermes)
# Tempo real
LIVEKIT_URL=             LIVEKIT_API_KEY=         LIVEKIT_API_SECRET=
SONIOX_API_KEY=          # STT_PROVIDER= (trocável)
# Biometria (services/face)
FACE_SERVICE_URL=        FACE_S2S_SECRET=         FACE_ED25519_*=
# Ingestão + comunicação
TELEGRAM_BOT_TOKEN=      EVOLUTION_API_URL=       EVOLUTION_API_KEY=     RESEND_API_KEY=  # envio de email
# Calendário (assistente proativo)
GOOGLE_OAUTH_CLIENT_ID=  GOOGLE_OAUTH_CLIENT_SECRET=
# App
WS_URL=                  NEXT_PUBLIC_WS_URL=      REDIS_URL=   # sessões de intake + estado do agente
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
`docker-compose` + **Auth (Supabase + biometria)**. **v1 SINGLE-TENANT** — sem RLS por
agência (o `agency_id` fica na costura para a v2; **não** se constrói RLS agora). Os
outros importam tipos de `core`/`db` e arrancam.

**Depois, em paralelo (cada um na sua pasta, contra os contratos de `core`):**
| Agente | Dono de | Entrega |
|---|---|---|
| 2 — Conhecimento | `packages/knowledge` | Role Profile (Exa+Brave) + RAG pgvector + ciclo de pesquisa |
| 3 — IA | `packages/ai` | slots LLM (OpenRouter) + rubric/briefing/parecer/tick/comparação |
| 4 — Web "antes" + assistente | `apps/web` | rotas + UI: vaga, candidato, briefing, parecer, **assistente, comparação, onboarding, definições, login biométrico** |
| 5 — Tempo real | `apps/realtime` + `apps/ws` + `apps/desktop` | LiveKit+Soniox + WebSocket + **app desktop overlay/captura** |
| 6 — Ingestão | `apps/bot` | Telegram + WhatsApp (mesmo motor de intake) |
| **7 — Assistente (agente)** | **`services/agent`** | motor Hermes clonado: grafo+tools (docs/email/agenda/sourcing/calendar)+auditoria+memória que aprende |
| **8 — Biometria** | **`services/face`** | clone do cmtec-face (enroll/verify → veredito → sessão Supabase) |

> ⚠️ **Pré-requisito do Agente 8:** resolver o **bug de enroll/flash liveness** na
> origem antes de clonar (`AUTENTICACAO §6 C1`, memória `project_cmtec_face_enroll_bug`).

Cada carril valida-se com o seu bloco em [`TESTES-ACEITACAO.md`](./TESTES-ACEITACAO.md)
e os passos de [`PLANO-CONSTRUCAO.md`](./PLANO-CONSTRUCAO.md).

---

## 6. Regra de ouro para os subagentes
> Constrói contra o contrato em `packages/core`. **Nunca inventes uma junção.** Se um
> contrato precisa mudar, muda-se em `core` primeiro (um sítio) e os dois lados seguem.
> É isto que torna a construção paralela determinística — e sem achismo nas costuras.
