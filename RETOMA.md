# RETOMA — começa aqui (sessão nova)

> Handoff do loop de fecho de gaps da Vera. Lê isto + o **topo do `BUILD-LOG.md`** (tem a fila completa + os contratos exatos de cada fatia que falta). Detalhe total: `~/.claude/sessions/2026-06-21-vera-gaps-loop-session.tmp`.

## Estado (2026-06-22)
- Branch **`phase3/product`**, HEAD `ec61091`, tudo pushed, árvore limpa.
- **10 fatias de gaps FEITAS + verdes:** bug-dos-cliques (loading.tsx) · #4 consentimento · #1 Q&A por entidade (Tela 8) · #2 onboarding (Tela 11) · #5 purga RGPD (rota) · **#5b anonimizar a cascata RGPD** · **#8 serialização família G (§11.1)** · #6 Camada A (hash-chain) · #7 destilação durável · #9 SSRF · #3 intake confirm UI.
- **Verde:** 178 testes (45 ficheiros) · `next build` · typecheck · Biome (365 fich.).

## ⚠️ Regras que NÃO podes esquecer
- **NÃO recriar `apps/web/app/loading.tsx`** — era a causa do "bug dos cliques" em produção (boundary Suspense raiz + force-dynamic faz o `next start` engolir a navegação ~50%). Servidor é `next start` SEM ele.
- v1 LOCKED: **single-tenant, MOCKS, zero chaves.** Não ligar integrações reais.
- Disciplina por fatia: karpathy → TDD onde aplicável → typecheck/Biome/`next build` verdes → review adversarial (code-reviewer) → commit em `phase3/product` → atualiza `BUILD-LOG.md`.
- O heartbeat autónomo (cron/ScheduleWakeup) **não dispara** neste setup — continuação é por nudge.

## ✅ FEITAS recentemente (detalhe no topo do `BUILD-LOG.md`)
- **#5b** (`8f4c51e`) — apagar candidato = **ANONIMIZAR** (preserva calibração sem PII; report anonimizado in-place, spec §4/§6). 0 CRITICAL no review.
- **#8** (`ec61091`) — serialização família G (§11.1): guard do escritor único pós-encerramento (`persistTick`/`persistChunk` com FOR UPDATE → recusam pós-`done`) + `withCandidateLock` (advisory lock por candidate) + contador de ticks monótono. **Fila de re-atribuição (§11.1/2) diferida p/ Ω** (precisa do worker realtime). 0 CRITICAL.

## ▶️ PRÓXIMA: P2 — gaps menores, escolher por valor/demonstrabilidade
**v1-construíveis (sem chave):** selector no Comparar (UI) · candidato por LinkedIn+dedup (mock extração) · vaga por PDF (unpdf, como o CV) · contexto ativo do assistente (`active_context`) · crons de retenção (funções de purga por TTL testáveis; o *agendamento* é Ω).
**Dependem de chave/infra (Ω):** `realtime-config.ts` (LiveKit/Soniox) · webhook Telegram (secret) · ligar `persistChunk`/`distillFinal` ao TickEngine (STT real).
TDD + review adversarial por fatia, como nas anteriores.

## Ambiente
```
cd C:\Users\mjnol\.openclaw\workspace\projects\rh-automacao   # phase3/product
docker compose -f docker-compose.dev.yml --profile supabase up -d   # se DB :5433 desligado
cd apps/web && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev npx vitest run   # testes
cd <root> && PORT=3000 pnpm --filter web start   # server (login filipa@iris.tech / DevSmoke!2026)
```
