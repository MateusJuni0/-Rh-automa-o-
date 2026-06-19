# PLANO DE CONCLUSÃO PROFISSIONAL — Vera v1 (síntese de 7 auditorias)

## 1. Veredito honesto do gap

A **fundação está sólida e verde**, mas **o produto NÃO está completo**. O que existe é o *back-end* e os *contratos*; falta tudo o que a Filipa e a Inês veem e tocam:

**Construído (feito/verde):** monorepo pnpm; `@rh/db` (35 tabelas vivas em Postgres + migração + seed IRIS); `@rh/core` (contratos Zod, protocolo WS congelado, envelope, idempotência); `@rh/ai` (registry de slots EXTRACTOR/ARCHITECT/LIVE + transporte OpenRouter + features extract/judge/prepare/intake/live + mock determinístico, 35 testes); `@rh/knowledge` (RAG pgvector, search ancorado); `apps/realtime` (TickEngine real ~75 linhas + frames + TranscriptSource mock); `apps/ws` (servidor handshake + codec + FrameSession, auth via hook *stub*); `@rh/intake-bots` (MessageSource + bridge mock); 11 rotas API REST (envelope `{ok,data|error}`, Zod, GUC `agency_id`); `services/agent` + `services/face` (esqueletos FastAPI 501); shim de auth single-tenant.

**Em falta (o coração do produto):**
- **`apps/desktop` Electron NÃO EXISTE** — nem janela, nem overlay HUD, nem cliente WS, nem login. É *"a estrela"* (Tela 6) e está a zero.
- **Componentes HUD a zero** — `globals.css` é só `@import "tailwindcss"` (tema branco/violeta, **não** o dark Apollo); nenhum componente de pílula/sugestão/semáforo/chat. Design tokens só na spec.
- **Painel web ~15% feito** — 3 páginas de lista básicas (clientes/vagas/candidatos) + 1 home. Telas 1 (dashboard/kanban), 3 (triagem), 4 (candidato detalhe), 5 (briefing UI), 7 (parecer UI), 8–12 — **todas sem UI**, embora as rotas/lib backend existam.
- **Assistente ("ChatGPT dela") a zero** — motor ReAct (`services/agent`) é 501; sem tool registry, sem porta de confirmação, sem onboarding, sem proativo, sem UI de chat.
- **Auth real / biometria** — Supabase Auth é shim; `services/face` é 501 (bug de enroll/flash liveness por resolver na origem `cmtec-face`; anti-spoof OFF — gate antes de vender).
- **Resiliência realtime, REST de entrevista** (`POST /api/interviews`, `/join`, `/:id/report`), reconexão WS com replay, refresh JWT — definidos na spec, sem código.

Tudo o que falta é **mock-construível AGORA** (sem chaves), exceto: captura de áudio local (FAST-FOLLOW, fora do v1), adapters LiveKit/Soniox/OpenRouter/Embedder/Exa/Resend/Calendar/Apify reais, code-signing/notarização, motor `cmtec-face` real. Esses são o **handover de chaves final**.

## 2. Fases ordenadas (demonstrável primeiro)

Regra: **uma base de código; mock-first; teste↔produção muda só o `.env`**. Cada fase é mock-construível salvo indicação. Respeita o scope v1 (não gold-plating): o que a spec marca FAST-FOLLOW fica de fora.

---

### FASE I — Sistema de design Apollo + shell web dark (a base visual de tudo)
- **Objetivo:** parar o tema branco/violeta; materializar os DESIGN-TOKENS num tema partilhável entre web e (futuro) desktop.
- **Inclui:** tokens CSS dark Apollo (`bg/base #0E1116`, `accent #5DCAA5`, semáforo) no `globals.css` + tema Tailwind; biblioteca mínima de componentes (Button, Card, Input, Tabs, Modal, Chip, semáforo de estado, skeleton, empty-state, error-retry) num `packages/ui` partilhado (resolve D7 — reuso HUD web↔desktop); navbar/layout com logo Vera + contexto ativo + breadcrumb; os 3 estados UX (vazio/loading/erro) como primitivas.
- **mockBuildable:** sim · **needsKeys:** não · **esforço:** M
- **Aceitação:** dark mode em tudo; tokens batem nos mockups; 3 páginas existentes re-skinned; componentes têm story/teste de render; Biome+build verdes.

