# REUSE-MAP — o que a Vera clona, de onde, e como vendorizar

> **Para quê:** mapa **exato** do código a reutilizar/clonar na Vera (marca pública = Vera; motor interno = Lince). Um construtor deve conseguir abrir os clones nos paths indicados e copiar as peças certas **sem adivinhar**.
> **Regra de ouro:** clonar = **instância PRÓPRIA da Vera, sem cordão umbilical**. Nenhuma peça vendorizada pode chamar os serviços do painel/Hermes/voz em runtime. Trocam-se chaves, DSNs, schemas e endpoints; o código copia-se.
> **Estado (2026-06-18):** spec, **não codar**. Este doc é o anexo de "build-readiness" do [`INFRA-E-MIGRACAO.md`](./INFRA-E-MIGRACAO.md), [`AUTENTICACAO.md`](./AUTENTICACAO.md) e [`ARQUITETURA-TEMPO-REAL.md`](./ARQUITETURA-TEMPO-REAL.md).

## Sumário (4 peças + skills)

| # | Peça Vera | Origem (clone local) | Branch | Pasta no destino Vera | Dono sugerido |
|---|---|---|---|---|---|
| 1 | **Biometria** | `painel-cmtec` → `services/cmtec-face/` | `main` | `services/face` | Henrique (origem) + 1 dev backend |
| 2 | **Motor do agente** | `lince-brain-local` → `lince_brain/` | `fix/cpu-trend-false-alarms` | `services/agent` | 1 dev backend sénior (LangGraph) |
| 3 | **Tempo-real (LiveKit+Soniox)** | `cmtec-voice-platform` → `agents/` | `feat/livekit-agents-1.x` | `apps/realtime` | 1 dev áudio/realtime |
| 4 | **Skills (sourcing + ficheiros)** | `~/.claude/skills/` + plugin `anthropic-skills` | n/a | invocadas, não vendorizadas | 1 dev automation |

