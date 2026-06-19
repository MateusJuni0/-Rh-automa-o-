# BUILD-LOG — Fase 3 (Vera)

> Diário do loop de construção. Cada iteração regista: **o que fez · o que passou (build/testes/review)
> · o que falta · bloqueios/spikes para o Mateus**. O Mateus lê isto de manhã. Mais recente no topo.

**Estado inicial (pré-build):** spec 100% provada (13 famílias A–M, 35 tabelas). Nada de código ainda.
Próximo: branch `phase3/build` → scaffold monorepo → `packages/db` (schema das 35 tabelas) com TDD.
Método e regras: `PROMPT-FASE-3-LOOP.md` + `FASE-3-ARRANQUE.md`.

---

## [2026-06-19 ~16:25] iteração 38 — 🚧 FASE K (1/N): REST `POST /api/interviews` + ciclo de vida (CAS)

**Feito (`apps/web`):** primeira fatia da orquestração ao vivo — o ciclo de vida da entrevista:
- `lib/interviews.ts` — `createInterview` (insere `interview`: sem processo→**'unstructured'** órfã §12, com processo→**'live'**; `captureType:'none'` v1; devolve `{interviewId, room, token}` **MOCK** inertes — LiveKit real = handover); `getInterview` (filtrado por agency); **`transitionInterview`** (guarda de transições válidas + **CAS por status atual**: `UPDATE … WHERE status=<lido>` → 0 linhas = corrida; **recheck idempotente** se uma transição concorrente já levou ao mesmo destino); `InvalidTransitionError`.
- `app/api/interviews/route.ts` — POST (Zod `{processId?}`, `getSession`→agency+recruiter, envelope).

**Verde:** typecheck ✅ · `next build` ✅ (**15 rotas**, +/api/interviews) · web **18 testes** (+4 c/ DB: cria órfã+mock token, isolamento agency, unstructured→live→done idempotente, rejeita done→live) · Biome ✅.

**Code-review** (database-reviewer): 2 CRITICAL + 3 HIGH. **Aplicados:** C1 (recheck idempotente pós-CAS sob concorrência); M2 (removida aresta incoerente `scheduled→unstructured`); H3 (documentado token mock efémero). **Deferidos com critério (não-bloqueante):** C2 (try/catch no `getSession` — o shim não lança; tratamento uniforme de auth fica para a **FASE N**, evita inconsistência com as outras 14 rotas); H1/H2/M4 (CHECK constraints de `status`/`capture_type` + índices compostos `(agency_id,status)` — **endurecimento DB para a FASE N/migração**; a guarda `isStatus` na app já cobre o risco realista). M1 mantido: `status:string`+`isStatus` (validar-na-fronteira é mais seguro que confiar no tipo da DB).

**A fazer (FASE K):** TickEngine→`interview_tick` (escritor único + CAS, família G); `apps/ws` sai do stub (JWT mock + posse `SELECT 1 FROM interview`); `/api/interviews/:id/join` + `/:id/report`; resiliência pura (timeout/fallback/degradar/`interview_gap`/teto custo); reconexão WS replay; decisão do frame da resposta do chat ao vivo.

**Commit:** <hash>

---

## [2026-06-19 ~16:10] iteração 37 — ✅ FASE J COMPLETA (parte 3/3): casca Electron + hardening + distribuição

**Feito (`apps/desktop`):** a casca Electron que monta o HUD e o endurece (hardening R2):
- **`src/main/main.ts`** — entry: cria a `BrowserWindow` (via `buildOverlayWindowOptions` — sandbox/contextIsolation/nodeIntegration:false/webSecurity), `setAlwaysOnTop('screen-saver')`, `setVisibleOnAllWorkspaces`, **multi-monitor** (restaura/persiste posição por `display.id`), `setWindowOpenHandler`→deny, **`will-navigate`+`will-redirect`**→allowlist, **`app.enableSandbox()`** global, **`setPermissionRequestHandler`** nega mic/câmara/geo (v1 não capta áudio), CSP via `onHeadersReceived`, `openExternal` só http(s); IPC `vera:action`/`vera:end` validam **sender (file:)** + **payload Zod**. URLs públicas por env.
- **`src/main/security.ts`** (puro) `navigationDecision`/`withCspHeader`; **`src/main/windowState.ts`** (puro) `pickWindowPosition` (clamp/fallback) + read/write JSON.
- **`src/preload/preload.ts`** — `contextBridge` mínimo (`sendAction`/`onFrame`); **`src/shared/action.ts`** (Zod `veraAction`). **`src/main/tray.ts`**.
- **`src/renderer/index.html`** (CSP `<meta>` estrita) + **`src/renderer/main.tsx`** (monta o `Hud`, corre `playScript(goldenInterviewScript)`→reducer, cronómetro `Date.now`, chat-resposta MOCK local). **`electron-builder.yml`** (Win NSIS + macOS DMG; signing = handover). `globals.d.ts` (`*.css`).

**Verde:** typecheck ✅ (contra os tipos do `electron` — binário NÃO descarregado, `ELECTRON_SKIP_BINARY_DOWNLOAD=1`) · **desktop 44 testes** (hardening/nav/CSP, multi-monitor, schema IPC + render/reducer/player) · `pnpm -r test` = **193** · Biome ✅.

**Security-review** (security-reviewer): 2 CRITICAL + 5 HIGH **todos corrigidos** — `will-redirect` em falta (C1); `javascript:` negado estruturalmente (C2); `app.enableSandbox()` (H4); `setPermissionRequestHandler` nega mic/câmara (H5); IPC valida sender+payload Zod (H2/H3); `openExternal` só http(s) (M5); CSP `file:` documentada (H1). Checklist R2 = PASS.

> ⚠️ **Verificação honesta (headless):** não dá para LANÇAR o GUI Electron neste ambiente — provei tudo por **typecheck (tipos electron) + 44 testes (lógica pura/render/smoke do hardening)**. **Run local do Mateus (handover):** descarregar o binário electron (`pnpm rebuild electron` ou re-instalar sem `ELECTRON_SKIP_BINARY_DOWNLOAD`) + bundler do renderer/main (ex.: vite/esbuild → `dist-build/`) + `electron .`. Packaging assinado (Authenticode EV / Developer ID + notarização) = handover.

🎉 **FASE J ("a ESTRELA") COMPLETA** — overlay desktop demonstrável (lógica/render/hardening provados; feed MOCK).

**A fazer:** **FASE K** — orquestração da entrevista ao vivo (TickEngine↔TranscriptSource→interview_tick; ws sai do stub: JWT mock+posse; REST /api/interviews+/join+/:id/report; resiliência; reconexão WS replay; decidir o frame da resposta do chat ao vivo). Depois L/M/N.

**Commit:** <hash>

---

## [2026-06-19 ~15:50] iteração 36 — 🚧 FASE J (parte 2/3): HUD em React (overlay Tela 6) reutilizando `@rh/ui`

**Feito (`apps/desktop/src/renderer/hud/`):** o overlay que pinta o `HudState` (cérebro da parte 1) — **dark Apollo, reutiliza `@rh/ui`**:
- `Pill.tsx` — pílula compacta (~300×44, arrastável): estado num relance; sugestão em 1 linha (borda **teal só quando há sugestão**), contagem coberto/total, 🔴; clique→expande.
- `ExpandedPanel.tsx` — painel ~360px (Tela 6 completa): header 🔴+contexto+**cronómetro mm:ss**; PRÓXIMA PERGUNTA grande + 💡porquê + **Usei/Pular/★** (`@rh/ui` Button); fila; **ESTADO DOS REQUISITOS via `StateLight`** (semáforo 4 estados de `@rh/ui`); **rede de segurança** (alerts âmbar); **"silêncio é feature"** (sem sugestão → estado calmo, não inventa pergunta); chat ao vivo.
- `ChatPanel.tsx` — chat ao vivo (input + histórico por prop). `Hud.tsx` (raiz pílula↔painel). `format.ts` (formatElapsed/coverageCount). `player.ts` (`playScript` reproduz `goldenInterviewScript` com **scheduler injetável** + cancelador). `hud.css` (estilos do overlay + drag regions `-webkit-app-region`).

**Verde:** typecheck ✅ · **desktop 33 testes** (+9: pílula/painel render via `renderToStaticMarkup`, semáforo, chat, calmo; `playScript` com agendador falso; cronómetro) · `pnpm -r test` = **182** · Biome ✅ (a11y incl.).