### FASE J — App Desktop Electron + Overlay HUD ao vivo (a ESTRELA, mock-fed) ⭐
- **Objetivo:** o `apps/desktop` demonstrável: pílula always-on-top que expande, a pintar o estado vivo a partir de um **mock WS feed** (sem áudio, sem LiveKit).
- **Inclui:** scaffold Electron + electron-builder (Win+macOS) com **hardening R2** (sandbox, contextIsolation, nodeIntegration=false, preload+contextBridge, allowlist navegação, CSP — BLOQUEADOR de segurança, entra já); `BrowserWindow` frameless/transparent/alwaysOnTop/arrastável/skipTaskbar/multi-monitor persistido; tray (🔴/⚪, abrir web, terminar, sair); cliente WS consumidor de `tick.update`/`suggestion.next`/`coverage.update`/`alert` com reconnect+backoff+`state.snapshot`; **HUD (reusa `packages/ui` da Fase I):** pílula compacta, painel expandido, sugestão grande + porquê, fila, **semáforo 4 estados** (⬜🟡✅⚠), cronómetro, 🔴, "Usei"/"Pular"/"★", **chat ao vivo** inline, rede de segurança no fim; os 9 estados de vida do overlay (a ouvir/pensar/sugestão/veredito/rede/chat/pesquisa/áudio-caiu/diarização); safeStorage (tokens+device-id, mock login bypass); offline declarado; encerramento → `POST /api/interviews/:id/report`.
- **Fora (FAST-FOLLOW, NÃO v1-crítico):** captura de áudio mic/sistema, LiveKit publisher, heartbeat/VU, reconexão de áudio, ScreenCaptureKit, permissões SO de áudio, estado "sem contexto" (a desenhar).
- **mockBuildable:** sim (feed WS mockado em memória/JSON) · **needsKeys:** não · **esforço:** XL
- **Aceitação:** correr o app; overlay aparece sobre outra janela; um feed mock dispara sugestão→semáforo muda→auto-dismiss; chat ao vivo devolve resposta mock; hardening verificado (sem nodeIntegration); reconnect ao matar/reabrir o ws mock.

### FASE K — Orquestração da entrevista ao vivo (ligar realtime↔ws↔desktop, mock STT)
- **Objetivo:** o pipeline "durante" funciona ponta-a-ponta com fonte mock — o que prova o produto sem chaves.
- **Inclui:** integrar `TickEngine` à `TranscriptSource` → escrever estado em `interview_tick` (escritor único + CAS família G); ligar `apps/ws` ao realtime (sair do stub: auth hook valida JWT mock + **posse** `SELECT 1 FROM interview...`); REST `POST /api/interviews` (cria interview + devolve sala/token mock), `/join`, `/:id/report`; ciclo de vida interview (scheduled→live→done→distilled); resiliência **pura** de `RESILIENCIA-E-FALHAS` (timeout do tick, fallback de modelo, degradar para "só transcrição", `interview_gap`, teto de custo — é lógica, zero chaves); chat ao vivo → motor realtime responde do estado quente; reconexão WS com replay (`last_seq`) + refresh JWT silencioso.
- **mockBuildable:** sim (TranscriptSource manual injeta uma entrevista guião) · **needsKeys:** não · **esforço:** L
- **Aceitação:** correr uma "entrevista golden" mockada → ticks produzem frames → desktop pinta → parecer dispara no fim; matar STT mock → HUD "a religar", gap marcado, sem perder a entrevista.

### FASE L — Painel web "Antes→Depois" (Telas 1,2,3,4,5,7 — o fluxo v1)
- **Objetivo:** a recrutadora trabalha o ciclo todo no painel (a parte v1 do web; Telas 8–12 são fast-follow).
- **Inclui:** Tela 1 dashboard/kanban (colunas Novos→…→Colocado, cronómetro, ▶ Copiloto); Tela 2 vaga (form profissional + feedback de extração IA + edição de skills/chips); Tela 3 triagem (ranking match %, chips cobertos/faltantes, 1-linha resumo, ✓/✗/👁); Tela 4 candidato detalhe (CV destrinchado, timeline, gaps vs vaga); Tela 5 briefing UI (resumo + roteiro 3 lentes + ▶ Iniciar); Tela 7 parecer (abas Interna/Cliente, citações clicáveis com timestamp, editar antes de enviar, export md, "preparar email"); transições de processo atómicas (envia parecer→submitted, CAS) + rede de segurança must-have.
- **mockBuildable:** sim (todo o backend/lib já existe; IA via mock) · **needsKeys:** não (PDF export e email real = handover) · **esforço:** L
- **Aceitação:** percorrer vaga→triagem→candidato→briefing→[copiloto]→parecer→submitted sem ecrã branco; cada tela cobre vazio/loading/erro; parecer cita ≥80% com prova/rubric.

