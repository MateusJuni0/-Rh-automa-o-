# Auditoria 360 — Backlog Overnight (rh-automacao / Vera→IRIS)

> Data: 2026-06-23 · Arquiteto: CLAUDE · Base: 8 auditorias do código REAL + verificação direta nesta sessão.
> Working dir: `C:\Users\mjnol\.openclaw\workspace\projects\rh-automacao` · Branch `phase3/product`.

---

## Resumo executivo (o estado real, sem achismo)

O projeto está **muito mais sólido do que a queixa "péssimo" sugere**, mas tem furos reais e concentrados exatamente onde o Mateus apontou. As 4 packages-base (`core`, `db`, `ai`, `knowledge`) e o `apps/web` são código real, testado e bem escrito (contratos Zod, envelope de API, 35 tabelas Drizzle, IA em mock €0). O hardening do Electron é sólido (sandbox, contextIsolation, CSP de headers, IPC validado por Zod). **A saúde da pipeline TS é boa**: typecheck passa nos 10 projetos, testes verdes (153 ran + 76 skipped no web por falta de Docker), build do desktop e `next build` compilam. O único comando que FALHA (`pnpm lint`) deve-se a UM ficheiro-protótipo solto na raiz (`vera-iris-v3-preview.html`) — não ao código real.

O **desktop está a ser editado nesta sessão** e já evoluiu desde a auditoria: o `FloatingVera.tsx` (675 linhas) JÁ ganhou botão "Fechar Vera" (idle) e "Terminar e fechar" (X no painel), dot de ligação (conn) e dot 🔴 de gravação; o `main.tsx` JÁ tem um cliente WebSocket real com reconnect (que cai no mock golden quando `VERA_WS_ORIGIN` está vazio). Ou seja, **as queixas 2, 3 e 5 estavam a ser corrigidas ao vivo** — mas faltam três coisas para fecharem de verdade: (a) o `index.html` ainda tem `connect-src 'self'`, que **BLOQUEIA o WebSocket** assim que houver URL → o "ligar à web" está meio-feito e parte em silêncio; (b) não há forma de a Filipa **INICIAR/reabrir** uma entrevista (queixa 4) — o tray não tem item, `endInterview()` faz `close()+null`, `window-all-closed` mata a app no Windows, e duplo-clique no tray também sai; (c) **nada wira o pipeline ao vivo em runtime** — `tickToFramePayloads → broadcast` só é chamado por testes, `apps/realtime` não tem entrypoint, e o servidor WS só emite `auth.ok`+`interview.active`.

A **transcrição por candidato (queixa 8) não existe em lado nenhum visível**: o schema (`transcript_chunk` com `speaker`, hash-chain) é real e separável por candidato, mas NADA escreve fora dos testes, não há rota `/api/.../transcript`, não há frame `transcript.*` no protocolo `@rh/core`, o seed não cria chunks/ticks/factos (logo o card "O que sabemos das entrevistas" fica sempre vazio), e o overlay mostra sempre "João Silva" hardcoded ligado a UUIDs fake. O **rename Vera→IRIS** mal começou: 303 refs em 18 ficheiros do desktop + 48 ficheiros na web, incluindo texto visível à Filipa ("A Vera sugere", "Perguntar à Vera…", `<title>Vera`, tray "Vera — copiloto IRIS").

Há ainda **código morto que dá falsa confiança verde**: o cluster `hud/` (Hud/ExpandedPanel/ChatPanel/Pill/audioCapture) NÃO embarca mas é testado por `hud.test.tsx`/`audioCapture.test.ts` — enquanto o que a Filipa REALMENTE vê (`FloatingVera`/`IrisMark`) não tem nenhum teste de componente. `windowState.ts` (multi-monitor) está testado mas o `main.ts` ignora-o e cobre só o ecrã primário. `buildOverlayWindowOptions` está órfão (o `main.ts` inlina as opções).

**Veredito de honestidade:** o build não "dá muitos erros" no sentido de compilação — dá UM erro de lint (ficheiro solto) e tem furos de wiring/UX que parecem "erros" para quem usa. O que falta para o teste ser coerente "como a Filipa" é: arranque manual, indicador de status verdadeiro, transcrição por candidato com dados de seed credíveis, e fechar o anel desktop↔ws↔dados (mesmo em mock).

---

## Veredito da Filipa (consegue mesmo usar isto?)