> **Todos os clones existem localmente em** `C:\Users\mjnol\.openclaw\workspace\projects\`. Caminhos abaixo são absolutos.

---

## 1. Biometria → `services/face`

### Origem
| Campo | Valor |
|---|---|
| Repo/path local | `C:\Users\mjnol\.openclaw\workspace\projects\painel-cmtec\services\cmtec-face\` |
| Branch | `main` |
| Último commit relevante | `72e3679` — *feat(face): anti-spoof modo SOMBRA — corre + loga score, não bloqueia (gated por env)* |
| Commits de contexto | `4249959` (align engine_singletons — MiniFASNet OFF) · `4684c08` (logout + route) |
| Migração schema | `painel-cmtec/infra/supabase/017_face_biometric.sql` |

> ⚠️ **Discrepância spec↔código a resolver:** `AUTENTICACAO.md` diz cmtec-face em `:18796`; o código/compose expõe `127.0.0.1:18795 → :8000` interno. Confirmar a porta real do túnel na origem antes de clonar (não bloqueia spec).

### Pasta exata a copiar
Copiar **todo** `services/cmtec-face/` → `services/face/`. Módulos (em `app/`):

| Ficheiro | Papel |
|---|---|
| `main.py` | App FastAPI; monta `routes_start` + `ws_routes`; porta 8000; `GET /health` |
| `routes_start.py` | HTTP S2S: `POST /verify/start` e `POST /enroll/start` (devolvem `sessionId`, `nonce`, `flashSeed`, `wsTicket`, `challengePlan`); auth HMAC |
| `ws_routes.py` | **WebSocket** `WS /verify/stream` e `WS /enroll/stream` — captura de frames JPEG ao vivo (Fase 1 desafios → Fase 2 match/enroll) |
| `verify_flow.py` | FSM stateful de uma sessão verify (deteção, consistência de identidade, amostragem anti-spoof) |
| `verify_decision.py` | `decide(...)` puro → `(verdict, reason)`. AND: liveness ∧ no-swap ∧ anti-spoof ∧ match |
| `liveness.py` | Desafios de **movimento** (virar cabeça, aproximar/afastar). Carrega `flash_seed` (tela colorida) — **flash ainda NÃO implementado** (ver C1) |
| `antispoof.py` | Ensemble MiniFASNetV2 + V1SE → `score_real(...)` |
| `engine_singletons.py` | `@lru_cache` dos engines; devolve `None` se ONNX falhar (resiliente). Gate `ANTISPOOF_ENFORCE` |
| `face_engine.py` | YuNet (deteção) + SFace (embedding **128-D**, cosine, threshold **0.363**); `MODEL_ID="sface_2021dec"`; thread-safe |
| `config.py` | **Todas** as env vars (tabela abaixo) |
| `db.py` | Pool asyncpg; `get/upsert_template`, `insert_verdict`, `delete_template`; schema `cmtec` |
| `models.py` | Garante download dos ONNX no build (`ensure_face_models` / `ensure_antispoof_models`) |
| `crypto.py` | AES-256-GCM dos templates (`nonce∥ct∥tag`) |
| `signing.py` | Ed25519 (assinatura de veredito) |
| `verdict.py` | Constrói payload do veredito (canónico) |
| `verdict_push.py` | **Push S2S do veredito ao painel** ← cordão umbilical (ver REMOVER) |
| `s2s.py` | HMAC-SHA256 (assina/verifica S2S) |
| `tickets.py` / `sessions.py` | Tickets WS single-use (TTL 30s) / sessões efémeras (TTL 60s) |
| `frames.py` | Decode JPEG com validação (≤2MB, ≤1920px) |

### Modelos ONNX (copiar `services/cmtec-face/models/`, ~42 MB)
| Ficheiro | Tamanho | Uso |
|---|---|---|
| `face_detection_yunet_2023mar.onnx` | ~233 KB | Deteção (YuNet, via OpenCV) |
| `face_recognition_sface_2021dec.onnx` | ~38.7 MB | Embedding 128-D (SFace, via OpenCV) |
| `MiniFASNetV2.onnx` | ~1.74 MB | Anti-spoof (ensemble) |
| `MiniFASNetV1SE.onnx` | ~1.74 MB | Anti-spoof (ensemble) |

> Baked no Docker image no build (`models.py`) — **sem internet em runtime**. Alternativamente, montar como volume.

### Schema DB (migração 017) — schema `cmtec`
- **`cmtec.face_templates`** (PK `email`): `template_enc BYTEA` (embedding cifrado AES-GCM), `key_version`, `template_version`, `model_id`, `sample_count`, `consent_at`, `consent_text_id` (RGPD), timestamps.
- **`cmtec.face_verdicts`** (PK `session_id`): `email`, `verdict CHECK(pass|fail)`, `nonce`, `issued_at`, `consumed_at`.
- **`cmtec.trusted_devices`** (PK `device_id`): device-binding (não usado na Fase 1).
- **RLS:** DENY ALL para `anon`/`authenticated`; só `service_role`.

> Para a Vera: aplicar 017 (ou equivalente) à DB da Vera. Decidir **schema próprio** (ex. `vera_face`) ou renomear `cmtec`→`vera`. A PK é `email` — se a Vera identificar utilizadores de outra forma, adaptar `db.py` + `routes_start.py`.

### Variáveis de ambiente (config.py)
| Var | Obrigatória | Default | Nota ao clonar |
|---|---|---|---|
| `FACE_AES_KEY_B64` | ✅ | — | **Gerar NOVA** (32 bytes b64) para a Vera |
| `FACE_ED25519_SK_B64` | ✅ | — | **Gerar NOVO** par; distribuir pública ao verificador da Vera |
| `FACE_S2S_SECRET` | ✅ | — | **Gerar NOVO** segredo (≠ painel) |
| `FACE_DB_DSN` | ✅ | — | Apontar à **DB da Vera** |
| `PAINEL_VERDICT_URL` | ✅ | — | Apontar ao **endpoint da Vera** (ou remover push — ver abaixo) |
| `ANTISPOOF_ENFORCE` | ⬜ | `false` (**modo SOMBRA**) | Manter SOMBRA até validar; **ligar antes de vender / >1 utilizador** (porta da spec) |

### Dependências (requirements.txt)
`fastapi≥0.110`, `uvicorn[standard]≥0.29`, `websockets≥12`, `numpy≥1.26`, `opencv-python-headless≥4.9`, `onnxruntime≥1.17`, `cryptography≥42`, `pynacl≥1.5`, `asyncpg≥0.29`, `httpx≥0.27`. Docker: `python:3.12-slim` + `libgl1`, `libglib2.0-0`. Container `read_only` + `no-new-privileges` + user não-privilegiado.

### REMOVER / cortar ao vendorizar (cordão umbilical)
1. **Segredos partilhados** (`FACE_S2S_SECRET`, par Ed25519, `FACE_AES_KEY_B64`) → gerar novos só da Vera.
2. **`verdict_push.push()` → painel** (em `ws_routes.py`, via `PAINEL_VERDICT_URL`): re-apontar ao endpoint de auth da Vera, **ou** remover a chamada se a Vera ler o veredito direto da DB. Não deixar a apontar ao painel.
3. **`FACE_DB_DSN`** a apontar à DB do painel → DB da Vera.
4. **Consent RGPD** (`consent_text_id`/`consent_at`): alinhar com o texto de consentimento da Vera (RH).
5. **C1 — bug de enroll (flash liveness):** resolver **na origem (painel-cmtec) ANTES de clonar**, senão o clone herda o bug. (memória `project_cmtec_face_enroll_bug_2026_06_17`).

### Smoke-test de aceitação ("como sei que ficou bem")
- [ ] `GET /health` da instância Vera → `{"status":"ok"}`.
- [ ] `POST /enroll/start` (com HMAC da Vera) → 200 + `wsTicket`; `WS /enroll/stream` completa desafios e grava 1 linha em `vera_face.face_templates` (template cifrado).
- [ ] `POST /verify/start` + `WS /verify/stream` com a **mesma cara** → `verdict=pass`; com cara **diferente** → `verdict=fail/no_match`; foto estática → falha por liveness.
- [ ] Logs `[antispoof-shadow] ... enforce=False` aparecem (modo sombra a correr).
- [ ] **Independência:** cortar a rede ao painel-cmtec → enroll/verify da Vera **continuam a funcionar** (prova de zero cordão umbilical).

---

## 2. Motor do agente → `services/agent`

### Origem ✅ (corrigido — usar o clone COMPLETO)
| Campo | Valor |
|---|---|
| Repo/path local | `C:\Users\mjnol\.openclaw\workspace\projects\lince-brain-local\lince_brain\` |
| Branch | `fix/cpu-trend-false-alarms` |
| Último commit | `a326e7e` (HEAD do worktree partilhado) |

> ⚠️ **NÃO usar `projects\hermes\lince_brain\`** — esse clone só tem `agents/crisis_handler.py` (stub). O motor **completo** (FastAPI :18794 + LangGraph `StateGraph` + 14 nós + policy + audit + db + gdpr + bridge LLM) está em **`lince-brain-local`**. O `/opt/lince-brain` da VPS é o deploy; este clone é a cópia fiel para vendorizar.
> Confirma o que a spec já assume: `ARQUITETURA-TEMPO-REAL.md` ("o bot lê o repo do Lince Brain, vê o grafo de nós e as tools") e `INFRA-E-MIGRACAO.md` ("core do Hermes vendorizado dentro do bundle, não puxado de infra nossa em runtime").

### O que é o motor (FastAPI + LangGraph)
- **Entrada:** `app.py` — `FastAPI` na **porta 18794**; `POST /event` (modelo `EventIn`) → `Orchestrator.run()` → `EventResponse`. Também `GET /health`, `POST /gdpr/purge` (Bearer `LINCE_GDPR_TOKEN`), `POST /semantic_search`.
- **Grafo:** `orchestrator.py` (`StateGraph(BrainState)`, build em ~L281-310) — **cadeia linear de 14 nós** → `END`:
  `gatekeeper → memory → entity_memory → self_defense → strategist → marketing → bot_oversight → promise_tracker → prompt_shield → vps_sentinel → web_sentinel → procedural_memory → aggregate → crisis`.
- **Estado:** `BrainState` (TypedDict, `orchestrator.py` L39-49): `event`, `decisions[]`, `aggregate`, `audit_id`, `decision_id`, `recent_decisions`, `pending_corrections`, `beliefs`, `recent_conversation`.
- **Contrato de nó:** `agents/base.py` — `Agent` (Protocol) com `name` + `decide(ctx) -> AgentDecision`. `AgentDecision(verdict, reasoning, action?, confidence)`.
- **Política:** `policy/decision_policy.py` — agrega decisões: precedência **ASK > NOTIFY > AUTO**; downgrade AUTO→NOTIFY se confiança < 0.6; escolhe `action`; `AggregateResult`.
- **Persistência:** `db.py` — `psycopg2.pool.ThreadedConnectionPool`; `search_path={LINCE_DB_SCHEMA},public`; tabelas em `lince_brain.*` (`decisions`, `audit_ledger`, `attention_queue`, `beliefs`, `bot_conversations_unified`, `mateus_corrections`, `patterns`, `knowledge_index`, ...).
- **Auditoria:** `audit.py` + `jcs.py` — **hash-chain RFC 8785** (cada linha encadeia `prev_hash`; `GENESIS` na 1ª; lock advisory por escrita). À prova de adulteração.
- **Kill switch:** `agents/gatekeeper.py` (1º nó) — ficheiro sentinela `/opt/lince-brain/state/SHUTDOWN`; se existe → devolve `ASK` e trava. `Gatekeeper.is_shutdown_active()` para healthchecks.
- **Bridge LLM:** `cli_daemon/` — `protocol.py` (Request/Response + `Backend` Protocol), `client.py` (dispatcher), `backends/anthropic_oauth.py` (POST direto a `api.anthropic.com/v1/messages` via OAuth de `~/.claude/.credentials.json`; map `haiku→claude-haiku-4-5`, `sonnet→claude-sonnet-4-6`, `opus→claude-opus-4-8`), `backends/stub.py` (dev/test). Só `prompt_shield` e `strategist` chamam LLM; restantes são regex/contexto.
- **GDPR:** `gdpr.py` — `purge_customer(...)` (Art.17): redige `audit_ledger` (preserva hash-chain), apaga das outras tabelas, tenant-scoped, identificador hasheado no trilho.
- **Observabilidade/log:** `observability.py` (Langfuse opcional), `logging_config.py` (JSON estruturado).

### CORE — vendorizar como está (engine plumbing)
`app.py` · `orchestrator.py` (runner do grafo + `BrainState`) · `schemas.py` · `config.py` · `db.py` · `audit.py` · `jcs.py` · `gdpr.py` · `logging_config.py` · `observability.py` · `policy/` · `cli_daemon/` (bridge LLM) · `agents/base.py` · `agents/gatekeeper.py`.

**Memória genérica reutilizável (CORE-memória):** `agents/memory_agent.py`, `agents/entity_memory.py` (per-candidato em vez de per-cliente), `agents/semantic_memory.py` (RAG ChromaDB + fallback SQL — base de conhecimento: vaga, cliente, CV), `agents/procedural_memory.py`. Guardrails genéricos: `agents/self_defense.py` (regex anti-injeção), `agents/prompt_shield.py` (classificador LLM de manipulação). Loop de aprendizagem: `agents/outcome_reviewer.py`, `agents/hypothesis_tracker.py`. Escalonamento: `agents/crisis_handler.py` (**trocar Telegram por canal RH**).

### DEIXAR FORA / substituir por nós RH (tools de operações CMTec)
| Nó (ficheiro) | Porquê é CMTec-ops | Ação Vera |
|---|---|---|
| `agents/strategist.py` | sinais de **vendas** (preço/onboarding) | **Substituir** por `hr_strategist` (estratégia de contratação, fit do candidato, lente do cliente) |
| `agents/bot_oversight.py` | audita bots **Madalena/Cronos** | **Substituir** por oversight do copiloto de entrevista (flag de alucinação sobre o candidato) |
| `agents/promise_tracker.py` | follow-ups dos bots WhatsApp | **Substituir** por tracker de promessas da recrutadora |
| `agents/marketing.py`, `agents/caption_dedup.py` | dedup de posts/marketing | **Dropar** |
| `agents/vps_sentinel.py` | systemctl/auth.log da VPS CMTec | **Dropar** ou despir nomes de serviços CMTec |
| `agents/web_sentinel.py` | HEAD a sites CMTec **hardcoded** | **Dropar** ou apontar a sites RH |
| `agents/knowledge_etl.py` | parse de vaults Obsidian CMTec (paths hardcoded) | **Dropar** ou apontar a fonte de conhecimento RH |
| `theory_of_mateus.py` | preditor de aprovação **do Mateus** | **Substituir** por preditor de aprovação RH (cliente/hiring manager) |
| `agents/hello_world.py` | smoke test obsoleto | **Dropar** |

> O grafo é **plug-and-play**: mantém-se a topologia/runner; trocam-se os nós no `orchestrator.py` (remover os `add_node`/`add_edge` dos nós CMTec, ligar os nós RH na mesma cadeia).

### Env vars (config.py — prefixo `LINCE_`)
| Var | Default | Nota |
|---|---|---|
| `LINCE_DB_HOST` / `_PORT` / `_USER` | `127.0.0.1` / `5432` / `lince_brain` | DB da Vera |
| `LINCE_DB_PASSWORD` | **obrigatória** | falha rápido se faltar |
| `LINCE_DB_NAME` / `LINCE_DB_SCHEMA` | `postgres` / `lince_brain` | renomear schema p/ Vera se desejado |
| `LINCE_API_HOST` / `LINCE_API_PORT` | `0.0.0.0` / `18794` | |
| `LINCE_TENANT_DEFAULT` | `cmtec` | **mudar para `vera`** |
| `LINCE_DAILY_BUDGET_USD` | `5.00` | controlo de custo (não imposto no código atual) |
| `LINCE_GDPR_TOKEN` | — | Bearer p/ `/gdpr/purge` (se ausente, endpoint 503) |
| `LINCE_CLAUDE_CREDS_PATH` | `~/.claude/.credentials.json` | OAuth Claude; ou trocar por API key |
| `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID` (`HERMES_*` fallback) | — | usado **só** pelo `crisis_handler` → trocar por canal RH |
| `LANGFUSE_*` | — | observabilidade opcional |

### Dependências
**Sem `requirements.txt`/`pyproject.toml` no clone** — inferir e criar: `langgraph`, `fastapi`, `pydantic`, `pydantic-settings`, `psycopg2`, `httpx`, `chromadb` (opcional), `langfuse` (opcional). **Ação:** o construtor deve fixar versões (recomendado: registar versões da VPS `/opt/lince-brain` antes de fechar).

### REMOVER / cortar ao vendorizar (cordão umbilical)
1. **Telegram do `crisis_handler`** (token/chat do Hermes) → canal de alerta RH (email/Slack/WhatsApp).
2. **Path do kill-switch** `/opt/lince-brain/state/SHUTDOWN` (em `gatekeeper.py`) → `/opt/vera/...` ou env var.
3. **`tenant_default="cmtec"`** → `vera`. Fontes de evento `madalena`/`cronos`/`security` em `schemas.py` `EventSource` → fontes RH (ex. `interview`, `intake`).
4. **DSN/schema** `lince_brain` da VPS → DB/schema da Vera.
5. **OAuth creds** `~/.claude/.credentials.json`: ok manter no dev do Mateus; para o comprador, trocar por API key própria (a spec já prevê "trocar as chaves" no salto).
6. **Nós CMTec-ops** (tabela acima) — não vendorizar os que monitoram infra/sites/bots CMTec.

### Smoke-test de aceitação
- [ ] `GET /health` → `{status, pool_ready:true, version}`.
- [ ] `POST /event` com evento RH mínimo → `200` + `EventResponse{verdict ∈ AUTO|NOTIFY|ASK}`; 1 linha em `decisions` e cadeia em `audit_ledger` íntegra (verificar `prev_hash`/`this_hash`).
- [ ] Criar sentinela SHUTDOWN → próximo `/event` devolve `ASK` (kill-switch).
- [ ] `prompt_shield`/`hr_strategist` chamam Claude com sucesso (token OAuth válido) — ou caem em `StubBackend` sem crashar.
- [ ] `POST /gdpr/purge` (Bearer) → conta linhas redigidas/apagadas e mantém a hash-chain.
- [ ] **Independência:** sem rede ao Hermes :18790 nem à VPS, o `/event` da Vera **funciona** (zero cordão umbilical).

---

## 3. Tempo-real (LiveKit + Soniox) → `apps/realtime`

### Origem
| Campo | Valor |
|---|---|
| Repo/path local | `C:\Users\mjnol\.openclaw\workspace\projects\cmtec-voice-platform\agents\` |
| Branch | `feat/livekit-agents-1.x` |
| Último commit | `10c079a` — *perf(orchestrator): C-step — Turn 1 stream directo ao TTS (gapless)* |

> Confirma o que a spec assume (`ARQUITETURA-TEMPO-REAL.md`): "**Soniox** STT streaming + diarização, **LiveKit** transporte; já em uso no `cmtec-voice-platform`". A Vera precisa só do **andar de transporte + STT-com-diarização**; a lógica de negócio (clínica/Inês) **não** se reaproveita.

### Pasta exata a copiar → `apps/realtime/`
| Ficheiro origem (`agents/`) | Papel | Vera |
|---|---|---|
| `src/adapters/stt_soniox.py` | **Soniox streaming STT** — abre `livekit.plugins.soniox.STT().stream()`, `push_frame(chunk)` PCM 16kHz, lê eventos `is_final`/`confidence`/`latency` | **Copiar**; ver diarização abaixo |
| `src/core/ports.py` | Protocols dos adapters (`STTResult`, `STTAdapter`, `LLMAdapter`, `TTSAdapter`) | **Copiar**; **adicionar `speaker_id`** ao `STTResult` |
| `src/main_v2.py` | **Entry atual** (LiveKit Agents 1.x): `AgentSession(stt,llm,tts,vad,turn_handling)`, `ctx.connect()`, `session.start(room, agent)` | **Copiar como referência** do pipeline; trocar persona/tools |
| `src/adapters/tts_elevenlabs.py` / `tts_azure.py` | TTS (ElevenLabs Flash v2.5 / Azure fallback) | Copiar **só se** a Vera precisar de TTS (a Vera é sobretudo STT; o copiloto pode ser silencioso/texto) |
| `livekit/livekit.yaml` | Config do servidor LiveKit (portas 7880/7881, RTP 50000-60000/udp, Redis, SIP) | **Copiar** (servidor self-host) |
| `agents/pyproject.toml` | Deps (secção abaixo) | Base do `apps/realtime/pyproject.toml` |
| `agents/Dockerfile` + `docker-compose.yml` | Build + stack (livekit + agent + postgres pgvector + redis) | Adaptar nomes/labels p/ Vera |

> **`src/main.py`** é o orquestrador legado (Wave 1, manual). **Usar `main_v2.py`** (framework nativo 1.x — VAD Silero, turn-detector, barge-in).
>
> ⚠️ **NÃO copiar os circuit-breakers do `src/core/orchestrator.py` legado tal-qual (correção 2026-06-18).** Eles são de um **bot de voz conversacional de turnos** (a Inês) e, aplicados a uma **transcrição passiva de 2h**, introduzem uma falha grave:
> - `STT_FAILURE_THRESHOLD=2` → **encerraria a entrevista ao 2.º soluço transitório de Soniox.** Na Vera, falha de STT **nunca** encerra: reconecta + marca `interview_gap` (`RESILIENCIA-E-FALHAS §1`, `§6`).
> - `MAX_TURNS_PER_SESSION=200` → **não se aplica** (a Vera não tem "turnos" do bot; é passiva) → remover.
> - `MAX_TOOL_ITERATIONS_PER_TURN=6` → vale **só para o motor do agente** (`services/agent`, que faz tool-loop), **não** para o copiloto ao vivo (que não faz tool-loop por tick).
>
> A política de falha/retry/fallback/teto do copiloto está em **`RESILIENCIA-E-FALHAS.md`** — reimplementar a partir daí, não copiar as constantes da Inês. O copiloto ao vivo só tem **um** corte total: o **kill-switch explícito** da Filipa.

### Soniox — como integra (o que a Vera precisa)
- Plugin `livekit-plugins-soniox` (wrap do WS Soniox). Config em `main_v2.py`: `soniox.STT(params=STTOptions(model="stt-rt-v3", language_hints=["pt","en"]))`, endpoint-detection ON, 16kHz mono.
- Áudio: `stream.push_frame(chunk)` (bytes do LiveKit) → eventos `STTResult(text, is_final, confidence, latency_ms)`.
- ⚠️ **DIARIZAÇÃO NÃO está implementada** no adapter atual: `STTResult` não tem `speaker_id` e o `stt_soniox.py` não extrai labels de falante. **A Vera DEPENDE de diarização** (separar recrutadora/candidato/cliente — ver `ARQUITETURA-TEMPO-REAL.md`). **Trabalho NOVO obrigatório:** (1) ativar diarização na config Soniox; (2) extrair `speaker`/`speaker_id` do evento; (3) adicionar campo a `STTResult` (`ports.py`); (4) propagar no pipeline. **Confirmar limites de sessão longa (2h) do Soniox** (porta aberta na spec).

### LiveKit — como integra
- `livekit-agents>=1.0.0` (+ plugins soniox/elevenlabs/azure/anthropic/silero/turn-detector). `AgentSession` faz captura de mic → STT → LLM (tool loop) → TTS → playback; interrupção "adaptive" (VAD + turn-detector).
- Entrada via `cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))`; `ctx.room` auto-join; áudio: `LiveKit Room → AudioStream[bytes] 16kHz → stt_soniox`.
- Servidor: `livekit/livekit.yaml` (sig 7880, TURN 7881, RTP 50000-60000/udp, Redis para estado, SIP p/ telefonia — **a Vera pode dispensar SIP** se for só "bot entra na call" via WebRTC, ver `ARQUITETURA-TEMPO-REAL.md` "caminho C / LiveKit próprio").

### Env vars (`.env.example` — mínimo para a Vera)
```
LIVEKIT_URL=wss://<host-livekit-vera>
LIVEKIT_API_KEY=...
LIVEKIT_SECRET=...
SONIOX_API_KEY=...            # dev do cmtec-voice-platform p/ a simulação inicial
ANTHROPIC_API_KEY=...         # ou OpenRouter conforme LLM_BACKEND
DATABASE_URL=postgresql://... # pgvector (memória/RAG)
REDIS_URL=redis://...
# TTS só se necessário:
ELEVENLABS_API_KEY=... / ELEVENLABS_VOICE_ID_* / AZURE_SPEECH_KEY+REGION
```
(lista completa — telefonia Telnyx, S3 gravações, Langfuse, Cal.com — no `.env.example` da origem; a maioria **não** se aplica à Vera.)

### Deploy
`docker-compose.yml`: `livekit` (7880/7881 + 50000-60000/udp), `agent` (build local), `postgres` (pgvector/pg16, 127.0.0.1:5432), `redis` (127.0.0.1:6379), `caddy` (80/443). `docker-compose.demo.yml` = mínimo (postgres+redis). Dockerfile = multi-stage `python:3.12-slim`.

### REMOVER / cortar ao vendorizar (cordão umbilical)
1. **Persona "Inês" + tenant clínica hardcoded** em `main_v2.py` (`DEMO_TENANT_ID`, `DEMO_TENANT_NAME`, `GREETING_TEMPLATE`) e `prompts/system_ines.md` → criar `system_vera.md` (contexto RH).
2. **Tools de negócio clínico** `src/tools/` (`book_appointment`, `cancel_appointment`, `list_appointment_slots`, `lookup_patient`, `search_kb`) → **substituir** por tools RH; aproveitar só `flag_for_human.py` (escalonamento genérico).
3. **Telefonia Telnyx** (`telephony_telnyx.py`, SIP) — dropar se a Vera não faz chamadas telefónicas.
4. **Compliance/legal de saúde** (`legal/`, `compliance/`) — a Vera precisa de **revisão legal própria** (dados de candidatos, RGPD = responsabilidade da agência).
5. **Web demo** (`web/`) — UI da clínica → UI da Vera.
6. **Voz da Inês (ElevenLabs)** — não reutilizar a voz clonada; escolher voz/idioma da Vera (ou nenhum TTS).

### Smoke-test de aceitação
- [ ] Servidor LiveKit sobe (7880) e o `agent` liga (`LIVEKIT_URL=ws://livekit:7880`).
- [ ] Uma sessão de teste: áudio → Soniox devolve transcrição **com `is_final`** e **com `speaker_id`** distinto para 2 falantes (prova de diarização nova).
- [ ] Sessão **longa simulada (~1–2h)** mantém a stream Soniox viva via **reabertura proativa com overlap** (confirmar limite real do Soniox) — gap=0 na troca; alinha com "validar custo" do `INFRA-E-MIGRACAO.md` (B6/B7).
- [ ] **Resiliência passiva (NÃO os breakers da Inês):** matar o Soniox a meio → a sessão **NÃO encerra**, reconecta e grava 1 `interview_gap`; matar o LLM do tick → cai para fallback/“só transcrição”, Camada A intacta (`RESILIENCIA-E-FALHAS §1/§3/§6`).
- [ ] Teto de custo por entrevista dispara alerta (70/90%) e degrada cadência no soft-cap, sem cortar a transcrição (`RESILIENCIA §4`).
- [ ] **Independência:** nenhuma chamada à infra de voz CMTec/Telecof em runtime — só LiveKit+Soniox da Vera.