### FASE M — Assistente conversacional ("ChatGPT dela") + proativo (mock-fed)
- **Objetivo:** o coração #2 — chat geral com ferramentas, memória e proatividade, tudo com mocks.
- **Inclui:** motor ReAct em `services/agent` (clonar/vendorizar `lince-brain-local`, reconfigurar nós RH, GUC `agent_db_session`, orçamento de tokens/passos, kill-switch, logging `assistant_action`); **porta de confirmação** (leitura/rascunho/gravar/enviar_fora, idempotência); tool registry + executor com **mocks** (gen_spreadsheet, gerar_cv, rascunhar_email, search_knowledge, comparar candidatos, ler/marcar agenda, sourcing, pesquisa web — todas mock); memória durável (captura+consolidação+evicção de recruiter/candidate/client facts); onboarding conversacional; proativo (agenda mock, prep summaries, no-show, guarantee follow-up, deteção de lacunas do mandato); **UI web** Telas 8 (Q&A), 9 (assistente+artefactos+confirmação), 10 (comparar), 11 (onboarding); chat ao vivo Modo D já ligado na Fase J/K.
- **mockBuildable:** sim · **needsKeys:** não (Apify/Calendar/Resend/OpenRouter reais = handover) · **esforço:** XL
- **Aceitação:** pedir ao assistente "compara o João e a Maria" → matriz com trade-offs; "envia email ao cliente" → cartão de confirmação, só envia (mock) após OK; facto novo dito → aparece na memória; proativo dispara prep summary de um evento mock.

### FASE N — Auth, biometria, definições, segurança e RGPD (mock + gates v1)
- **Objetivo:** fechar o caminho de login/segurança que o v1 exige, com mocks onde a chave/infra falta.
- **Inclui:** Login UI (rosto-primeiro + email/senha fallback + flash liveness desenhado); shim→`@supabase/ssr` por trás de interface; tabelas biometria (`face_templates`/`trusted_devices`/`face_verdicts`); consumo atómico de veredito (anti-replay); Tela 12 Definições (modelo por slot, dispositivos, biometria, RGPD export/apagar); guard de consentimento de captura; isolamento `agency_id` auditado em todas as rotas (usar `withAgencySession`); validador único de upload (mime/magic/tamanho, ClamAV mockável); signed URLs com prefixo agency; jobs de purga em cascata + verificação "zero PII órfã"; gates de entrega (SCA/secret-scan/SAST/fuzz no CI).
- **Fora v1 (anotar):** cifra-em-repouso LUKS/pgcrypto, backups cifrados off-site, hash-chain transcript, cosign, self-pentest, 2FA, re-auth 24h, S2S Ed25519 real, roles least-privilege — fast-follow/operacional.
- **mockBuildable:** maioria sim · **needsKeys:** parcial · **esforço:** L
- **Aceitação:** login mock (rosto bypass + email/senha) entra; rota sem posse rejeitada; upload malicioso barrado; purge_candidate deixa zero PII órfã (teste); CI corre os gates.

### GRUPO Ω — HANDOVER DE CHAVES IRIS (ÚNICO grupo que toca em chaves — NÃO no loop nocturno)
Trocar `mock*`→adapter real via `.env`, sem reescrever features:
- **Chaves de serviço:** OpenRouter, Embedder (OpenAI), Exa+Brave, LiveKit, Soniox, Resend, Google Calendar, Apify, Telegram, Evolution/WhatsApp, Supabase Auth real.
- **Captura áudio local desktop** (FAST-FOLLOW presencial: WASAPI/ScreenCaptureKit, LiveKit publisher, heartbeat/VU, reconexão áudio).
- **Biometria real:** resolver bug enroll/flash liveness no `cmtec-face` na origem + **anti-spoof MiniFASNet ON** (gate bloqueador antes de >1 utilizador).
- **Distribuição assinada:** code-signing Authenticode EV (Win) + Developer ID + notarização (macOS) + auto-update assinado com pin de chave (D4/D6 — decidir CMTec vs IRIS).
- **Infra/ops:** Docker limites de container, backup Storage cifrado off-VPS, contrato RGPD (agência = Controladora).

