# RETOMA — começa aqui (sessão nova)

> Handoff do loop de fecho de gaps da Vera. Lê isto + o **topo do `BUILD-LOG.md`** (tem a fila completa + os contratos exatos de cada fatia que falta). Detalhe total: `~/.claude/sessions/2026-06-21-vera-gaps-loop-session.tmp`.

## Estado (2026-06-22)
- Branch **`phase3/product`**, HEAD `7cf6e28` (+ docs), tudo pushed, árvore limpa.
- **15 fatias de gaps FEITAS + verdes:** bug-dos-cliques (loading.tsx) · #4 consentimento · #1 Q&A por entidade (Tela 8) · #2 onboarding (Tela 11) · #5 purga RGPD (rota) · **#5b anonimizar a cascata RGPD** · **#8 serialização família G (§11.1)** · **dedup de candidatos (P2)** · **selector no Comparar (P2)** · **vaga por PDF (P2)** · **contexto ativo do assistente (P2)** · **crons de retenção por TTL (P2)** · #6 Camada A (hash-chain) · #7 destilação durável · #9 SSRF · #3 intake confirm UI.
- **Verde:** 229 testes (51 ficheiros) · `next build` · typecheck · Biome.
- **✅ Todos os P2 v1-construíveis (sem chave) FEITOS.** O que resta é só **Fase Ω** (depende de chaves/infra) — ver abaixo.

## ⚠️ Regras que NÃO podes esquecer
- **NÃO recriar `apps/web/app/loading.tsx`** — era a causa do "bug dos cliques" em produção (boundary Suspense raiz + force-dynamic faz o `next start` engolir a navegação ~50%). Servidor é `next start` SEM ele.
- **NÃO correr `next build` com o `next dev`/`next start` a correr** — partilham `apps/web/.next` e corrompem-se (erros `Cannot find module './NNNN.js'` + manifest → 500 no dev). Para verificar build, **pára o server primeiro**, ou usa `.next` separado. Recuperação: parar o server → `rm -rf apps/web/.next` → rearrancar.
- v1 LOCKED: **single-tenant, MOCKS, zero chaves.** Não ligar integrações reais.
- Disciplina por fatia: karpathy → TDD onde aplicável → typecheck/Biome/`next build` verdes → review adversarial (code-reviewer) → commit em `phase3/product` → atualiza `BUILD-LOG.md`.
- O heartbeat autónomo (cron/ScheduleWakeup) **não dispara** neste setup — continuação é por nudge.

## ✅ FEITAS recentemente (detalhe no topo do `BUILD-LOG.md`)
- **#5b** (`8f4c51e`) — apagar candidato = **ANONIMIZAR** (preserva calibração sem PII; report anonimizado in-place, spec §4/§6). 0 CRITICAL no review.
- **#8** (`ec61091`) — serialização família G (§11.1): guard do escritor único pós-encerramento (`persistTick`/`persistChunk` com FOR UPDATE → recusam pós-`done`) + `withCandidateLock` (advisory lock por candidate) + contador de ticks monótono. **Fila de re-atribuição (§11.1/2) diferida p/ Ω** (precisa do worker realtime). 0 CRITICAL.

## ▶️ PRÓXIMA: só falta a FASE Ω (depende de chaves/infra — fora do v1 LOCKED)
**✅ v1-construíveis TODOS FEITOS:** ~~dedup de candidatos~~ (`81027e9`) · ~~selector no Comparar~~ (`ac4524b`) · ~~vaga por PDF~~ (`327e390`) · ~~contexto ativo do assistente~~ (`648fd99`) · ~~crons de retenção por TTL~~ (`7cf6e28`).

**Fase Ω — precisa de chave/infra (NÃO fazer em v1 LOCKED, é só quando o Mateus ligar as chaves):**
- `packages/core/realtime-config.ts` (LiveKit/Soniox — STT/áudio ao vivo)
- webhook Telegram (secret) + intake real por Telegram
- ligar `persistChunk`/`distillFinal` ao **TickEngine** (alimentar a Camada A com STT real)
- fila de re-atribuição da família G (§11.1/2 — precisa do worker realtime)
- **agendar** os crons de retenção (timers diários + monitor "correu nas últimas 24h") e ligar a cascata Storage/RAG; redigir `transcript_chunk.text` (migração: `text` nullable + `redacted_at`)
- restantes integrações com chave: envio de email, biometria facial, RAG vetorial, calendário Google

> Quando o Mateus ligar as chaves: ler `KEYS-TODO.md`. Até lá, **não há mais nada construível em v1** sem mocks novos — a jornada Triagem→Briefing→Entrevista→Parecer + os fluxos human-in-the-loop estão demonstráveis. TDD + review adversarial por fatia, como nas anteriores.

## Ambiente
```
cd C:\Users\mjnol\.openclaw\workspace\projects\rh-automacao   # phase3/product
docker compose -f docker-compose.dev.yml --profile supabase up -d   # se DB :5433 desligado
cd apps/web && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev npx vitest run   # testes
cd <root> && PORT=3000 pnpm --filter web start   # server (login filipa@iris.tech / DevSmoke!2026)
```