**Code-review** (code-reviewer): **0 CRITICAL, 1 HIGH corrigido** (key da fila `pergunta`→`requisitoId`+composto); +MEDIUM (focus-ring WCAG no input do chat; cast do scheduler documentado); +LOW (emojis decorativos 💡/✅/⚠ com `aria-hidden`).

**⚠️ Nota de contrato (para FASE K):** o protocolo WS congelado de `@rh/core` **não tem frame de resposta do chat ao vivo**. Decisão: o chat é **local** (histórico por prop, fora do reducer — não inventei frame WS). Na FASE K, ao tirar o `ws` do stub, decidir como a resposta do chat volta (provável: reusar `alert` OU adicionar um frame — decisão a registar, não inventar agora).

**A fazer (fechar J):** parte 3/3 — Electron `main.ts` (BrowserWindow via `buildOverlayWindowOptions` + setAlwaysOnTop screen-saver + multi-monitor persist + setWindowOpenHandler deny + will-navigate allowlist + CSP nos headers da sessão), `preload.ts` (contextBridge mínimo), `tray.ts`, `index.html`+`main.tsx` (monta o `Hud` + corre o feed mock), `electron-builder.yml` (Win NSIS + macOS DMG), smoke do hardening. safeStorage (login bypass mock). encerramento→POST /api/interviews/:id/report.

**Commit:** <hash>

---

## [2026-06-19 ~15:35] iteração 35 — 🚧 FASE J (parte 1/3): núcleo puro do `apps/desktop` (hardening R2 + cérebro do overlay + feed mock)

> A FASE J (Electron + overlay HUD) é XL → partida em sub-fatias demonstráveis. Esta entrega o **núcleo puro e testável sem GUI** (não dá para abrir uma janela Electron neste ambiente headless; a verificação honesta é ao nível da lógica). As partes 2/3 (HUD React + Electron main/preload/tray) seguem.

**Feito (`apps/desktop`, novo package `desktop`):**
- **Hardening R2 (BLOQUEADOR de segurança — CONTRATO):**
  - `shared/windowConfig.ts` `buildOverlayWindowOptions()` — opções da `BrowserWindow` do overlay: `frame:false`/`transparent`/`alwaysOnTop`/`skipTaskbar`/`focusable:false` + `webPreferences` **sandbox:true · contextIsolation:true · nodeIntegration:false · webSecurity:true**. `ALWAYS_ON_TOP_LEVEL="screen-saver"`.
  - `shared/csp.ts` `buildCsp()` — CSP estrita (`script-src 'self'`, `object-src/base-uri/frame-ancestors 'none'`, `img-src 'self'`); `connect-src` recebe a origem do WS por config.
  - `shared/navigation.ts` `isAllowedNavigationUrl()` — allowlist de navegação; nega `blob:`/`data:`/`javascript:` e credenciais embebidas; só `file:`+origens permitidas.
- **Cérebro do overlay (puro, imutável):** `overlay/reducer.ts` `hudReduce(state, action)` — aplica o protocolo WS **congelado** de `@rh/core` (auth.ok/tick.update/suggestion.next/coverage.update/alert/interview.active/job.*) ao `HudState` (semáforo 4 estados, sugestão+porquê, fila, rede de segurança, gravação 🔴). **Auto-dismiss** da sugestão coberta + promoção da fila; **proteção de replay** (descarta seq repetido/fora de ordem); `derivePorque` deriva do estado real (não inventa). `overlay/types.ts`.
- **Feed mock (`overlay/mockFeed.ts`):** `goldenInterviewFrames()`/`goldenInterviewScript()` — "entrevista golden" guionada, frames validados por `serverMessage`. Substituível pelo WS real só com a chave.

**Verde:** typecheck ✅ · **desktop 24 testes** (hardening R2 asserido; reducer; **feed golden → reducer prova sugestão→semáforo→auto-dismiss→rede de segurança**) · `pnpm -r test` = **173** · Biome limpo.

**Code-review** (code-reviewer): **0 CRITICAL, 3 HIGH — todos corrigidos:** (1) `isAllowedNavigationUrl` bypass via `blob:`/`data:` → guard + testes; (2) `applyCoverage` copy-then-mutate → reescrito 100% imutável; (3) `seq` fora de ordem revertia estado → drop de frames antigos (replay). +MEDIUM `img-src data:` removido; +test fidelity (`serverMessage.parse` no helper).

**A fazer (fechar J):** parte 2 — HUD React (pílula↔expandido, reusa `@rh/ui`: sugestão+porquê, fila, `StateLight`, cronómetro, 🔴, Usei/Pular/★, chat ao vivo, rede de segurança) + player do feed mock. parte 3 — Electron `main`/`preload`(contextBridge)/`tray` + `electron-builder` Win/macOS + smoke do hardening. Depois K/L/M/N.

**Commit:** <hash>

---

## [2026-06-19 ~15:10] iteração 34 — ✅ FASE I COMPLETA: design system Apollo + `@rh/ui` + shell web dark

> **Nova branch de build:** `phase3/product` (criada de `phase3/build`; merge via PR no fim — o `phase3/build` não foi tocado). Início do build do PRODUTO (Fases I–N do `PLANO-CONCLUSAO-V1.md`).

**Feito (2 sub-fatias):**
- **`packages/ui` (`@rh/ui`)** — biblioteca de componentes partilhada (web ↔ futuro desktop Electron), **sem dependência de Tailwind** (classes `.vera-*` portáveis):
  - `styles/tokens.css` — **fonte única** dos tokens dark "Apollo" (`--vera-*`: superfícies `#0E1116`/`#11151B`/`#161B22`, acento teal `#5DCAA5`, semáforo, raios, Inter). Flat (sem gradiente/sombra/blur).
  - `styles/ui.css` — classes de componente + `.sr-only`.
  - 10 componentes tipados: `Button` (variant/size, type=button), `Card`, `Field`+`Input`/`Textarea`/`Select`, `Tabs` (controlado), `Modal` (presentational, `useId`+`aria-labelledby`), `Chip`, **`StateLight`** (semáforo: reusa `RequisitoStatus` de `@rh/core` — `Record` exaustivo em compile-time; estado canónico sempre exposto a leitores de ecrã), `Skeleton`, `EmptyState`, `ErrorRetry`. `cx()` util. Barrel `index.ts`.
- **Integração web (`apps/web`)** — fim do tema branco/violeta:
  - `globals.css` — `@import tailwindcss` + `@theme` mapeia `--vera-*` → utilitários semânticos (`bg-surface`/`text-ink`/`border-line`/`rounded-card`…); `body` dark + `color-scheme: dark`.
  - `layout.tsx` importa `tokens.css`+`ui.css`+`globals.css`; shell dark + `NavBar` (client; `usePathname` → contexto ativo `aria-current` + breadcrumb).
  - Re-skin: `page.tsx` (home), `clientes`/`vagas`/`candidatos` (dark + `EmptyState`), `CreateForm` (refactor → `@rh/ui`). **3 estados UX** ligados: `EmptyState` (vazio), `loading.tsx` (Skeleton), `error.tsx` (ErrorRetry).
  - `next.config` transpila `@rh/ui`; `biome.json` exclui `globals.css` (parser CSS do Biome não suporta `@theme` do Tailwind v4).

**Verde:** typecheck (ui+web) ✅ · `next build` ✅ (CSS compilado contém `--vera-bg-base`, `.vera-*`, body dark, chip `color-mix`) · **`pnpm -r test` = 149** (ui **16** novos · core 37 · db 28 · ai 35 · ws 11 · knowledge 5 · realtime 2 · intake-bots 1 · web 14) · Biome limpo.

**Code-review** (code-reviewer): **0 CRITICAL, 3 HIGH — todos corrigidos:** (1) `Modal` `aria-labelledby`+`useId`; (2) `Chip` shallow/alert ganham fundo semântico (`color-mix`); (3) `StateLight` expõe sempre o estado canónico a AT (não só sem label). +MEDIUM: `Field`/`CreateForm` removida a dupla-associação `htmlFor`/`id` (associação implícita via `<label>`).

**Dívida v1 documentada (não-bloqueante, do review):** `Modal` sem focus-trap; `Tabs` sem tríade `aria-controls`/`role=tabpanel` (presentational — o pai põe o painel); `EmptyState` usa `<p>` no título.

**A fazer:** **FASE J** — `apps/desktop` Electron + overlay HUD (hardening R2; feed WS MOCK; reusa `@rh/ui`). Depois K/L/M/N.

**Commit:** <hash>

---

## [2026-06-19 ~13:14] iteração 33 — ✅ FASE H COMPLETA: auth/sessão — 🏁 BUILD C–H COMPLETO