## 3. Mock-grátis (construímos agora) vs Chaves IRIS (handover)

| Constrói AGORA (mock, sem chaves) | Handover final (chaves/infra IRIS) |
|---|---|
| Fases I, J, K, L, M, N inteiras com mocks | Adapters reais OpenRouter/Embedder/Exa/Brave/LiveKit/Soniox/Resend/Calendar/Apify/Telegram/WhatsApp |
| HUD, desktop, pipeline ao vivo (feed mock) | Captura áudio local (FAST-FOLLOW) + LiveKit publisher |
| Painel web completo v1, assistente+proativo | Biometria real cmtec-face + anti-spoof ON |
| Auth shim, validações, purga, gates CI | Code-signing/notarização/auto-update assinado |
| Resiliência (lógica pura) | Supabase Auth real, limites container, backup cifrado, contrato RGPD |

---

## 4. loopPrompt (colar `/loop` + bloco numa sessão nova)

```
[COMPLETAR A VERA v1 — FASE 3 (continuação): CONSTRUIR O PRODUTO DEMONSTRÁVEL, LOOP AUTÓNOMO]

És o CLAUDE (CEO de Engenharia da CMTecnologia). A FUNDAÇÃO da "Vera" (motor interno "Lince")
— copiloto de IA de recrutamento ao vivo, APP INTERNO da IRIS Tech (2 utilizadoras Filipa+Inês,
single-tenant, NÃO se revende) — JÁ ESTÁ verde (DB 35 tabelas viva, @rh/ai, @rh/knowledge, @rh/core,
apps/realtime+ws skeleton, intake-bots, services/agent+face 501, shim auth). Agora vais CONSTRUIR O
PRODUTO QUE FALTA: a ESTRELA (app desktop + overlay HUD ao vivo), o painel web, e o assistente. Tudo
com qualidade de produção, demonstrável e testável SÓ COM MOCKS. Sem pressa de "feito".

## 0. ARRANQUE (1ª iteração — LÊ antes de tocar em código)
- Repo: C:\Users\mjnol\.openclaw\workspace\projects\rh-automacao. Branch de build: phase3/build
  (continua nela; NUNCA main nem a branch de spec). Pesquisa a memória ("vera", claude-mem).
- LÊ: BUILD-LOG.md (onde estás) + git log/status; depois, por área da fatia: UI-DESIGN.md (Tela 6 +
  telas web), DESIGN-TOKENS.md, APP-DESKTOP.md, ARQUITETURA-TEMPO-REAL.md, ARQUITETURA-INTEGRACAO.md,
  AGENTE-TOOLS-E-WS.md, ASSISTENTE-PESSOAL.md/CONVERSA/PROATIVO, AUTENTICACAO.md/AUTH-CONTRACT.md,
  RESILIENCIA-E-FALHAS.md, RELATORIO-CLIENTE.md, JORNADA-POS-PARECER.md, SEGURANCA.md/DATA-RETENTION.md,
  TESTES-ACEITACAO.md (critérios + testes A–M). NÃO re-decidir o que a spec fixou (v1 LOCKED 2026-06-18).
- RESPEITA O SCOPE v1: NÃO construir o que a spec marca FAST-FOLLOW (captura áudio local, LiveKit
  publisher, heartbeat/VU áudio, anti-spoof real, estado overlay "sem contexto", multi-tenant, cifra
  repouso/backups/hash-chain/cosign/2FA/re-auth-24h). Zero gold-plating.

## 1. FASES POR ORDEM (demonstrável primeiro — segue esta sequência)
- FASE I — Sistema de design Apollo + shell web dark: tokens CSS dark (#0E1116/#5DCAA5/semáforo) +
  tema Tailwind + packages/ui (Button/Card/Input/Tabs/Modal/Chip/semáforo/skeleton/empty/erro) +
  navbar/layout com contexto ativo + 3 estados UX. (M)
- FASE J — App Desktop Electron + Overlay HUD ⭐: apps/desktop scaffold + electron-builder Win/macOS,
  HARDENING R2 obrigatório (sandbox+contextIsolation+nodeIntegration:false+preload contextBridge+
  allowlist+CSP) JÁ; BrowserWindow frameless/transparent/alwaysOnTop/arrastável/skipTaskbar/multi-monitor;
  tray; cliente WS (tick/suggestion/coverage/alert) + reconnect/backoff/state.snapshot; HUD reusa
  packages/ui (pílula↔expandido, sugestão+porquê, fila, semáforo 4 estados, cronómetro, 🔴, Usei/Pular/★,
  chat ao vivo, rede de segurança); 9 estados de vida; safeStorage (tokens+device-id, login bypass mock);
  offline declarado; encerramento → POST /api/interviews/:id/report. Feed do HUD = MOCK WS. SEM áudio. (XL)
- FASE K — Orquestração entrevista ao vivo (mock STT): TickEngine↔TranscriptSource→interview_tick
  (escritor único+CAS); ws sai do stub (JWT mock + posse SELECT 1 FROM interview); REST POST
  /api/interviews + /join + /:id/report; ciclo interview; resiliência PURA (timeout tick/fallback/
  degradar/interview_gap/teto custo); chat ao vivo do estado quente; reconexão WS replay + refresh JWT. (L)
- FASE L — Painel web Antes→Depois (Telas 1,2,3,4,5,7): dashboard/kanban+cronómetro+▶Copiloto; vaga
  (form+feedback IA+chips); triagem (match%+chips+✓/✗/👁); candidato detalhe (CV+timeline+gaps); briefing
  UI (3 lentes+▶Iniciar); parecer (abas Interna/Cliente+citações clicáveis+editar+export md); transições
  de processo atómicas+rede de segurança. (L)
- FASE M — Assistente ("ChatGPT dela")+proativo (mock): motor ReAct em services/agent (vendoriza
  lince-brain-local, GUC agent_db_session, orçamento tokens/passos, kill-switch, log assistant_action);
  porta de confirmação (leitura/rascunho/gravar/enviar_fora+idempotência); tool registry+executor MOCK
  (planilha/cv/email/search/comparar/agenda/sourcing/pesquisa); memória durável (captura+consolidação+
  evicção); onboarding conversacional; proativo (prep/no-show/guarantee/lacunas-mandato); UI Telas 8/9/10/11. (XL)
- FASE N — Auth/biometria/definições/segurança/RGPD (mock+gates v1): Login UI (rosto+email/senha+flash
  liveness desenhado); shim→@supabase/ssr atrás de interface; tabelas face_templates/trusted_devices/
  face_verdicts + consumo atómico veredito; Tela 12 Definições; guard consentimento captura; agency_id
  auditado (withAgencySession) em TODAS as rotas; validador upload (mime/magic/tamanho+ClamAV mock);
  signed URLs prefixo agency; jobs purga cascata + verificação zero-PII-órfã; gates CI (SCA/secret/SAST/fuzz). (L)

NUNCA tocar em chaves/serviços pagos. O handover de chaves IRIS (OpenRouter/Soniox/LiveKit/biometria
real/code-signing/etc.) é do Mateus NO FIM — fica documentado em KEYS-TODO.md, FORA deste loop.

## 2. DISCIPLINA POR FATIA (NUNCA pular)
Fatia pequena e completa: (1) karpathy-guidelines em fatia não-trivial; (2) TDD — TESTE primeiro (RED)
de TESTES-ACEITACAO + famílias A–M; (3) implementa o MÍNIMO (GREEN); TypeScript strict, Zod nas
fronteiras, imutável, zero any/as cego, ficheiros <800 linhas; (4) typecheck + BUILD verde; (5) TESTES
passam; (6) Biome limpo; (7) CODE-REVIEW (code-reviewer/ /code-review) → corrige CRITICAL+HIGH; (8)
ARRUMA (zero código morto/TODO da fatia/duplicação); (9) SIMULA/CORRE e observa o comportamento real
(o app abre? o overlay pinta o frame? o ws autentica+posse? o agente chama tool com args válidos?) —
verification-before-completion, não declarar "feito" sem correr; (10) COMMIT conventional (SEM
Co-Authored-By) + push só com tudo verde — NUNCA deixar a branch partida; (11) atualiza BUILD-LOG.md
(feito/passou/falta/bloqueios); (12) agenda o próximo wake/fatia.

## 3. ORQUESTRAÇÃO
Build dependente → loop principal. Fatias independentes (ex.: packages/ui ↔ scaffold desktop; ou
build+code-review) → dispatch subagentes em PARALELO (máx 3, skill dispatching-parallel-agents) com
contexto completo (projeto, scope só-IRIS, ficheiros a ler, NÃO-fazer, convenções). Rate-limit em
rajada → reduz a 1–2 ou faz no loop; nunca bloquear o loop. Reusa clones (REUSE-MAP.md) VENDORIZANDO.

## 4. RAILS (overnight, não-assistido)
LOCAL-FIRST: tudo contra Supabase local + mocks. ZERO custo API, ZERO deploy prod, ZERO tocar
sites/serviços de cliente ou VPS 72.60.88.137. NUNCA hardcodar segredos (process.env/os.environ; .env*
gitignored; varre o diff antes de commit). Aplica os gates de SEGURANCA desde já (isolamento agency_id,
anti-SSRF egress, validador upload, ZDR, hardening Electron). NÃO inventar: se a spec não define, segue
packages/core; se faltar mesmo, LOG como BLOQUEIO no BUILD-LOG e salta para a próxima fatia independente
(não adivinhar, não parar o loop, não acordar o Mateus a meio da noite). Spikes arriscados → stub/mock
primeiro + tarefa para o Mateus no BUILD-LOG.

## 5. CADA ITERAÇÃO
Lê BUILD-LOG + git status → escolhe a PRÓXIMA fatia na ordem das fases → disciplina §2 → commita →
atualiza BUILD-LOG. Effort high em fatias não-triviais (desktop, realtime, agente, contratos). Fatia
grande → parte em sub-fatias.

## 6. STOP FINAL (só quando o v1 demonstrável estiver completo)
Continua o loop até as Fases I→N estarem verdes e o produto ser DEMONSTRÁVEL ponta-a-ponta SÓ COM MOCKS:
- correr apps/desktop → overlay aparece, um feed mock dispara sugestão→semáforo→auto-dismiss + chat ao vivo;
- correr uma "entrevista golden" mockada → ticks→frames→desktop pinta→parecer no fim;
- percorrer no web vaga→triagem→candidato→briefing→parecer→submitted sem ecrã branco (3 estados UX);
- assistente faz Q&A/comparação/confirmação de envio + proativo dispara; login mock entra.
Ao parar (este marco OU marco natural): garante TUDO commitado+pushed, branch verde, BUILD-LOG com
RESUMO (feito/a fazer/bloqueios/spikes p/ Mateus) + KEYS-TODO atualizado + memória (claude-mem + topic
project_rh_automacao_copiloto_2026_06_17). NUNCA deixar nada partido. Não ligar nenhuma chave — isso é
o handover final do Mateus.

Começa AGORA: lê BUILD-LOG + git status → FASE I (tokens dark Apollo + packages/ui + shell web), com TDD.
Reporta progresso conciso a cada iteração.
```

---

**Ficheiros-chave (paths absolutos):** spec da estrela `C:\Users\mjnol\.openclaw\workspace\projects\rh-automacao\APP-DESKTOP.md` + Tela 6 em `UI-DESIGN.md:95` + tokens `DESIGN-TOKENS.md`; estado atual: `apps/web\app\globals.css` (só `@import "tailwindcss"` — tema errado), `apps/web\app\layout.tsx`/`page.tsx` (shell branco/violeta, 3 listas), `apps/realtime\src\engine.ts` (TickEngine real, 75 linhas), `apps/ws\src\server.ts` (auth hook stub, 112 linhas); **`apps/desktop` NÃO EXISTE**; `services/agent` + `services/face` a 501; diário em `BUILD-LOG.md`; chaves em `KEYS-TODO.md`; disciplina-base em `PROMPT-FASE-3-LOOP.md`.