- **Abrir o app?** Hoje a IRIS arranca sozinha visível (o mock auto-dispara). Não há gesto de "abrir para iniciar". → **NÃO, falta o gatilho explícito (Onda A).**
- **INICIAR transcrição?** Não existe botão nem item de tray; o mock começa no `useEffect`. → **NÃO (queixa 4, Onda A).**
- **Saber se está a transcrever?** JÁ há dot 🔴 e dot de ligação no overlay (corrigido ao vivo). Mas o tray não reflete estado e o status só é "verdadeiro" quando o WS ligar de facto. → **PARCIAL — fecha na Onda A + C.**
- **Fechar a IRIS / sair?** JÁ há "Fechar Vera" (idle) e "Terminar e fechar" (X) + "Terminar entrevista" no painel; tray tem "Sair". MAS terminar deixa a app num beco (close+quit no Windows). → **PARCIAL — fecha na Onda A.**
- **Ver transcrições de CADA candidato separado?** **NÃO.** Não há superfície de transcrição (nem desktop nem web), seed vazio, overlay genérico. → **A maior lacuna real (Onda C).**
- **Parece ligado à web/internet?** **NÃO.** WS bloqueado por CSP, "Abrir painel web" é no-op (URL vazia), Role Profile usa `EMPTY_ROLE_PROFILE`. → **Onda C/D.**

**Conclusão:** com as Ondas A+C feitas esta noite (arranque, status real, transcrição por candidato com seed credível, anel mock coerente), a Filipa passa de "demo que congela" para "fluxo credível de 1 candidato ponta-a-ponta em mock". O rename (B) é higiene visível obrigatória. D/E/F blindam e polem.

---

## ONDA A — Desktop UX crítico (queixas 2,3,4,5) — PRIORIDADE MÁXIMA

**Objetivo:** a Filipa abre, inicia transcrição, vê status claro, fecha/sai sem beco sem saída. Tudo em MOCK.

### A1 — [BLOCKER] Não há como INICIAR/reabrir entrevista; "Terminar" deixa beco sem saída
- **Ficheiros:** `apps/desktop/src/main/main.ts` (`endInterview` L101-105, `window-all-closed` L137-141, `activate` L130-134), `apps/desktop/src/main/tray.ts` (L23-29).
- **Evidência:** `endInterview()` faz `overlay?.close(); overlay=null`. `window-all-closed`→`app.quit()` no Windows. `activate` só dispara no macOS. Tray NÃO tem "Iniciar/Mostrar a IRIS". Resultado: Filipa clica "Terminar" → IRIS some → app morre → tem de relançar.
- **Fix (mock):** separar `createOverlay` de `showOverlay`; "Terminar" passa a `overlay.hide()` (não `close()`), mantendo a app viva na tray. NÃO chamar `app.quit()` em `window-all-closed` (só sair pelo item "Sair"). Adicionar ao tray **"Iniciar entrevista (teste)" / "Mostrar a IRIS"** que mostra o overlay e (re)arranca o guião golden. No renderer, NÃO auto-play no `useEffect`: estado `idle` inicial + start disparado pelo tray/botão.
- **Aceitação (Filipa):** abre app → IRIS está na tray discreta → clica "Iniciar entrevista (teste)" → overlay aparece e começa o guião com 🔴 → clica "Terminar" → IRIS volta à tray (não morre) → pode reiniciar. Repetível N vezes sem relançar.

### A2 — [HIGH] Auto-play no mount: a entrevista "começa sozinha" ao abrir (queixa 4)
- **Ficheiros:** `apps/desktop/src/renderer/main.tsx` (L22-72, `playScript` no `useEffect`), `apps/desktop/src/overlay/mockFeed.ts` (L48 emite `interview.active{on:true}`).
- **Evidência:** o `useEffect` corre `playScript(goldenInterviewScript())` no mount; o mock emite logo `interview.active` → reducer força `recording:true`. A Filipa nunca "carrega para iniciar".
- **Fix (mock):** introduzir estado `idle` (sem feed) e só arrancar o `playScript` quando o start é acionado (tray A1 ou botão "Iniciar" na bolha idle, que já existe — `FloatingVera.tsx:403-426`). Manter o reducer; só atrasar o gatilho.
- **Aceitação:** ao abrir o overlay sem iniciar, mostra "Aguardando entrevista…" + dot de espera (sem 🔴). Só após o start aparece 🔴 e as sugestões.

