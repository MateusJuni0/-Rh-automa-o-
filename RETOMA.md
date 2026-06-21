# RETOMA — começa aqui (sessão nova)

> Handoff do loop de fecho de gaps da Vera. Lê isto + o **topo do `BUILD-LOG.md`** (tem a fila completa + os contratos exatos de cada fatia que falta). Detalhe total: `~/.claude/sessions/2026-06-21-vera-gaps-loop-session.tmp`.

## Estado (2026-06-21)
- Branch **`phase3/product`**, HEAD `eb51b6e` (`8f4c51e` #5b + `eb51b6e` chore format). **Committado localmente — ⚠️ PUSH PENDENTE do OK do Mateus.**
- **9 fatias de gaps FEITAS + verdes:** bug-dos-cliques (loading.tsx) · #4 consentimento · #1 Q&A por entidade (Tela 8) · #2 onboarding (Tela 11) · #5 purga RGPD (rota) · **#5b anonimizar a cascata RGPD** · #6 Camada A (hash-chain) · #7 destilação durável · #9 SSRF · #3 intake confirm UI.
- **Verde:** 173 testes (44 ficheiros) · `next build` · typecheck · Biome (363 fich.).

## ⚠️ Regras que NÃO podes esquecer
- **NÃO recriar `apps/web/app/loading.tsx`** — era a causa do "bug dos cliques" em produção (boundary Suspense raiz + force-dynamic faz o `next start` engolir a navegação ~50%). Servidor é `next start` SEM ele.
- v1 LOCKED: **single-tenant, MOCKS, zero chaves.** Não ligar integrações reais.
- Disciplina por fatia: karpathy → TDD onde aplicável → typecheck/Biome/`next build` verdes → review adversarial (code-reviewer) → commit em `phase3/product` → atualiza `BUILD-LOG.md`.
- O heartbeat autónomo (cron/ScheduleWakeup) **não dispara** neste setup — continuação é por nudge.

## ✅ #5b FEITA (`8f4c51e`) — anonimizar a cascata RGPD
`purgeCandidate` deixou de hard-deletar tudo: apagar candidato = **ANONIMIZAR** (DATA-RETENTION §3.2/§6). Preserva o ground-truth sem PII (`client_verdict`/`placement_outcome`/`report` anonimizado/`interview` do parecer/`interview_tick` com custo §1.6), redige a auditoria (`assistant_action`+`intake_session`), apaga a PII bruta, anonimiza o candidato (âncora). **Nota:** divergi do plano antigo (que dizia "apagar reports") — segui a spec literal §4/§6 ("report existe sem PII") e anonimizei o report in-place. Review adversarial 0 CRITICAL. Detalhe no topo do `BUILD-LOG.md`.

## ▶️ PRÓXIMA fatia: #8 — serialização família G (ARQ §11.1) (COMPLEXO)
Encerramento de processo com **CAS** (compare-and-set sobre `process.stage`/`closed_at`) + **fila de re-atribuição** de candidatos + **advisory-lock por candidate** (evita corridas em re-atribuição concorrente). Ler **ARQUITETURA-TEMPO-REAL §11.1** + **MODELO-DADOS** família G antes de tocar; mapear o que já existe (`process.stage`/`closedAt`, `async_job`) vs o que falta. TDD + review adversarial como nas anteriores.

Depois: **P2** (`realtime-config.ts`, selector no Comparar, LinkedIn+dedup, crons retenção, webhook Telegram, vaga por PDF, contexto ativo do assistente, ligar `persistChunk`/`distillFinal` ao TickEngine).

## Ambiente
```
cd C:\Users\mjnol\.openclaw\workspace\projects\rh-automacao   # phase3/product
docker compose -f docker-compose.dev.yml --profile supabase up -d   # se DB :5433 desligado
cd apps/web && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev npx vitest run   # testes
cd <root> && PORT=3000 pnpm --filter web start   # server (login filipa@iris.tech / DevSmoke!2026)
```
