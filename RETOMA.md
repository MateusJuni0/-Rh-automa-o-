# RETOMA — começa aqui (sessão nova)

> Handoff do loop de fecho de gaps da Vera. Lê isto + o **topo do `BUILD-LOG.md`** (tem a fila completa + os contratos exatos de cada fatia que falta). Detalhe total: `~/.claude/sessions/2026-06-21-vera-gaps-loop-session.tmp`.

## Estado (2026-06-21)
- Branch **`phase3/product`**, HEAD `89c54eb`, tudo pushed, árvore limpa.
- **8 fatias de gaps FEITAS + verdes:** bug-dos-cliques (loading.tsx) · #4 consentimento · #1 Q&A por entidade (Tela 8) · #2 onboarding (Tela 11) · #5 purga RGPD (rota) · #6 Camada A (hash-chain) · #7 destilação durável · #9 SSRF · #3 intake confirm UI.
- **Verde:** 173 testes (44 ficheiros) · `next build` · typecheck · Biome · smoke das 9 rotas → 200, zero erros.

## ⚠️ Regras que NÃO podes esquecer
- **NÃO recriar `apps/web/app/loading.tsx`** — era a causa do "bug dos cliques" em produção (boundary Suspense raiz + force-dynamic faz o `next start` engolir a navegação ~50%). Servidor é `next start` SEM ele.
- v1 LOCKED: **single-tenant, MOCKS, zero chaves.** Não ligar integrações reais.
- Disciplina por fatia: karpathy → TDD onde aplicável → typecheck/Biome/`next build` verdes → review adversarial (code-reviewer) → commit em `phase3/product` → atualiza `BUILD-LOG.md`.
- O heartbeat autónomo (cron/ScheduleWakeup) **não dispara** neste setup — continuação é por nudge.

## ▶️ PRÓXIMA fatia: #5b — anonimizar a cascata RGPD (SENSÍVEL)
`apps/web/lib/rgpd.ts purgeCandidate` hoje **hard-deleta** `placement_outcome`/`client_verdict` (o ground-truth da calibração). Contrato (DATA-RETENTION §3.2/§6 + TESTES-ACEITACAO §277): **candidato apagado = ANONIMIZAR**:
1. MANTER a linha do candidato; carimbar `anonymized_at`, limpar `name`/`profile`/`linkedinUrl`/`nameNormalized`.
2. **PRESERVAR** `placement_outcome` + `client_verdict` (sem PII) → não apagar o `process` (FK); nullar `client_verdict.report_id` ANTES de apagar os reports; limpar `process.consent_evidence_ref`/`status_reason`.
3. **REDIGIR** `assistant_action` (não apagar a linha — preserva auditoria).
4. **ATUALIZAR** `apps/web/test/rgpd.integration.test.ts` (hoje afirma candidate:0/process:0 — passa a candidate:1 anonimizado/process:1, verdict/outcome preservados, PII a 0).
Ler DATA-RETENTION §3.2/§6 + TESTES-ACEITACAO §277 antes de tocar.

Depois: **#8** serialização família G (ARQ §11.1 — CAS de encerramento + fila de re-atribuição + advisory-lock) e a **P2** (`realtime-config.ts`, selector no Comparar, LinkedIn+dedup, crons retenção, webhook Telegram, vaga por PDF, ligar persistChunk/distillFinal ao TickEngine).

## Ambiente
```
cd C:\Users\mjnol\.openclaw\workspace\projects\rh-automacao   # phase3/product
docker compose -f docker-compose.dev.yml --profile supabase up -d   # se DB :5433 desligado
cd apps/web && TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev npx vitest run   # testes
cd <root> && PORT=3000 pnpm --filter web start   # server (login filipa@iris.tech / DevSmoke!2026)
```