### A3 — [HIGH] window-all-closed mata a app no Windows; duplo-clique no tray sai (atalho perigoso)
- **Ficheiros:** `apps/desktop/src/main/main.ts` (L137-141), `apps/desktop/src/main/tray.ts` (L32 `double-click`→`onQuit`).
- **Evidência:** terminar entrevista = sair da app sem querer; duplo-clique acidental no relógio durante a entrevista perde a sessão.
- **Fix:** Windows mantém-se vivo na tray sem janelas (não `app.quit()` em `window-all-closed`). Trocar `double-click→onQuit` por `double-click→mostrar/ocultar a IRIS`. "Sair" fica só no menu, idealmente com confirmação se há entrevista ativa.
- **Aceitação:** fechar a janela do overlay não fecha a app; duplo-clique no tray alterna visibilidade da IRIS, nunca sai.

### A4 — [MEDIUM] Status no TRAY não reflete estado (a ouvir 🔴 / em espera ⚪)
- **Ficheiros:** `apps/desktop/src/main/tray.ts` (estático), ligação a `interview.active` via IPC do renderer→main.
- **Evidência:** spec APP-DESKTOP §1 exige tray a mudar entre "a ouvir 🔴" e "em espera ⚪". O dot no overlay já existe; o tray não.
- **Fix:** expor um canal `vera:status` (renderer→main) que atualiza tooltip/label do tray ("A ouvir 🔴" vs "Em espera ⚪") conforme `interviewActive`/`recording`. Reaproveitar o `setToolTip`.
- **Aceitação:** com a IRIS na tray, o tooltip diz "Em espera"; durante a entrevista diz "A ouvir 🔴". A Filipa sabe o estado sem abrir.

### A5 — [MEDIUM] Robustez do ícone de tray (cai para vazio → "app aberta, não vejo nada")
- **Ficheiros:** `apps/desktop/src/main/tray.ts` (L11-14 fallback `nativeImage` vazio), `apps/desktop/build.mjs` (L57 copia `assets/tray.png`).
- **Evidência:** se `tray.png` faltar, o Tray fica com imagem vazia (no Windows pode ficar invisível). `tray.png` existe (33KB) mas o fallback é fraco e silencioso.
- **Fix:** validar no start que o ícone não está vazio; logar aviso visível se estiver. Garantir o asset no build (já copia). Opcional: ícone embutido base64 como último recurso.
- **Aceitação:** mesmo sem `tray.png`, há aviso no log e um ícone visível; nunca "app a correr sem nada no ecrã".

---

## ONDA B — Rename Vera → IRIS (código, UI, ficheiros, CSS)

**Objetivo:** zero "Vera" em pixels que a Filipa vê. Decisão de naming interno documentada.

### B0 — [DECISÃO] Definir política de rename (interno fica "vera" como código, à la hermes→Lince?)
- **Pergunta ao Mateus:** texto VISÍVEL → "IRIS" já. Identificadores internos (`window.vera`, canais IPC `vera:*`, classes CSS `.vera-*`, env `VERA_*`, tipos `VeraBridge`/`VeraAction`, `divergence_origin='vera_generated'`) → renomear agora OU manter como namespace interno invisível (padrão hermes/Lince)? Recomendação: **visível=IRIS já; interno mantém "vera" como nome de código** (não parte contratos IPC/CSS acoplados). Documentar a decisão.

### B1 — [HIGH] Texto visível ainda diz "Vera" no desktop
- **Ficheiros/linhas:** `FloatingVera.tsx` ("A Vera sugere" L456 e L572, `<b>Vera</b>` no log L674, placeholder/aria "Perguntar à Vera…" L684-685, aria "Fechar Vera" L430, aria "Vera: arrasta" L501); `tray.ts` (L22 tooltip "Vera — copiloto IRIS", L28 "Sair (fechar a Vera)"); `index.html` (L11 `<title>Vera`).
- **Fix:** trocar todas as strings visíveis para "IRIS". Coerência: o painel já diz "IRIS" no header (L545) mas a bolha diz "A Vera sugere" — uniformizar.
- **Aceitação:** grep por "Vera" em strings JSX/HTML visíveis = 0 no desktop. A Filipa só vê "IRIS".

### B2 — [MEDIUM] Texto visível ainda diz "Vera" na web
- **Evidência:** 48 ficheiros com "Vera"/"vera"; visíveis ex.: `candidatos/[id]/page.tsx` ("Perguntar à Vera sobre…" L209, "Extraído automaticamente pela Vera"), `EntityQA.tsx`, `assistente/VeraAvatar.tsx`, `definicoes/page.tsx`.
- **Fix:** strings de UI visíveis → "IRIS". `VeraAvatar.tsx` → `IrisAvatar.tsx` (componente) num commit separado se quiserem renomear ficheiro.
- **Aceitação:** páginas web não mostram "Vera" a um utilizador; identificadores internos só mudam se B0 decidir rename total.