**Feito:** `apps/web/lib/session.ts` `getSession()` → `{agencyId, recruiterId}` (lê cookies `vera_agency`/`vera_recruiter`; senão o seed fixo IRIS/Filipa). **Refactor:** todos os **10 routes + 3 pages** passam a obter a identidade do shim (`DEV_AGENCY_ID` agora só em `db.ts`+`session.ts`); as libs continuam a receber `agencyId` por parâmetro (testes intactos). TODO(KEYS): `@supabase/ssr` (Auth) — login email/senha OU biometria (`services/face`). KEYS-TODO atualizado.

**Verde:** typecheck ✅ · `next build` ✅ · **`pnpm -r test` TODO verde** (core 37 · db 25 · ai 35 · ws 11 · knowledge 3 · realtime 2 · intake-bots 1 · web 14 c/DB) · Biome ✅.

---

# 🏁 RESUMO FINAL — Vera Fase 3 (build C–H completo, ~34 commits)

**O produto está construído de ponta a ponta, tudo a correr com MOCKS (zero chaves, zero custo).** Falta só o Mateus ligar as chaves (`KEYS-TODO.md`) para trocar cada mock pelo adapter real.

- **Fundação+DB:** monorepo pnpm (Biome, TS strict, Vitest), 35 tabelas canónicas (Drizzle+pgvector) vivas na DB `vera_dev` :5433 (migração+seed+GUC tenant).
- **Cérebro `@rh/ai`:** slots EXTRACTOR/ARCHITECT/LIVE + gate ZDR + `generate` (Zod) + 8 features (extract vaga/CV, intake, rubric/roleProfile/briefing, match, tick, parecer) + mock transport.
- **RAG `@rh/knowledge`:** pgvector + embedder mock (cosine).
- **C — "Antes":** `apps/web` (clientes/vagas/candidatos/match/briefing) + UI navegável.
- **D — "Durante":** `@rh/realtime` TickEngine (transcrição→EstadoVivo→frames WS).
- **E — "Depois":** parecer+export md, destilar→RAG, calibração (client_verdict).
- **F — Ingestão:** intake (classifica→confirma→cria) + `@rh/intake-bots` (Telegram/WhatsApp stub).
- **G — Serviços Python:** `services/agent` + `services/face` FastAPI esqueleto (contrato + 501).
- **H — Auth:** shim de sessão (single-tenant IRIS) + refactor.

**Pendente (só Mateus, no fim):** ligar chaves — OpenRouter (LLM), Embedder, Exa/Brave, LiveKit+Soniox, Telegram/WhatsApp, Resend, Google/Apify, Supabase Auth. Ver `KEYS-TODO.md`. Implementar a lógica real dos serviços Python (incl. flash liveness, após o bug do cmtec-face).

---

## [2026-06-19 ~13:06] iteração 32 — ✅ FASE G COMPLETA: serviços Python (FastAPI esqueleto)

**Feito:** dois serviços FastAPI (só contrato; lógica depois):
- `services/agent/` (assistente proativo): `/health` ✅ + `POST /proactive/suggest` e `/sourcing/search` em **501** (GOOGLE_OAUTH/APIFY, KEYS-TODO). pydantic models + README com contrato HTTP.
- `services/face/` (biometria): `/health` ✅ + `POST /enroll` e `/verify` em **501**. **TODO duro: flash liveness é trabalho real; clonar do cmtec-face só após resolver o bug de enroll** (MEMORY `project_cmtec_face_enroll_bug`). README + contrato.

**Verde:** **pytest agent 3/3 + face 3/3** (Python 3.14, FastAPI 0.136) · **ruff limpo**. Zero segredos, zero chamadas externas.

🎉 **FASE G COMPLETA.** **Falta só H (auth).**

**Commit:** <hash>

---

## [2026-06-19 ~13:00] iteração 31 — ✅ FASE F COMPLETA: bots stub (`@rh/intake-bots`)

**Feito:** novo package `@rh/intake-bots`:
- `source.ts` — `MessageSource` interface + `IntakeBotMessage` ({source, externalId, text}) + `createManualMessageSource` (push manual; real = Telegram/WhatsApp c/ chave, inerte).
- `bridge.ts` — `runIntakeBridge(source, onMessage)` liga a fonte ao handler de ingestão (a app fecha o circuito com `ingerirMensagem`); fire-and-forget; devolve cancelamento.

**Verde:** typecheck ✅ · **1/1 teste** (entrega + cancelamento) · Biome ✅. Tudo mock — zero custo.

🎉 **FASE F ("Ingestão") COMPLETA** — intake tipado (classifica→confirma→cria) + fonte de bots reutilizável.

**A fazer:** G services Python (FastAPI esqueleto + contrato) · H auth (Supabase local + ws + substituir DEV ids). **2 fases para o fim.**

**Commit:** <hash>

---

## [2026-06-19 ~12:56] iteração 30 — Fase F1+F2: ingestão (intake classifica→confirma→cria)

**Feito:**
- `@rh/ai/features/intake.ts` `classifyIntake(text, opts)` → `intakeEnvelope` (alvo/intenção/conteúdo; slot EXTRACTOR; alvoId sempre null = não adivinha). Exportado no index.
- `apps/web/lib/intake.ts`: `ingerirMensagem` (classifica stub → grava `intake_message` por confirmar, `confirmed_at` NULL) + `confirmarIntake` ('pergunta' não grava; 'novo_candidato' cria candidato via `createCandidato`; outras intenções marcam confirmado sem criar até resolver alvo de sessão; idempotente).
- Routes `/api/intake` (POST ingest) + `/api/intake/confirm` (POST).

**Verde:** typecheck (ai+web) ✅ · `next build` ✅ (**14 rotas API**) · `@rh/ai` **35 testes** (+intake) · web **14 testes** (+intake integração: ingere→confirma cria candidato, idempotente) · Biome ✅.

**A fazer (fechar F):** F3 bots stub (`MessageSource` Telegram/WhatsApp mock → `ingerirMensagem`). Depois G services Python, H auth.

**Commit:** <hash>

---

## [2026-06-19 ~12:48] iteração 29 — ✅ FASE E COMPLETA: destilar→RAG + calibração

**Feito:** `apps/web`:
- `lib/embedder.ts` `getEmbedder()` — factory (mock determinístico até à chave `EMBEDDER_API_KEY`; €0).
- `lib/destilar.ts` `destilarFacto` — persiste `candidate_memory_fact` + `indexCandidateFact` (RAG pgvector). Route `/api/destilar`.
- `lib/verdict.ts` `registarVerdict` — insere `client_verdict` (ground-truth da calibração: veredito do cliente × `bot_predicted`). Route `/api/verdict`.

**Verde:** typecheck ✅ · `next build` ✅ (**12 rotas API**) · **13/13 testes web** (+destilar: RAG devolve o facto mais próximo da query, isolado por agency; +verdict: grava+lê) · Biome ✅.

🎉 **FASE E ("Depois") COMPLETA** — parecer+export, memória RAG durável, calibração. KEYS-TODO atualizado (OpenRouter 🟡 inerte; Embedder mock ativo).

**A fazer:** F ingestão (intake + bots stub) · G services Python · H auth.

**Commit:** <hash>

---

## [2026-06-19 ~12:42] iteração 28 — Fase E1: parecer ("Depois") + export markdown

**Feito:** `apps/web/lib/parecer.ts`:
- `renderParecerMd(name, Parecer)` — render markdown determinístico e PURO (7 secções + credenciais + fiabilidade; honesto em secções vazias).
- `gerarParecer(db, agencyId, {interviewId})` — lê entrevista → processo → candidato + `candidate_memory_fact` → `buildParecer` (stub sem chave) → renderiza → **persiste `report`** (interview_id UNIQUE, `onConflictDoUpdate`, status 'ready'). Devolve {reportId, parecer, contentMd}.
- `getParecerMd` — export do markdown guardado.
- Route `app/api/parecer/route.ts`: **POST** gera/regera · **GET** `?interviewId=` exporta `.md` (Content-Disposition; PDF=TODO pós-chave).

**Verde:** typecheck ✅ · `next build` ✅ (**10 rotas**) · **11/11 testes web** (+parecer-md unit, +parecer integração idempotente vs DB) · Biome ✅.

**A fazer (fechar E):** destilar factos→RAG (`lib/destilar.ts` + `indexCandidateFact`) · calibração `lib/verdict.ts` (client_verdict). Depois F/G/H.

**Commit:** <hash>

---

## [2026-06-19 ~12:32] iteração 27 — Fase D: copiloto ao vivo (`@rh/realtime` TickEngine)

