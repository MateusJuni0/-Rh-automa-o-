# Relatório Overnight — 2026-06-23 (loop CLAUDE)

> Para o Mateus, de manhã. Trabalho da noite no rh-automação (IRIS). Honesto: o que está
> **feito e verificado**, o que o **Codex** fez em paralelo, e o que **falta** (priorizado).

## TL;DR
O projeto **NÃO estava "péssimo"** no sentido de compilar — typecheck passa nos 11 projetos, testes
verdes. Estava com **furos de UX no desktop** e **sem a transcrição por candidato** (a tua maior
queixa). A maior lacuna real — **ver a transcrição de cada candidato, sem achismo** — está agora
**FEITA e VERIFICADA ponta-a-ponta no app real** (DB + Next.js, como a Filipa veria).

Trabalhámos **dois agentes em paralelo**: eu no **backend/dados/web**, o **Codex no desktop + ws**.
Dividimos território para não colidir. Eu integrei e committei o trabalho dos dois (o Codex edita o
working tree mas não committa).

## ✅ Feito e verificado (eu) — tudo pushed para `phase3/product`
1. **Backup blindado** — tar (6,3 MB c/ histórico) + commit `6b24aa1` + branch `backup/overnight-2026-06-23`, ambos no GitHub. Reversível.
2. **Auditoria 360** — 8 auditores ao código real → `AUDITORIA-360-OVERNIGHT.md` (backlog priorizado A–F).
3. **Transcrição por candidato (QUEIXA 8) — commit `3342d16`:**
   - Seed golden: **João** (forte, honesto) + **Marta** (CV diz 4 anos de React; na entrevista assumiu ~1,5 — **contradição vs CV** apanhada na fala).
   - Cada um com entrevista `done`, **transcript_chunk diarizado** (João 9 falas, Marta 7), factos com **prova ancorada ao chunk** (citação + minuto), e uma `contradiction` vs_cv.
   - Nova vista **`/entrevistas/[id]`** — transcrição diarizada (falante + minuto), secção **"Verdade vs CV"**, a fala da contradição marcada **"⚠ vs CV"**.
   - Secção **"Entrevistas"** na página do candidato → leva à transcrição.
   - **VERIFICADO**: subi o Postgres (Docker já estava up), corri migrate+seed, e confirmei por SQL (João 9 chunks, Marta 7, contradição presente) **e** no app real (login `filipa@iris.tech`, naveguei candidato→transcrição, snapshot confirma tudo renderizado). Zero achismo — cada fala tem falante+minuto.
4. **Rename Vera → IRIS (web) — commit `fc6fb65`:** todas as strings/títulos/labels visíveis → IRIS (Sidebar, `<title>`, "Perguntar à IRIS", etc.). Identificadores internos (`VeraAvatar`/`VeraState`/`role:'vera'`) ficam como nome de código (padrão hermes→Lince). **Zero "Vera" visível na web.**
5. **OpenRouter pronto (Onda D) — já estava feito e confirmado:** `apps/web/lib/ai.ts` `aiOptions()` — sem `OPENROUTER_API_KEY` corre **mock €0**; com a chave usa `createOpenRouterTransport` real (defaults haiku-4-5/opus-4-8/sonnet-4-6, gate ZDR). **Amanhã é só colar a chave no `.env`** — nada a reescrever.

Todos os passos: typecheck + lint verdes antes de cada commit.

## 🤝 O que o Codex fez (desktop + ws) — eu integrei e verifiquei
- **Overlay**: botão **"Fechar"** + dot **🔴 "A gravar"** + dot de ligação (queixas 2 e 5 ✅), cliente WebSocket real com handshake JWT + reconnect (cai no mock golden sem URL).
- **Login** do desktop (janela própria antes do overlay) + **deep-link `vera://interview/{id}?token=&wsUrl=`** — a web pode **lançar o overlay** com o contexto da entrevista (início da ligação app↔web, queixa 6).
- **Tray**: `vera:status` atualiza o tooltip (a ouvir 🔴 / em espera), `window-all-closed` removido (não fecha por acidente), `skipTaskbar:true`.
- Eu corrigi um **erro real** que uma edição concorrente introduziu (frame WS validado no boundary com Zod, não cast) — o build voltou a verde.

## ⚠️ O que FALTA (priorizado) — honesto
**Desktop (área ativa do Codex — não mexi para não colidir):**
- **A1 — iniciar/reabrir a entrevista pelo tray.** Hoje "Terminar" fecha o overlay (`overlay.close()`) e no Windows **não há item de tray para reabrir/iniciar** — só via deep-link da web. Falta "Iniciar entrevista (teste)" / "Mostrar a IRIS" no tray.
- **Rename do desktop** — o overlay/tray ainda dizem "Vera" (aria "Fechar Vera", título, tray "Vera — copiloto IRIS"). Tem de ser um commit coordenado (renderer+preload+main+css acoplados ao hit-test). Recomendo fazê-lo quando o Codex parar de editar o desktop.
- **A2** — o overlay auto-arranca a demo no mount (devia ficar "em espera" até iniciar).

**Backend (eu, opcional):** orquestrador realtime→ws (C2) e filtro do broadcast por `interviewId` (C7) — o Codex está agora no `apps/ws`, por isso deixei para evitar colisão.

**Pago (Fase Ω, handover do Mateus):** STT real (Soniox/LiveKit), Exa/Brave, embedder — ver `KEYS-TODO.md`. O teste corre 100% sem isto.

## 🧪 Como testar (como a Filipa)
1. Docker já tem `vera-db` up. Migrate+seed:
   `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev pnpm --filter @rh/db db:migrate && pnpm --filter @rh/db db:seed`
2. Web: `pnpm --filter web dev` (porta 3000). Login: **`filipa@iris.tech`** / qualquer password (modo dev).
   - **Nota:** criei um `apps/web/.env.development.local` TEMPORÁRIO que força modo mock (sem Supabase) para testar sem o GoTrue. **Apaga-o** para voltar ao modo Supabase normal (ou deixa, é gitignored).
3. Candidatos → **João Demonstração** ou **Marta Ferreira** → secção "Entrevistas" → "Ver transcrição". A da **Marta** mostra a contradição "⚠ vs CV".
4. Desktop (precisa de Electron real, não testável headless): `node apps/desktop/build.mjs && pnpm exec electron .` (matar instâncias por path `*rh-automacao*`, não o VS Code).

## Próximo passo recomendado
1. Tu testas a transcrição na web (deve estar ótima).
2. Coordenar com o Codex o **fecho do desktop**: A1 (iniciar/reabrir no tray) + rename → e aí o desktop fica redondo.
3. Quando tiveres crédito OpenRouter, colas a chave e a IA fica real sem mais nada.