### B3 — [MEDIUM] Identificadores internos (só se B0 = rename total)
- **Ficheiros:** `preload.ts` (`window.vera`, `VeraBridge`), `main.ts`/`preload.ts` (canais `vera:action`/`vera:end`/`vera:interactive`/`vera:frame`), `vera-overlay.css` + classes `.vera-*` (acopladas ao hit-test em `FloatingVera.tsx:284`), `FloatingVera.tsx`/`IrisMark.tsx` (ficheiros), `divergence_origin='vera_generated'` em `packages/db/src/schema/transcript.ts:77`.
- **Fix (se rename total):** num único commit coordenado renderer+preload+main+css com typecheck+test verdes (são contratos acoplados — mudar um lado parte o IPC/click-through). `divergence_origin` é `text` livre (sem CHECK), seguro trocar para `iris_generated`; promover a enum em `core/enums.ts` para travar achismo.
- **Aceitação:** typecheck + todos os testes verdes; click-through continua a funcionar (hit-test usa as classes CSS).

---

## ONDA C — Ligação app↔web↔ws↔dados + transcrição por candidato (queixas 6,8,9)

**Objetivo:** fechar o anel ao vivo em MOCK e mostrar transcrição POR CANDIDATO com evidência. Sem achismo.

### C1 — [BLOCKER] CSP do renderer (`connect-src 'self'`) BLOQUEIA o WebSocket que já existe
- **Ficheiros:** `apps/desktop/src/renderer/index.html` (L9 `connect-src 'self'`), `apps/desktop/build.mjs` (não templa CSP), `apps/desktop/src/main/main.ts` (L25 `buildCsp` com WS/API só vale para headers HTTP, não para `file:`).
- **Evidência:** `main.tsx:39` já faz `new WebSocket(wsUrl)`, mas o `loadFile` (file:) só é defendido pela `<meta>` CSP, que está a `'self'`. **Mesmo com `VERA_WS_ORIGIN` definido, o browser recusa a ligação.** O wiring WS está meio-feito e parte em silêncio.
- **Fix:** templar `connect-src` em build-time (`build.mjs`, passo 3/4 do bundle) injetando `VERA_WS_ORIGIN`/`VERA_API_ORIGIN` quando definidos; sem origem → manter `'self'` (modo mock). Alinhar com `buildCsp` do `main.ts`.
- **Aceitação:** com `VERA_WS_ORIGIN=ws://127.0.0.1:18792`, o overlay liga ao WS sem erro de CSP no console; sem a env, mantém `'self'` e cai no mock.

### C2 — [BLOCKER] Pipeline transcrição→tick→ws→overlay NUNCA é montado em runtime (só testes)
- **Ficheiros:** criar entrypoint (ex.: `apps/realtime/src/main.ts` ou montar em `apps/ws/src/main.ts`); `apps/realtime/src/frames.ts` (`tickToFramePayloads`), `apps/realtime/src/engine.ts` (`TickEngine`), `apps/realtime/src/source.ts` (`createManualTranscriptSource`), `apps/ws/src/server.ts` (`broadcast` L149).
- **Evidência:** `broadcast(` só é chamado em `apps/ws/test/replay.test.ts`; `tickToFramePayloads` só em `apps/realtime/test/engine.test.ts`. `apps/realtime` exporta só lib (sem `start`). O servidor WS só emite `auth.ok`+`interview.active`.
- **Fix (mock):** orquestrador que, por entrevista ativa: escolhe fonte mock (`chooseTranscriptMode`/`createManualTranscriptSource`), cria `TickEngine` com os requisitos da rubric, e no `onTick` faz `tickToFramePayloads(id, out).forEach(p => ws.broadcast(p))`. Alimentar a fonte com um guião determinístico (reaproveitar o golden). Adicionar script `start` ao `apps/realtime` e ao `docker-compose.dev.yml`/`ARRANQUE.md`.
- **Aceitação:** subir `web+ws+realtime+Postgres`; ligar o desktop com a env do WS → overlay recebe ticks/sugestões REAIS do servidor (não só do mock local). Sem o orquestrador, ligar mostrava HUD vazio.