**Feito:** novo package `@rh/realtime` (dep @rh/core+@rh/ai+@rh/ws):
- `source.ts` — `TranscriptSource` interface + `createManualTranscriptSource` (push manual; real = LiveKit+Soniox c/ chave; diarização Soniox = trabalho NOVO, stub).
- `engine.ts` — **`TickEngine`**: acumula janela (cap `maxWindow`), dispara um tick a cada `windowSize` falas do candidato → `runTick` (mock) → EstadoVivo+sugestão via `onTick`; mantém `estadoAnterior`. `attach(source)`.
- `frames.ts` — `tickToFramePayloads` → `tick.update`+`suggestion.next` (o `apps/ws` injeta v+seq).

**Verde:** typecheck ✅ · **2/2 testes** (tick dispara no Nº de falas + produz EstadoVivo; frames com seq via FrameSession) · Biome ✅. Tudo mock — zero custo.

**A fazer:** E parecer/export/RAG/calibração · F ingestão · G services Python · H auth. (Falta wiring real do servidor realtime — só com LiveKit/Soniox chave.)

**Commit:** <hash>

---

## [2026-06-19 ~12:27] iteração 26 — ✅ FASE C COMPLETA: UI mínima ("Antes" navegável)

**Feito:** `apps/web` UI: `layout.tsx` (nav Vera/Clientes/Vagas/Candidatos) + `page.tsx` (home cards) + `components/CreateForm.tsx` (client, genérico text/textarea/**select**, POST→`router.refresh`) + páginas server-component `/clientes` `/vagas` `/candidatos` (listam da DB + form criar; vagas tem select de clientes). Tailwind v4 sóbrio.

**Verde:** typecheck ✅ · `next build` ✅ (**9 rotas**: 3 pages + 6 API, todas dynamic) · Biome ✅.

🎉 **FASE C ("Antes") COMPLETA com ecrãs** — a Filipa pode (no demo, sem chave): criar cliente → abrir vaga (extrai requisitos) → adicionar candidato (extrai CV) → /api/match → /api/briefing, tudo contra a DB real.

**A fazer:** D realtime (copiloto ao vivo) · E parecer/memória · F ingestão · G services · H auth.

**Commit:** (UI=2cdc7e6; este log no próximo)

---

## [2026-06-19 ~12:21] iteração 25 — Fase C5: briefing (rubric→briefing) — fluxo "Antes" completo (lógica)

**Feito:** `apps/web/lib/briefing.ts` `generateBriefing` — `buildRubric` (atribui requisitoId §16F) → **persiste `rubric`** (job_id UNIQUE) → `buildBriefing` ligado aos ids da rubric → devolve {rubric, briefing}. Route `app/api/briefing/route.ts` POST {jobId}.

**Verde:** typecheck ✅ · `next build` ✅ (**6 rotas API**) · **8/8 testes web** com DB (+briefing: rubric c/ id + persistida + briefing) · Biome ✅.

🎉 **Fluxo "Antes" completo (lógica):** cliente → vaga(extrai) → candidato(extrai CV) → match → briefing. Tudo contra a DB real, cérebro com stub sem chave.

**A fazer (fechar C):** **UI mínima** (pages server-component + form client). Depois D realtime.

**Commit:** <hash>

---

## [2026-06-19 ~12:16] iteração 24 — Fase C4: match candidato×vaga (process + matchCandidate)

**Feito:** `apps/web/lib/match.ts` `matchCandidatoVaga` — garante o `process` (candidatura, UNIQUE candidate×job, idempotente) + lê candidato/vaga + corre `matchCandidate` (stub sem chave) + devolve `{processId, match}`. Route `app/api/match/route.ts` POST. (roleProfile vazio até o carril knowledge o preencher.)

**Verde:** typecheck ✅ · `next build` ✅ (5 rotas API) · **7/7 testes web** com DB (+2 match: cria process+MatchResult; idempotência do process) · Biome (115 fich.) ✅.

**A fazer (fechar C):** briefing (buildRubric→guarda rubric→buildBriefing) + **UI mínima** (pages).

**Commit:** <hash>

---

## [2026-06-19 ~12:11] iteração 23 — Fase C3: candidatos (CRUD + extração de CV)

**Feito:** `apps/web/lib/candidatos.ts` (`createCandidato` extrai perfil do CV via `extractCandidateProfile`+aiOptions, `nameNormalized` p/ dedup §12, insere `candidate`; `listCandidatos`) + `app/api/candidatos/route.ts` (GET+POST).

**Verde:** typecheck ✅ · `next build` ✅ (4 rotas: clientes/vagas/candidatos/health) · **5/5 testes web** com DB · Biome (112 fich.) ✅.

**A fazer (resto C):** match (`process` candidate×job + `matchCandidate`) + briefing (buildRubric→buildBriefing) routes/lib; **UI mínima** (pages).

**Commit:** <hash>

---

## [2026-06-19 ~12:05] iteração 22 — Fase C2: `aiOptions` (real-ou-stub) + vagas com extração

**Feito:**
- `apps/web/lib/ai.ts` — **`aiOptions(stub)`**: com `OPENROUTER_API_KEY` → transporte OpenRouter real (registry/fallback dos `MODEL_*` env, zdr:true placeholder); **sem chave → stub determinístico** que a rota fornece (demo sem custo). `AI_ENABLED` flag. **Ponto único de troca mock→real.**
- `apps/web/lib/vagas.ts` — `createVaga` (extrai requisitos via `extractJobRequirements` + `aiOptions`; insere `job` c/ requirements JSONB + roleType) + `listVagas`. `DEV_RECRUITER_ID` (Filipa seed).
- `app/api/vagas/route.ts` — GET+POST (Zod, envelope).

**Verde:** typecheck ✅ · `next build` ✅ (`/api/vagas`) · **4/4 testes web** com DB (clientes + aiOptions-stub + criar/listar vaga c/ extração) · Biome (109 fich.) ✅.

**A fazer (resto C):** candidatos (+CV extração) + match + briefing routes/lib; UI mínima (pages).

**Commit:** <hash>

---

## [2026-06-19 ~11:55] iteração 21 — Fase C1: `apps/web` ligado à DB (clientes CRUD)

**Mateus: "faz tudo, continua o /loop até ao fim" — loop retomado.**

**Feito:** `apps/web` ↔ DB viva:
- `lib/db.ts` — `getDb()` singleton (lazy; `DATABASE_URL` do env, nunca hardcoded) + `DEV_AGENCY_ID` (= agência IRIS do seed; substituído pela auth na Fase H).
- `lib/clientes.ts` — `createCliente`/`listClientes` (lógica testável; `agency_id` predicado §15.1).
- `app/api/clientes/route.ts` — GET (lista) + POST (cria, valida Zod, envelope `ok`/`err`).
- next.config `transpilePackages` += @rh/db/@rh/ai/@rh/knowledge; +dep `drizzle-orm` (direta).

**Verde:** typecheck ✅ · **`next build` ✅** (`/api/clientes` dynamic; @rh/db/pg compila no app) · **2/2 testes web** com DB (cria/lista/isola por agência) · Biome (104 fich.) ✅.

**A fazer (resto Fase C):** vagas (+extração via @rh/ai) + candidatos (+CV) + match + briefing routes/lib; UI mínima (forms/listas). AI routes usam transporte real se `OPENROUTER_API_KEY`, senão stub demo (sem chaves).

**Commit:** <hash>

---

## [2026-06-19 ~11:49] iteração 20 — Fase B: `@rh/knowledge` RAG pgvector (embedder mock)

**Feito:** novo package `@rh/knowledge` (dep @rh/core+@rh/db+drizzle):
- `embedder.ts` — interface `Embedder` + **`mockEmbedder`** determinístico (LCG semeado pelo hash do texto → vetor dim 1536 normalizado; mesmo texto→mesmo vetor). Real (OpenAI) entra com a chave.
- `rag.ts` — `indexCandidateFact` (embed+insert em `candidate_memory_embedding`) + `searchCandidateFacts` (cosine `<=>` na DB, **sempre filtrado por agency_id+candidate_id** §15.1).

**Verde:** typecheck ✅ · sem DB 3 pass + 2 skip · **com DB real: 5/5** ✅ (indexa→recupera por cosine dist≈0; isolamento por agency confirmado) · Biome (99 fich.) ✅. RAG real a correr contra pgvector.

**A fazer (resto Fase B):** `SearchProvider` (Exa/Brave) interface+mock → alimenta `buildRoleProfile`; `source_doc` ciclo de pesquisa; RAG de cliente/recruiter (mesma mecânica).

**Commit:** <hash>

---

## [2026-06-19 ~11:41] iteração 19 — ✅ FASE A COMPLETA (cérebro): RoleProfile + briefing + tick ao vivo

**Feito:**
- `@rh/core/src/briefing.ts` — shape `briefing` (P1.5: perguntas[{pergunta, lente, boaResposta, requisitoId}]).
- `@rh/ai/src/features/prepare.ts` — `buildRoleProfile` (P1.2 → `RoleProfile`) + `buildBriefing` (P1.5 → `Briefing`; §16F: requisitoId fora da rubric → anulado).
- `@rh/ai/src/features/live.ts` — **`runTick`** (P2.3 → `EstadoVivo`+`Suggestion`; **fail-safe §16F**: descarta requisitos com id fora da rubric, anula suggestion.requisitoId desconhecido).

**🧠 Cérebro completo** (7 features, slot certo por tarefa): `extractJobRequirements`/`extractCandidateProfile` (EXTRACTOR) · `buildRoleProfile`/`buildRubric`/`matchCandidate`/`buildBriefing`/`buildParecer` (ARCHITECT) · `runTick` (LIVE). Todas via `generate` (Zod-validado, 1 retry) + `runSlot` (ZDR+fallback) + **mock** (zero chamadas pagas).

**Verde:** typecheck ✅ · core **37/37** · ai **34/34** · Biome (91 fich.) ✅.

**Próximo (Fase B):** `packages/knowledge` — search Exa/Brave (interface+mock) + **RAG pgvector** (embedder mock) contra a DB viva.

**Commit:** <hash>

---

## [2026-06-19 ~11:36] iteração 18 — Fase A: extração (vaga + CV)

**Feito:**
- `@rh/core/src/extraction.ts` — shapes `jobRequirements` (P1.1: roleType/nivel/skills{must,nice}/contexto) + `candidateProfile` (P1.3: skillsDeclaradas/experienciaAnos/gapsCv/resumo). *(A spec descreve em prosa; fixei a forma Zod — registado.)*
- `@rh/ai/src/features/extract.ts` — `extractJobRequirements` + `extractCandidateProfile` (slot EXTRACTOR, via `generate` + mock).

**Verde:** typecheck ✅ · core **35/35** (+4) · ai **30/30** (+2) · Biome ✅. Tudo mock.

**A fazer (resto da Fase A):** `buildRoleProfile`, `buildBriefing` (+shape `briefing`), `runTick` (EstadoVivo, keia por requisitoId dados no input).

**Commit:** <hash>

---

## [2026-06-19 ~11:32] iteração 17 — Fase A (cérebro): features `matchCandidate`/`buildParecer`/`buildRubric`

**Feito:** primeiras features de IA em `@rh/ai/src/features/` (slot ARCHITECT, via `generate` + mock):
- `judge.ts` — `matchCandidate` (P1.4 → `MatchResult`) + `buildParecer` (P3.1 → `Parecer`, prompt encoda as regras anti-achismo do RELATORIO §3: critério não-coberto assinala-se, inconsistências c/ dois lados sem acusar, credenciais por documento, não-capturado).
- `prepare.ts` — `buildRubric` (P1.5 → `Rubric`): **padrão §16F** — o LLM gera o CONTEÚDO dos critérios (schema = `rubricCriterion.omit({requisitoId})`), o **SISTEMA atribui o `requisitoId` canónico** (`randomUUID`), nunca o modelo.
- `@rh/core` adicionado como dep de `@rh/ai`.

**Verde:** typecheck ✅ · **28/28 testes @rh/ai** (+5: match válido/inválido, parecer, rubric id-atribuído/ids-distintos) · Biome (82 fich.) ✅. Tudo com transporte **mock** — zero chamadas pagas.

**A fazer (resto da Fase A):** `extractJobRequirements`/`extractCandidateProfile` (precisam de shapes novos em `@rh/core`), `buildRoleProfile` (estrutura), `buildBriefing` (+shape briefing), `runTick` (EstadoVivo, keia por requisitoId).

**Commit:** <hash>

---

## [2026-06-19 ~11:25] iteração 16 — `@rh/ai` `generate` + infra mock (base das features, SEM chaves)

**Novo mandato (Mateus):** construir o **produto** o mais completo possível **sem chaves** (mocks atrás de interfaces); deixar `KEYS-TODO.md` para o wiring final. ZERO chamadas pagas. Fluxo decidido: A `@rh/ai` features → B `knowledge` (RAG) → C `apps/web` "Antes" → D realtime "Durante" → E "Depois" → F ingestão → G services → H auth.

**Feito:**
- **`KEYS-TODO.md`** (raiz) — tabela de cada serviço externo, env var, onde liga, o que ativa, estado.
- **`generate(slot, prompt, schema, opts)`** em `@rh/ai` — chama o slot, extrai JSON (tolera ```fences```), valida contra Zod, **1 retry** com erro realimentado; reusa `runSlot` (ZDR + fallback). É a base de TODAS as features de IA.
- **`mock.ts`** — `MOCK_MODEL`/`mockRegistry`/`mockFallback`/`mockTransport`/`mockRunSlotOptions`: corre o cérebro sem chaves; troca-se pelo transporte real quando o `OPENROUTER_API_KEY` chegar.

**Verde:** typecheck ✅ · **23/23 testes @rh/ai** (+4 generate: válido à 1ª, fences, retry, GenerateParseError) · Biome ✅.

**Commit:** <hash>

---

## [2026-06-19 ~11:06] iteração 15 — `docker-compose.dev.yml` (dev DB reprodutível) ✅ desbloqueado

**Feito:** `docker-compose.dev.yml` (infra mínima: **Postgres pgvector + Redis**, volumes nomeados, bind 127.0.0.1, password via env com default de dev, healthcheck). Substitui o container ad-hoc por uma stack reprodutível (`name: vera`). Os serviços de app entram aqui à medida que ficam prontos.

**Validado end-to-end:** `docker compose config` ✅ · `up -d` → `vera-db-1`+`vera-redis-1` healthy em ~3s ✅ · `db:migrate` → 35 tabelas ✅ · `db:seed` → IRIS+Filipa/Inês ✅ · **28/28 testes de integração vs a compose DB** ✅ · Biome ✅. Receita: `docker compose -f docker-compose.dev.yml up -d` + migrate + seed (no header do ficheiro).

**Commit:** <hash>

---

## [2026-06-19 ~11:05] iteração 14 — `seeds` (IRIS + Filipa/Inês + cliente/vaga/candidato)

**Feito:** `packages/db/src/seed.ts` + CLI `seed.cli.ts` (`db:seed` script, dep `tsx`):
- Seed de dev (INFRA-E-MIGRACAO §8): agência **IRIS Tech** + recrutadoras **Filipa/Inês** + 1 cliente (TechCorp demo) + 1 vaga (Dev Frontend React Pleno) + 1 candidato (João) + o **`process`** que liga candidato↔vaga. UUIDs fixos + `onConflictDoNothing` → **idempotente**.
- `DATABASE_URL` nunca hardcoded (CLI lê de env; lança se faltar).

**Verde:** typecheck ✅ · sem DB 25 pass + 3 skip · **com DB real: 28/28** ✅ (teste de integração corre o seed 2× e confirma agência/recrutadoras/process + FK integrity) · CLI `db:seed` corre OK · DB confere `agency=1, recruiter=2, process=1` após 3 execuções (idempotência provada) · Biome ✅.

**Reproduzir o dev DB:** `docker run -d --name vera-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vera_dev -p 127.0.0.1:5433:5432 pgvector/pgvector:pg16` → `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev pnpm --filter @rh/db db:migrate && pnpm --filter @rh/db db:seed`.

**Commit:** <hash>

---

## [2026-06-19 ~11:00] iteração 13 — Docker resolvido → migração APLICADA a Postgres real + `createDb`

**🔓 Spike #1 do RESUMO RESOLVIDO.** O Mateus corrigiu o Docker (crash-loop do Gordon AI: `EnableDockerAI=true` + socket `dockerInference` reparse-point WSL2 stale → matar procs + `wsl --shutdown` + renomear `run/` + `EnableDockerAI:false`; ver `feedback_docker_ai_socket_bug_2026_06_19`).

**Feito:**
- **Migração aplicada a um Postgres real** (pgvector pg16, container próprio isolado `vera-postgres` :5433) via **`drizzle-kit migrate`** (caminho da spec). **Verificação exaustiva no DB real:** 35 tabelas ✅ · `vector` 0.8.2 ✅ · `interview` só com `process_id` (sem job_id/candidate_id, nullable=órfã) ✅ · `candidate_memory_embedding.embedding`=`vector(1536)` ✅ · **58 FKs** ✅ · 4 CHECK nomeados (B/16C/L) ✅ · 4 índices ivfflat ✅ · journal drizzle=1 ✅. O schema deixou de ser só introspeção — **aplica-se limpo a Postgres real**.
- **`createDb(connectionString)`** em `@rh/db` (driver `pg` + Drizzle, `DATABASE_URL` nunca hardcoded) → `DbHandle{db,close}`; `db` satisfaz `TransactionalDb` (usar com `withAgencySession`).
- **Teste de integração GATED** (`TEST_DATABASE_URL`): sem DB salta (CI verde); com DB **prova o GUC end-to-end** — `withAgencySession` fixa `app.agency_id` na transação e o valor é vazio fora dela (local-à-transação).

**Verde:** typecheck ✅ · sem DB: 25 pass + 2 skip · **com DB real: 27/27** ✅ · Biome ✅. Container reprodutível: `docker run -d --name vera-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vera_dev -p 127.0.0.1:5433:5432 pgvector/pgvector:pg16` → `drizzle-kit migrate`.

**Próximo (agora desbloqueado):** `seeds` (IRIS+Filipa/Inês+cliente/vaga/candidato) · `docker-compose.dev.yml` (Docker funciona → já validável) · carris knowledge/realtime.

**Commit:** <hash>

---

## 🏁 RESUMO DA NOITE (STOP FINAL — 2026-06-19 ~02:50, ~1h20 de loop)

> ⏩ **ATUALIZAÇÃO 2026-06-19 ~11:00 (Docker resolvido):** os spikes #1 e #2 abaixo (DB viva)
> ficaram **RESOLVIDOS** — ver iterações 13–15 no topo. Migração aplicada a Postgres real,
> `createDb`, seeds e `docker-compose.dev.yml` validados end-to-end (15 commits, 86 unit + 3 integração).

**12 commits em `phase3/build` (pushed), monorepo todo verde — 86 testes, typecheck/Biome limpos.** Camada de contratos + fundação testável da P0.1 **completa**.

**Construído (todos verdes, com TDD + code-review):**
- **`@rh/db`** — schema Drizzle das **35 tabelas** na forma canónica FINAL (famílias A–M), migração `0000_init.sql` (+pgvector), contrato GUC `withAgencySession` (isolamento de tenant). 25 testes.
- **`@rh/core`** — contratos: envelope `ApiResponse`, protocolo WS (frames+fiabilidade seq/ack, close 44xx), 22 enums canónicos, paginação, idempotência, skill (J); **AI shapes completos**: EstadoVivo/Suggestion (frame §9), RoleProfile/Rubric, MatchResult, IntakeEnvelope, Parecer. 31 testes.
- **`@rh/ai`** — registry de modelos + **gate ZDR fail-closed** (§3/§7), runner com **fallback por slot** (§5, salta não-ZDR), transporte OpenRouter (status→transient/permanent). 19 testes.
- **`apps/web`** — Next.js 15 (App Router, Tailwind v4) a compilar; `/api/health` consome `@rh/core`. (standalone gated por env p/ Linux.)
- **`apps/ws`** — codec de frames + **servidor WS real** com handshake auth (close 4401/4403). 11 testes.

**⏳ SPIKES / PENDENTE para o Mateus (por ordem):**
1. **Docker Desktop está DOWN nesta máquina** → bloqueou TODA a camada de DB viva. Quando ligares o Docker: `supabase start` (Postgres+pgvector+Auth+Storage local) + aplicar `packages/db/migrations/0000_init.sql` (ou `drizzle-kit migrate`). A migração está validada por `drizzle-kit generate` + 25 testes de introspeção, mas **ainda não foi aplicada a um Postgres real**.
2. Depois do Docker: `createDb` real (driver `pg`), `docker-compose.dev.yml` (web/ws/realtime/agent/face/redis), `seeds` (1 agência IRIS + Filipa/Inês + 1 cliente/vaga/candidato), mocks Soniox/OpenRouter/LiveKit.
3. **Não construído ainda** (carris seguintes): `packages/knowledge` (RAG pgvector — DB-gated), `apps/realtime` (LiveKit+Soniox), `apps/bot` (Telegram/WhatsApp), `apps/desktop` (Electron overlay), `services/agent`+`services/face` (Python, vendorizar clones REUSE-MAP). Supabase Auth real (o WS usa hook injetável stub). WS replay-on-reconnect (fonte = interview_tick, DB-gated).

**Como retomar:** `git checkout phase3/build` → `pnpm install` → `pnpm -r test` (deve dar 86 verdes). Próxima fatia natural assim que o Docker estiver up: aplicar a migração + `createDb` + seeds (desbloqueia o carril "antes": vaga→RoleProfile→briefing).

---

## [2026-06-19 ~02:50] iteração 12 — `@rh/ai`: transporte OpenRouter (status→falha)

**Feito:** `packages/ai/src/transport.ts` — `createOpenRouterTransport({apiKey, baseUrl?, fetchImpl?})` (chave via `process.env`, NUNCA hardcoded; `fetchImpl` injetável p/ testes). POST a `/chat/completions`, valida a resposta (Zod), mapeia HTTP → falha que o `runSlot` entende: **429/5xx/rede → `transient`** (desce na lista, §5); **4xx≠429 → `permanent`**; formato inesperado → `permanent`.

**Verde:** typecheck ✅ · **19/19 testes @rh/ai** (+6 transport, fetch mockado — sucesso, 429/500/503 transient, 400 permanent, rede transient, malformado permanent) · `pnpm -r test` = **86 verdes** · Biome (71 fich.) ✅. Zero chamadas de rede reais.

**Commit:** <hash>

---

## [2026-06-19 ~02:47] iteração 11 — `@rh/ai`: runner com fallback por slot (§5)

**Feito:** `packages/ai/src/runner.ts` + refactor `registry.ts`:
- Extraído `modelIssuesForSlot(model, slot)` (DRY entre `validateRegistry` e o runner).
- `LlmTransport` (interface injetável), `LlmTransportError` (`transient` 429/timeout/5xx | `permanent` 4xx), `runSlot(slot, req, {registry, fallback, transport})` — tenta a lista ordenada do slot (§5), **salta modelos não-elegíveis sem os chamar** (fail-closed: nunca manda PII a provider sem ZDR, mesmo em fallback), desce em falha transitória, propaga permanente, `SlotExhaustedError` na lista esgotada.

**Verde:** typecheck ✅ · **13/13 testes @rh/ai** ✅ (5 runner: primário ok; desce em 429; salta sem-ZDR sem chamar; permanente propaga; esgotada→SlotExhausted) · Biome (69 fich.) ✅. **80 testes no total.** Transporte OpenRouter real (fetch) = fatia seguinte.

**Commit:** <hash>

---

## [2026-06-19 ~02:41] iteração 10 — `packages/ai`: registry de modelos + gate ZDR (§3/§7)

**Feito:** `packages/ai` (@rh/ai, dep zod) — bootstrap + o contrato de segurança nomeado no §3:
- `slot` (EXTRACTOR/ARCHITECT/LIVE), `modelEntry` (id + capacidades declaradas: supportsJson/Tools/Streaming/PromptCache, maxContext, cost, **`zdr`**), `slotAssignment` (os 3 slots configurados).
- **`validateRegistry(registry, slots)`** — devolve violações; **`assertRegistryValid`** lança (deploy fail-closed). Regras: todos os 3 slots veem PII → exigem `zdr:true` (§3/§7); capacidades por slot (LIVE=streaming+tools+json, ARCHITECT=json+tools, EXTRACTOR=json); modelo tem de existir + declarar o slot.

**Verde:** typecheck ✅ · **8/8 testes** ✅ (config válida=0 violações; sem_zdr; capacidade_em_falta; modelo_inexistente; slot_nao_declarado; assert lança) · Biome (67 fich.) ✅. **75 testes no total.** Wrappers de chamada (OpenRouter) + fallback por slot (§5) ficam para fatia seguinte (precisam de chave/mock).

**A fazer:** wrapper LLM com mock + fallback por slot (§5); WS replay/auth.refresh; services Python. GATED: docker-compose.dev, seeds, createDb (Docker down).

**Commit:** <hash>

---

## [2026-06-19 ~02:35] iteração 9 — `apps/ws` servidor WS real (handshake auth)

**Feito:** `apps/ws/src/server.ts` — `WsServer` (dep `ws`):
- 1ª mensagem TEM de ser `auth` (JWT no corpo, AUTENTICACAO §4); senão → close **4401**.
- `WsServerHooks.authenticate(token, interviewId)` **injetável** (stub em dev; real = Supabase + `can_join_interview`). Recusa → close **4403** (sem posse) / **4401**.
- Sucesso → cria `FrameSession`, envia `auth.ok` (seq 0) + `interview.active` (seq 1, arranca o overlay). `ack` do cliente guarda `lastSeq`. Bind a `127.0.0.1` (não exposto). `WsServer.start({port:0})` p/ porto efémero + `.close()`.

**Verde:** typecheck ✅ · **11/11 testes** ✅ (4 novos de integração com **socket localhost real** via Vitest: auth.ok+interview.active com seq 0/1; close 4403 token recusado; close 4401 1ª-msg-não-auth; close 4401 token vazio) · Biome (61 fich.) ✅. **67 testes no total.** Sem Docker (sockets localhost). auth.refresh + replay-on-reconnect (last_seq) ficam para fatia seguinte.

**A fazer:** replay/auth.refresh no WS; `services/agent`+`services/face` (estrutura Python). GATED: docker-compose.dev, seeds, createDb (Docker down).

**Commit:** <hash>

---

## [2026-06-19 ~02:30] iteração 8 — `apps/ws` codec de frames (fiabilidade seq/ack)

**Feito:** `apps/ws` (@rh/ws) — codec de frames WebSocket que consome `@rh/core`:
- `parseClientMessage(raw)` — aceita string JSON ou objeto, valida via `clientMessage` (Zod), devolve `ParseResult` (sem throw); rejeita JSON malformado E frames inválidos.
- `SeqCounter` — `seq` monótono por ligação (base do replay/ack na reconexão).
- `buildServerFrame(payload, seq)` — injeta `v`+`seq` e valida contra `serverMessage`; `ServerFramePayload` = `DistributiveOmit<ServerMessage,"v"|"seq">` (segurança por variante).
- `FrameSession` — prende o SeqCounter ao builder (emite seq incremental).

**Verde:** typecheck ✅ · 7/7 testes ✅ (parse auth/ack, rejeição de lixo, seq incremental, `@ts-expect-error` no `auth.error` code inválido = segurança em compilação) · Biome (59 fich.) ✅. **63 testes no total** (core 31 + db 25 + ws 7). Wiring do socket real (ws + upgrade HTTP + auth.refresh) deferido para fatia seguinte.

**A fazer:** `services/agent`+`services/face` (estrutura Python + contrato HTTP/S2S, não correr). GATED: docker-compose.dev, seeds, createDb, migração ao vivo (Docker down).

**Commit:** <hash>

---

## [2026-06-19 ~02:25] iteração 7 — scaffold `apps/web` (Next.js 15) + consumo de contratos

**Feito:** `apps/web` (Next.js **15.5.19** — NÃO 16; App Router + TS strict + Tailwind v4):
- `next.config.mjs` (`transpilePackages:['@rh/core']`, `outputFileTracingRoot` à raiz; `output:'standalone'` **gated por env**), `tsconfig.json` (estende o base + lib dom + jsx preserve + next plugin), `postcss.config.mjs` (Tailwind v4), `app/{layout,page}.tsx` + `globals.css`.
- **`app/api/health/route.ts`** importa `ok()` de `@rh/core` → **PROVA que os contratos são consumíveis** num route handler real.
- Deps: `@rh/core` (workspace:*), next@^15, react@^19. `sharp` aprovado nos build scripts.

**Verde:** `next build` ✅ (rotas `/`, `/api/health`) · typecheck (-r: core/db/web) ✅ · 56 testes ✅ · Biome (53 fich.) ✅.

**Reconciliação (Windows dev × Linux deploy):** `output:'standalone'` faz symlinks que o **Windows recusa (EPERM)** sem dev-mode/admin. Gated por `NEXT_OUTPUT=standalone` → local compila sem standalone (verde), o build da **VPS/CI (Linux)** ativa-o (onde symlinks funcionam). O `standalone` continua a ser a forma de deploy (playbook Vercel→VPS) — só não corre no Windows.

**A fazer:** `apps/ws` (stub que importa serverMessage/clientMessage), `services/agent`+`services/face` (estrutura Python + contrato HTTP). GATED (Docker down/apps): docker-compose.dev, seeds, createDb, migração ao vivo.

**Commit:** <hash>

---

## [2026-06-19 ~02:15] iteração 6 — AI shapes (3/3): MatchResult + IntakeEnvelope + Parecer

**Feito:** fecham-se os AI shapes de `packages/core`:
- `match.ts` — `MatchResult` (matchScore/gapsAInvestigar/pontosFortes — PLANO P1.4). Escala do score não-fixada pela spec → sem teto (não inventar).
- `intake.ts` — `intakeEnvelope` (alvo + alvoId nulável + intenção + conteudo — INTAKE §; o bot NUNCA adivinha o alvo).
- `report.ts` — `parecer` (RELATORIO-CLIENTE §3): veredito + `criterioResposta[]` (resposta+citação+timestamp, rastreável), forças, riscos, `logistica`, anguloVenda, `credencialVerificar[]` (§11, por documento), `intervaloNaoCapturado[]` (§14, buraco≠silêncio), fontes (Camada A).
- +4 enums: `credencialEstado`, `intakeAlvo`, `intakeIntencao`, `respostaCriterio`.

**Verde:** typecheck ✅ · 31/31 testes ✅ (+outputs.test.ts) · Biome ✅. Auto-review: removida const morta `UUID` (apanhada pelo `noUnusedLocals`+Biome — gate funcionou).

**Estado da Fundação P0.1:** `@rh/db` (schema 35 tabelas + migração + GUC) e `@rh/core` (envelope/ws/enums/pagination/idempotency/skill + **todos os AI shapes**: frame/evaluation/match/intake/report) — **camada de contratos COMPLETA**. Falta: docker-compose.dev + seeds + mocks + apps/services scaffolds + createDb (Docker-gated).

**Commit:** <hash>

---

## [2026-06-19 ~02:09] iteração 5 — AI shapes (2/N): RoleProfile + Rubric ("antes")

**Feito:** `packages/core/src/evaluation.ts` (CAMADA-CONHECIMENTO + INTAKE-E-JULGAMENTO Parte B):
- `roleProfile` — conteúdo dos 6 campos JSONB de `role_profile` (`competencias` [{skill,nivel,obrigatorio?}], `oQueEBom` record, `sinaisNivelErrado`, `linguagemFilipa` record, `perguntasChave`, `sources` [{url,acedidoEm}]).
- `rubricCriterion` — gabarito por requisito: keia por `requisitoId` (§16F), `perguntaSonda`, `fraco`/`ok`/`forte` + `linguagemFilipa` {fraco,ok,forte}, `peso`, `origem`, `originCriteriaId`, `tipo` (competencia|credencial §11); `rubric` (version≥1 + criteria[]).
- +2 enums em `enums.ts`: `criterioOrigem` (role_profile|client_criteria|ambos), `criterioTipo` (competencia|credencial).

**Verde:** typecheck ✅ · 24/24 testes ✅ (+6 evaluation.test.ts) · Biome ✅.

**Reconciliação:** o JSON do doc usa `competencias_esperadas`/`fontes` (output do LLM); o contrato segue os **nomes das colunas** de `role_profile` (MODELO-DADOS é a autoridade do storage) — o package `knowledge` mapeia LLM→colunas.

**A fazer (AI shapes 3/N):** MatchResult, Parecer, IntakeExtraction (ler ACESSO-E-CONHECIMENTO / RELATORIO-CLIENTE).

**Commit:** <hash>

---

## [2026-06-19 ~02:06] iteração 4 — AI shapes (1/N): frame de avaliação + EstadoVivo

**Feito:** `packages/core/src/frame.ts` — o frame de avaliação ao vivo (ARQUITETURA-TEMPO-REAL §2/§9):
- `requisitoStatus` = 4 estados canónicos da máquina de estados §9 (`não-tocado`/`raso`/`coberto-com-prova`/`contradito`).
- `requisitoCoverage` (keia por `requisitoId` UUID — família F; texto = display), `interesseClienteCoverage`, `afirmacaoCandidato` (c/ `conflitoCv`), `estadoVivo` (requisitos + interessesCliente + afirmacoesCandidato + perguntasFeitas + redFlags + resumoCorrente), `suggestion` (pergunta + lente + requisitoId nulável).
- **Apertou o `ws.ts`:** `tick.update.estado` deixou de ser `z.record(...)` genérico → passa a `estadoVivo`; `suggestion.next` agora reusa `...suggestion.shape` (single source).

**Verde:** typecheck ✅ · 18/18 testes ✅ (6 novos em frame.test.ts + o teste do tick.update endurecido) · Biome ✅.

**Reconciliação documentada:** o exemplo do doc keava `requisitos` por nome ("React"); apliquei a forma canónica da **família F** (keia por `requisitoId`, texto só display) — §16F sobrepõe-se ao exemplo pré-F.

**A fazer (AI shapes 2/N):** RoleProfile (CAMADA-CONHECIMENTO), Rubric+criteria (INTAKE-E-JULGAMENTO Parte B), MatchResult/Parecer/IntakeExtraction (ACESSO-E-CONHECIMENTO).

**Commit:** <hash>

---

## [2026-06-19 ~01:59] iteração 3 — P0.1: contrato GUC de tenant (@rh/db)

**Feito:** `packages/db/src/client.ts` — contrato OBRIGATÓRIO de isolamento de tenant (FASE-3-ARRANQUE §3, SEGURANCA §1/§15.9):
- `AGENCY_GUC = "app.agency_id"` + `setAgencyIdSql(agencyId)` (`select set_config($1,$2,true)` — is_local, parametrizado).
- `withAgencySession(db, agencyId, fn)` — abre transação curta → fixa o tenant → corre `fn`; reset garantido no fim da tx. Interfaces `TxExecutor`/`TransactionalDb` estruturalmente compatíveis com Drizzle (sem acoplar a um driver concreto). Exportado de `@rh/db`.

**Verde:** typecheck ✅ · 25/25 testes ✅ (3 novos: SQL renderizado via `PgDialect` — agency_id é PARÂMETRO, sem injeção; ordem tx_open→set_agency→fn; propagação do resultado) · Biome ✅. **Testável sem DB viva** (Docker continua down) — o `createDb` real (wiring ao pool pg) fica para quando a app precisar.

**Commit:** <hash>

---

## [2026-06-19 ~01:56] iteração 2 — P0.1: packages/core (contratos)

**Feito:** `packages/core` (@rh/core, dep zod 4.4.3) — contratos partilhados que tudo importa:
- `enums.ts` — 18 enums canónicos (efeito, speakerRole, processStage, interviewStatus, captureType, estadoProva, classificacao c/ nicho clínico, rubricLevel, confianca, peso, lente, fetchStatus, reportStatus, …) como fonte ÚNICA de validação nas fronteiras (espelham as colunas TEXT do schema).
- `envelope.ts` — `ApiResponse` (`{ok:true,data}|{ok:false,error}`), `errorCode` enum + `HTTP_STATUS_BY_CODE`, helpers `ok()`/`err()`, factory `apiResponse(schema)` (ARQUITETURA-INTEGRACAO §8).
- `pagination.ts` — cursor (`paginationQuery` limit≤100 default 20, `paginated(item)`).
- `idempotency.ts` — `IDEMPOTENCY_HEADER` + `idempotencyKey` (UUID).
- `ws.ts` — protocolo WebSocket FROZEN: `clientMessage` (auth+ack) / `serverMessage` (auth.ok/error/refresh, tick.update, suggestion.next c/ requisito_id [família F], coverage.update, alert, interview.active, job.progress/done) como discriminated unions; envelope fiável `v`+`seq` em todo frame de servidor; close codes `WS_CLOSE` 4401/4403; `WS_PROTOCOL_VERSION`.
- `skill.ts` — contrato de saída de skill (família J): `skillResult` JSON (`status`/`artifactPath`/`itemsCount`/`cost`/`error`).

**Verde:** typecheck ✅ · 12/12 testes ✅ (round-trips Zod + exaustividade dos unions + close codes) · Biome ✅.

**Notas (apertar em fatias seguintes, não inventado):** o payload `estado` do `tick.update` (EstadoVivo) e os shapes de IA (RoleProfile/Rubric/Parecer/MatchResult) ficam como placeholder genérico até ler `ARQUITETURA-TEMPO-REAL §2` na fatia de AI shapes. `agent_db_session(GUC)`/`search_knowledge`/`can_join_interview` (contratos de runtime do §3) entram com o cliente Drizzle de `@rh/db`.

**Commit:** <hash>

---

## [2026-06-19 ~01:50] iteração 1 — P0.1 Fundação: scaffold + packages/db (35 tabelas)

**Feito:**
- **Monorepo pnpm** na raiz do repo: `pnpm-workspace.yaml` (apps/* + packages/*; services/* Python ficam de fora), `package.json` (Biome 2.3.4 + TS 5.9.3, `engines.node>=20`, esbuild aprovado), `tsconfig.base.json` (strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`), `biome.json` (lint+format, migrations excluídas), `.gitignore` (`.env*` exceto `.example`/`.enc`), `.env.example` (inventário de env de ARQUITETURA-INTEGRACAO §3 — **zero segredos**).
- **`packages/db` (@rh/db):** schema Drizzle na forma FINAL canónica das **35 tabelas** (MODELO-DADOS), partido em 13 ficheiros de domínio (<800 linhas) + `_shared.ts` (helpers `pk`/`agencyId`/timestamps, `EMBEDDING_DIM=1536`). Famílias A–M materializadas: `process_id` canónico (interview/client_verdict/placement_outcome SEM job_id/candidate_id; órfã = process_id nullable), `requisito_id` (F), proveniência chunk→facto `source_chunk_id` (A), veredito graduado durável `rubric_level`/`confianca`/`parent_fact_id` (L), RGPD `classificacao`/`usar_no_score`/`estado_prova` (§5), idempotência `idempotency_key`/`provider_message_id` (I), `interview.distilled_at` (H), `report.status` (B), `source_doc.fetch_status`/`fetch_cost_usd` (K), `transcript_chunk.content_hash`/`prev_hash` não-repúdio (§15.8), `interview_participant` role-binding (M), 4 embeddings `vector(1536)` ivfflat.
- **Migração `migrations/0000_init.sql`** (35 CREATE TABLE + 58 FKs + `CREATE EXTENSION vector` prepended manualmente).
- **TDD:** `test/schema.test.ts` — 22 testes a encodar os invariantes canónicos A–M (contagem=35, process_id vs job_id, nullability órfã, 4 embeddings, vector(1536), agency_id defesa-em-profundidade) como suíte de regressão.

**Verde:** typecheck ✅ · 22/22 testes ✅ · `drizzle-kit generate` ✅ · Biome ✅.

**Code-review** (code-reviewer): 0 CRITICAL, **2 HIGH — ambos corrigidos:**
1. índice `client_verdict_process_idx (process_id, verdict)` — portado da spec (era `(job_id, verdict)`; job_id→process_id na evolução G1/G2; FK não cria índice implícito).
2. `agency_id` adicionado a `interview_tick` + `assistant_message` (guia de consolidação item 9 "agency_id em TODAS as tabelas" + §15.1; são as tabelas de maior volume → migrar depois seria caro).

**Reconciliações documentadas (não inventadas):**
- `report.content_md` → NULLABLE (base-DDL `NOT NULL` × ciclo de vida `'generating'` §16B; o §16B é mais recente e específico → ganha).

**A fazer (próximas iterações):** `packages/core` (contratos Zod + tipos WS + `agent_db_session` GUC + envelope/idempotência/paginação) → `docker-compose.dev` + seeds + mocks (Soniox/OpenRouter/LiveKit) → Supabase local → carris P1+.

**Bloqueios / spikes p/ o Mateus:**
- ⏳ **SPIKE — aplicar a migração a um Postgres real ficou por correr: Docker Desktop não está a correr nesta máquina** (daemon down). Validação feita via `drizzle-kit generate` (SQL válido pelo tooling) + 22 testes de introspeção. Quando o Docker estiver up: `docker run -d --name pgcheck -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg16` + aplicar `packages/db/migrations/0000_init.sql` no psql (ou `supabase start` + `drizzle-kit migrate`). Espera-se 35 tabelas + extensão `vector`.
- 🔲 pgvector: usei `ivfflat` (= DDL). §15.3 deixa HNSW em aberto p/ alto volume — decisão de ops futura, não bloqueia o build.

<!-- O loop acrescenta aqui as entradas, ex.:
## [data hora] iteração N — P0.1 packages/db
- Feito: schema.ts (35 tabelas) + 001_init.sql; migração aplica em Supabase local (verificado).
- Verde: typecheck ✅ · build ✅ · testes 12/12 ✅ · biome ✅ · code-review (0 critical) ✅.
- Falta: seeds, mocks.
- Bloqueios: nenhum.
- Commit: <hash>.
-->