---

## 4. Skills reutilizáveis (sourcing + geração de ficheiros)

> Skills **invocam-se** (via Skill tool / MCP), **não se vendorizam** para dentro da Vera como serviço. Servem o fluxo da Filipa (sourcing de candidatos, exportar parecer/relatório).

### 4a. Sourcing — `lead-pipeline` + `scrapling` (Apify)
| Campo | Valor |
|---|---|
| Localização | `C:\Users\mjnol\.claude\skills\lead-pipeline\` (+ `scrapling\`) |
| Conteúdo | `SKILL.md`, `decision-tree.md`, `README.md`, `prompts/ALL-PROMPTS.md` |
| Como invocar | Skill tool `lead-pipeline` (auto-trigger: "gerar leads", "prospectar", "enriquecer lista", "linkedin/instagram/google maps") |
| Motores | **Scrapling** (grátis, local, v0.4.7 + MCP `scrapling mcp`) e **Apify** (MCP, pago, free tier $5/mês) |
| **lead-scraper-apify** | os prompts de scraping Apify (LinkedIn/Instagram/Facebook) vivem em `prompts/ALL-PROMPTS.md` §06/§07/§08 — **não há skill separada com esse nome**; é o `lead-pipeline` que cobre Apify |
| **lead-enricher** | **enrichment cascade** = `prompts/ALL-PROMPTS.md` §05 (gmaps→LinkedIn→Instagram→páginas-amarelas; colunas `email_source`/`enriched_via`) — também dentro do `lead-pipeline`, não skill autónoma |
| Pré-req Apify | `claude mcp add apify-cmtec "https://mcp.apify.com?token=$APIFY_MCP_TOKEN_CMTEC"`; token em `~/.openclaw/workspace/.env` |

> **Para a Vera (RH):** adaptar os prompts §06 (LinkedIn) / §07 (Instagram) para **sourcing de candidatos** (não leads de venda). Reutiliza-se o motor + o cascade de enrichment; muda-se o nicho/critério.

### 4b. Geração de ficheiros (xlsx / docx / pdf)
| Opção | Onde | Como invocar | Quando usar na Vera |
|---|---|---|---|
| **Plugin `anthropic-skills`** | marketplace (na lista de skills disponíveis: `anthropic-skills:docx`, `:xlsx`, `:pptx`, `:pdf`) — **NÃO instalado localmente em `~/.claude/skills/`** | Skill tool `anthropic-skills:docx` etc. | **Parecer/relatório ao cliente** (docx/pdf), export de candidatos (xlsx). Recomendado para output Office. |
| **`document_tools.py` (Hermes)** | `C:\Users\mjnol\.openclaw\workspace\projects\hermes\patches\document_tools.py` (+ `apply_document_tools.py`); deploy em `/opt/hermes/agents/document_tools.py` | tools do Hermes (`generate_pdf`, `markdown_to_pdf`, `url_to_pdf`, `screenshot_url`, `pdf_extract_text`, `ocr_image`) — via Playwright Chromium | Se a Vera quiser **gerar PDF do parecer pelo próprio motor** (markdown→PDF tema CMTec) sem depender do plugin. Código vendorizável. |
| **`doc-coauthoring` / `slides`** | `~/.claude/skills/doc-coauthoring\`, `~/.claude/skills/slides\` | Skill tool | Redigir specs/relatórios estruturados (não Office binário). |

> **Decisão pendente p/ o construtor:** export do parecer = plugin `anthropic-skills:docx/pdf` (mais simples, mas dependência de skill) **ou** vendorizar `document_tools.py` (Playwright, self-contained). Para o **comprador** (instância autónoma), `document_tools.py` evita dependência de skills do ambiente Claude do Mateus.

### Smoke-test de aceitação (skills)
- [ ] `lead-pipeline` corre o prompt §00 (entrevista) e gera ≥1 candidato de teste; cascade §05 preenche `enriched_via`.
- [ ] Gerar 1 **parecer.pdf** + 1 **candidatos.xlsx** de exemplo (via a opção escolhida) — abrem sem erro.
- [ ] Apify: o crédito consumido é reportado (prompt já pede o saldo do $5/mês).

---

## Notas finais (riscos/portas que tocam o reuse)

- **Biometria flash liveness (C1):** corrigir na **origem** antes de clonar (senão o clone herda).
- **Anti-spoof:** clonar em modo SOMBRA; **ligar `ANTISPOOF_ENFORCE=true` antes de vender / >1 utilizador**.
- **Diarização (peça 3):** é **código NOVO** sobre o adapter Soniox (não vem de borla) — é o maior trabalho não-trivial do reuse de tempo-real.
- **Circuit-breakers (peça 3):** os do orquestrador legado da Inês são de **bot de voz** — **não copiar** para o copiloto passivo (matariam a entrevista de 2h). Reimplementar via `RESILIENCIA-E-FALHAS.md`. Os de tool-loop migram para o motor do agente (peça 2).
- **Teto de custo (peça 2):** `LINCE_DAILY_BUDGET_USD` herdado **não é imposto no código** e é diário/global — a Vera precisa de **teto POR ENTREVISTA** (`INTERVIEW_COST_CAP_USD`, `RESILIENCIA §4`), alimentado por `interview_tick.cost_usd` (`MODELO-DADOS §14`).
- **Deps do agente:** o clone `lince-brain-local` não traz `requirements.txt` — fixar versões (idealmente as da VPS) antes da Fase 3.
- **Princípio transversal:** depois de clonar, **trocar todas as chaves/segredos/DSN/endpoints** e provar **independência** (cortar a infra CMTec e ver cada peça a funcionar).