### C3 — [BLOCKER] Frame de transcrição + transcrição por candidato (queixa 8)
- **Ficheiros:** `packages/core/src/ws.ts` (union `serverMessage` L98-109 — sem `transcript.*`), `packages/core/src/frame.ts` (`estadoVivo` sem falas brutas), `apps/desktop/src/overlay/types.ts` (HudState sem transcrição), `apps/web` (sem rota/vista de transcript), `apps/web/lib/transcript.ts` (`persistChunk` existe, real, separável por `speaker`).
- **Evidência:** o protocolo congelado não tem frame de falas; o overlay nunca mostra texto transcrito; a web só mostra factos destilados (`cand.factos`, `page.tsx:164-206`), nunca o transcript bruto por falante/minuto.
- **Fix (decisão de contrato necessária — ver perguntas):** (1) adicionar `transcript.append` ao `@rh/core` (interviewId, candidateId, speaker, text, ts) — **precisa aprovação do Mateus (contrato congelado)**; (2) vista de transcript por entrevista/candidato — recomendo rota web `interviews/[id]/transcript` (ou aba no candidato) que lista `transcript_chunk` por `seq`, colorido por `speaker`, com timestamp; (3) opcional: painel de transcrição no overlay expandido.
- **Aceitação:** a Filipa abre um candidato → vê as entrevistas DELE separadas → cada linha tem falante + minuto (não genérico). Tudo lido de dados reais de seed (ver C5).

### C4 — [HIGH] Overlay mostra "João Silva" hardcoded ligado a UUIDs fake (queixa 8/9)
- **Ficheiros:** `apps/desktop/src/renderer/main.tsx` (L101 `contexto="Frontend Sr · João Silva"`), `apps/desktop/src/overlay/mockFeed.ts` (L14 `MOCK_INTERVIEW_ID` + requisitos com UUIDs inventados), `packages/db/src/seed.ts` (cria "João Demonstração" com OUTRO id).
- **Evidência:** o overlay não sabe que candidato está a entrevistar; os UUIDs do mock não batem com o seed.
- **Fix (mock data-driven):** parametrizar o overlay pelo `interviewId`/candidato REAL (o painel web abre o desktop com `?interviewId=…`, ou o WS manda um frame inicial com metadata). O mock golden lê requisitos/candidato da vaga seedada ("João Demonstração" + requisitos da vaga "Dev Frontend React Pleno"). Manter MOCK, mas coerente com o seed.
- **Aceitação:** o overlay mostra o nome/vaga reais do candidato seedado; os requisitos do semáforo batem com a vaga real. Zero literais "João Silva".

### C5 — [HIGH/MEDIUM] Seed sem transcript/tick/factos → card "O que sabemos" sempre vazio
- **Ficheiros:** `packages/db/src/seed.ts` (cria agency/recruiter/client/job×2/candidate/process/interview×2 'scheduled', SEM chunks/ticks/factos), `apps/web/app/candidatos/[id]/page.tsx` (L164 só mostra `cand.factos` se length>0).
- **Evidência:** grep `transcript_chunk|interview_tick|candidate_memory_fact` no seed = ZERO. As 2 entrevistas são 'scheduled' (futuro). Logo a aba do candidato fica sempre vazia.
- **Fix (mock):** adicionar ao seed (ou `seed.fixtures`) 1 entrevista status 'done' + N `transcript_chunk` diarizados (speaker candidate/recruiter, ts, text) + alguns `interview_tick` (live_state) + `candidate_memory_fact` destilados, TODOS coerentes com a vaga "Dev Frontend React Pleno" e com 1 red flag/contradição vs CV (credível "como a Filipa"). Idempotente (UUIDs fixos + `onConflictDoNothing`).
- **Aceitação:** depois de seed, abrir o candidato mostra factos com citação+minuto E a transcrição separada por falante. Pelo menos 2 perfis golden (1 bom, 1 com contradição) para a separação por candidato ser visível.

### C6 — [MEDIUM] "Abrir painel web" é no-op no v1 (URL vazia)
- **Ficheiros:** `apps/desktop/src/main/main.ts` (`openWebPanel` L107-117, `API_ORIGIN=''`).
- **Evidência:** `new URL('')`→lança→catch silencioso→não abre nada. Botão morto, desonesto para a Filipa.
- **Fix (mock):** apontar para o `apps/web` local (`http://localhost:3000`) durante o teste, OU desativar/esconder o item quando `API_ORIGIN` vazio. Documentar modo teste.
- **Aceitação:** clicar "Abrir painel web" abre a app web local; ou o item não aparece (sem botão morto).

