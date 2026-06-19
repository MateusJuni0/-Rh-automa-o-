# BUILD-LOG — Fase 3 (Vera)

> Diário do loop de construção. Cada iteração regista: **o que fez · o que passou (build/testes/review)
> · o que falta · bloqueios/spikes para o Mateus**. O Mateus lê isto de manhã. Mais recente no topo.

**Estado inicial (pré-build):** spec 100% provada (13 famílias A–M, 35 tabelas). Nada de código ainda.
Próximo: branch `phase3/build` → scaffold monorepo → `packages/db` (schema das 35 tabelas) com TDD.
Método e regras: `PROMPT-FASE-3-LOOP.md` + `FASE-3-ARRANQUE.md`.

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