### C7 — [MEDIUM] broadcast difunde a TODAS as ligações (sem filtrar por interviewId)
- **Ficheiros:** `apps/ws/src/server.ts` (`broadcast` L149-155 ignora `state.interviewId`).
- **Evidência:** 2 entrevistas/janelas simultâneas → A recebe ticks de B. Incoerente mesmo em single-tenant com sobreposições.
- **Fix:** `broadcast(payload, interviewId?)` que filtra `state.interviewId === payload.interviewId` (o id já vem em quase todos os payloads). Baixo custo.
- **Aceitação:** com 2 entrevistas, cada janela só recebe os ticks da sua.

### C8 — [HIGH] Role Profile não ligado (usa EMPTY_ROLE_PROFILE) — fica Fase Ω
- **Ficheiros:** `apps/web` `match.ts` (L12-19,72), `briefing.ts` (L72,89), `packages/knowledge/src/index.ts` (Exa/Brave "noutra fatia").
- **Evidência:** sempre `EMPTY_ROLE_PROFILE`; busca externa Exa/Brave não existe (paga).
- **Fix (mock €0):** pré-computar um `roleProfile` estático no seed rotulado "demo", OU mock determinista de `searchRoleProfile` (à la `mockEmbedder`). Ligação real de Exa/Brave → KEYS-TODO/Fase Ω.
- **Aceitação:** o fluxo de briefing/match mostra um role profile (rotulado demo) em vez de vazio; sem chaves pagas.

---

## ONDA D — OpenRouter pronto (mock default, 1 toggle de env, sem gastar)

### D1 — [LOW/polish] LLM mock por slot já é o default €0 — só preparar o toggle
- **Ficheiros:** `packages/ai/src/mock.ts`, `runner.ts`, `registry.ts`, `generate.ts`.
- **Evidência:** mock usável sem chave (3 slots, ZDR gate, fallback fail-closed, 40 testes verdes). A forma para ligar OpenRouter está pronta.
- **Fix:** garantir que existe um `LlmTransport` real (fetch OpenRouter) atrás de `OPENROUTER_API_KEY`; sem a chave → mock. Documentar em KEYS-TODO o toggle (1 env). NÃO ligar nada pago no teste.
- **Aceitação:** sem `OPENROUTER_API_KEY` tudo corre em mock (€0); com a chave (na entrega) troca-se a fonte sem reescrita. Confirmado por teste que o default é mock.

### D2 — [LOW] Documentar a fronteira mock→live (WS grátis vs STT/LLM pago)
- **Fix:** no KEYS-TODO deixar explícito: WS de estado é grátis (ligar já em mock local); só STT (Soniox/LiveKit) e LLM (OpenRouter) + Exa/Brave + embedder OpenAI são pagos (Fase Ω). HS256→RS256 e mock→@rh/db é troca de 1 env.
- **Aceitação:** KEYS-TODO lista cada chave, o que desbloqueia, e que o teste corre 100% sem elas.

---

## ONDA E — Erros / saúde de build (queixa 7) — causas-raiz

### E1 — [HIGH] `pnpm lint` falha (exit 1) só por `vera-iris-v3-preview.html` na raiz
- **Ficheiros:** `vera-iris-v3-preview.html` (raiz, untracked), `biome.json` (inclui `**`, não exclui), `.gitignore` (não cobre).
- **Evidência (verificado nesta sessão):** `pnpm lint` → 7 erros + 8 warnings, TODOS desse ficheiro (parse errors L693-695, `useIterableCallbackReturn` L683, `noImportantStyles`, `useTemplate`, `noUnusedVariables`). O resto do repo passa biome limpo.
- **Fix:** apagar o protótipo OU movê-lo para fora do repo OU adicioná-lo ao `.gitignore` + excluir no `biome.json` (negação `!vera-iris-v3-preview.html` ou pasta `prototypes/` ignorada).
- **Aceitação:** `pnpm lint` → exit 0. Causa-raiz é só este ficheiro.

### E2 — [HIGH] Código morto dá falsa confiança verde (hud/ testado, FloatingVera não)
- **Ficheiros:** `apps/desktop/src/renderer/hud/{Hud,ExpandedPanel,ChatPanel,Pill}.tsx` + `audioCapture.ts` (não embarcam); testes `hud.test.tsx`, `audioCapture.test.ts`; `FloatingVera.tsx`/`IrisMark.tsx` (embarcam, sem teste).
- **Evidência:** `main.tsx` importa só `FloatingVera` + `hud/player` + `hud/types`. `hud.test.tsx` testa UI que a Filipa nunca vê; o componente real não tem teste.
- **Fix:** confirmar que `FloatingVera` é canónico (ver perguntas) → apagar `Hud/ExpandedPanel/ChatPanel/Pill` + `hud.test.tsx` + (decidir) `audioCapture` (manter como scaffolding NÃO-v1, marcado no BUILD-LOG). Manter `hud/player.ts`, `hud/format.ts`, `hud/types.ts` (usados). Escrever testes de `FloatingVera`: fechar→onEnd, dot de conn por status, dot 🔴 recording, navegação de sugestões, reação a "contradito".
- **Aceitação:** sem código morto no overlay; o componente que a Filipa vê tem cobertura de teste; suite continua verde.

### E3 — [MEDIUM] `windowState.ts` (multi-monitor) testado mas morto; `buildOverlayWindowOptions` órfão
- **Ficheiros:** `apps/desktop/src/main/windowState.ts` (+ test), `apps/desktop/src/shared/windowConfig.ts` (`buildOverlayWindowOptions`, só usado por `hardening.test.ts`+`index.ts`), `apps/desktop/src/main/main.ts` (L37-62 inlina opções).
- **Evidência:** main cobre só o ecrã primário; testes validam objeto/posição que a app real não usa ("build verde ≠ código bom").
- **Fix:** decidir 1 fonte de verdade. (A) assumir "janela full-screen click-through" como LOCKED → remover `windowState.ts`+test e atualizar APP-DESKTOP §1; OU (B) o `main.ts` consome `buildOverlayWindowOptions` e persiste a posição do ícone (`FloatingVera pos`) entre sessões. Recomendo (A) para v1 (menos superfície) + persistir só a posição do ícone.
- **Aceitação:** os testes cobrem o caminho REAL da janela; sem dead code multi-monitor a fingir cobertura.

### E4 — [LOW] index.html fonte enganador (type=module + IIFE) e warning Supabase/Edge
- **Ficheiros:** `apps/desktop/src/renderer/index.html` (L15 `type="module"`, reescrito pelo build), `apps/web/lib/supabase/server.ts` (warning `process.version` no Edge — benigno, todos os routes são `runtime='nodejs'`).
- **Fix:** alinhar o index.html-fonte ao que o build produz (sem `type=module`, com `<link>` do CSS) ou comentar que o build reescreve. Documentar invariante "supabase server = nodejs only". Baixa prioridade.
- **Aceitação:** sem divergência fonte/saída confusa; warning documentado como benigno.

---

## ONDA F — Features da spec + melhorias para a Filipa

### F1 — [HIGH] Ações do overlay (Usei/Pular/★/chat/end) são no-op (TODO Fase K)
- **Ficheiros:** `apps/desktop/src/main/main.ts` (`vera:action` L144-153 termina em TODO; `vera:end`→`endInterview` sem POST report), `main.tsx` (chat fabrica resposta mock local L88-93).
- **Fix:** ligar `vera:action` ao backend (usei/pular/star → POST feedback do tick; 'end' → `POST /api/interviews/:id/report`, rota que JÁ existe). Chat ao vivo precisa de contrato dedicado (ver perguntas). Pelo menos 'end' deve disparar o report real para fechar o ciclo (queixa 6).
- **Aceitação:** terminar entrevista gera o parecer no backend; "Usei/Pular/★" registam momento. Chat marcado claramente como mock até ao contrato.

### F2 — [MEDIUM] Item "Entrevistas" / transcrição na navegação web
- **Ficheiros:** `apps/web/app/components/Sidebar.tsx` (L25-32 sem "Entrevistas"), rota nova `interviews/[id]/transcript`.
- **Fix:** adicionar entrada de navegação para entrevistas/transcrições (depende de C3/C5). Permite à Filipa chegar à transcrição por candidato.
- **Aceitação:** a Filipa navega Candidato → Entrevistas → Transcrição sem URL manual.

### F3 — [MEDIUM] `denySensitivePermissions` bloqueia mic/câmara — landmine para captura/biometria (fast-follow)
- **Ficheiros:** `apps/desktop/src/main/main.ts` (L94-99), `apps/desktop/src/renderer/hud/audioCapture.ts` (scaffolding, nunca importado).
- **Fix:** manter o deny por defeito (correto v1), mas comentar que mic/câmara passam a permitidos só atrás de flag de captura/biometria + pré-explicação (APP-DESKTOP §5). Marcar `audioCapture` como NÃO-v1 no BUILD-LOG. Não apagar (é a costura certa).
- **Aceitação:** documentado; quando a captura chegar, o handler abre mic só com flag e após consentimento.

### F4 — [LOW] Coerência "Terminar entrevista" vs "Fechar/Sair" (modelo mental)
- **Ficheiros:** `FloatingVera.tsx` (onEnd serve idle "Fechar Vera" E painel "Terminar"), `tray.ts` (Terminar vs Sair separados).
- **Fix:** separar verbos: "Terminar entrevista" (dispara report, mantém IRIS na tray) vs "Fechar/Sair" (quita). No idle, o X fecha/minimiza para tray; ao vivo, termina com confirmação. Alinhar rótulos overlay↔tray.
- **Aceitação:** a Filipa nunca confunde "terminar entrevista" com "sair da app".

### F5 — [LOW] Drift de docs: `apps/bot` não existe (intake em `packages/intake-bots`)
- **Fix:** alinhar READMEs/specs que referem `apps/bot` para `packages/intake-bots`, ou criar `apps/bot` se for deploy separado planeado. Higiene de docs.
- **Aceitação:** docs batem com a estrutura real do monorepo.

---

## Riscos / armadilhas conhecidas

- **Alvo móvel:** `FloatingVera.tsx`/`vera-overlay.css` estão Modified não-committados e mudaram durante a auditoria. COMMITAR o estado atual antes de nova ronda; reconfirmar live com `node build.mjs && pnpm exec electron .` (matar instâncias por path `*rh-automacao*`, não VS Code; preview :4599 não é o Electron).
- **CSP vs WS:** o cliente WS já existe no renderer mas o `connect-src 'self'` BLOQUEIA-O — qualquer "ligar à web" parte em silêncio até C1 ser feito. Não declarar queixa 6 resolvida sem C1+C2.
- **Contrato congelado:** `transcript.append` e frame de chat tocam o `@rh/core` (congelado) — precisa aprovação do Mateus antes de mexer (C3, F1).
- **Docker entre sessões:** os 76 testes de integração do web só correm com Postgres :5433 (Docker cai entre sessões → ECONNREFUSED). "229 verdes" sobrevende: são 153 ran + 76 skipped. Para QA-Filipa final, subir Docker + seed + `TEST_DATABASE_URL`.
- **getDb lança sem DATABASE_URL:** `apps/web/lib/db.ts` faz throw; sem Postgres, todas as rotas /api dão 500 em cadeia (alimenta queixa 7). Garantir Postgres seedado antes de ligar o desktop, ou degradar com envelope `err`.
- **Não inflar "pronto":** `audioCapture`, multi-monitor, Role Profile e captura de áudio são NÃO-v1; marcar no BUILD-LOG para não dar falsa sensação de feito.

---

## Perguntas em aberto (decisão do Mateus)

1. **Naming (B0):** interno fica "vera" como código (à la hermes→Lince) ou rename total `iris:*`/`window.iris`/`.iris-*`? Decide se a Onda B é só strings ou também contratos IPC/CSS acoplados.
2. **UI canónica (E2):** `FloatingVera` é definitivo e `Hud/ExpandedPanel/ChatPanel/Pill` podem ser apagados (com `hud.test.tsx`)? (não há import de produção, mas confirmar antes de remover testes verdes).
3. **Modelo da janela (E3):** full-screen transparente click-through é LOCKED, ou volta-se a ~360px frameless com `windowState` multi-monitor?
4. **Arranque mock (A1/A2):** ao "Terminar", re-correr o guião golden ao reabrir, ou ficar em "em espera" até nova ação?
5. **Transcrição por candidato (C3):** vive no desktop (durante) ou só na web (depois)? E o frame `transcript.append` entra no `@rh/core` congelado (precisa aprovação) ou canal separado?
6. **Orquestrador (C2):** onde vive (novo `apps/realtime/main.ts`, dentro do `apps/ws/main.ts`, ou worker arrancado por `/api/interviews/:id/join`)?
7. **Seed golden (C5):** quantos candidatos e que perfis (ex.: 1 bom, 1 com red flag/contradição vs CV)?
8. **Chat ao vivo (F1):** o `@rh/core` não tem frame de chat — contrato novo (frame ou rota `/api`) antes de ligar; hoje é mock local.
