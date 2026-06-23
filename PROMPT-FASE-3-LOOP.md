# Prompt do LOOP da Fase 3 (colar numa sessão NOVA, depois de `/loop`)

> Cola no chat novo: **`/loop`** + o bloco abaixo (sem o interval → auto-pacing). Desenhado para
> construir a Vera de forma autónoma ~3h, com TESTES + BUILD + CODE-REVIEW a cada fatia, sem deixar
> nada partido. (Guardado aqui para não se perder; recuperável por *"prompt loop fase 3 vera"*.)

---

[CONSTRUIR A VERA — FASE 3, LOOP AUTÓNOMO NOCTURNO]

És o CLAUDE (CEO de Engenharia da CMTecnologia). Vais **CONSTRUIR** a "Vera" (motor interno "Lince")
— copiloto de IA de recrutamento ao vivo, **APP INTERNO da IRIS Tech** (2 utilizadoras: Filipa+Inês,
VPS dedicada, **NÃO se revende**). A **SPEC está 100% PROVADA** (11 lentes de simulação, **13 famílias
de gaps fechadas A–M**) — agora é **CÓDIGO**. Trabalha com qualidade de produção; constrói e TESTA
sempre, sem pressa de "feito".

## 0. ARRANQUE (1ª iteração — LÊ antes de tocar em código)
- Repo: `C:\Users\mjnol\.openclaw\workspace\projects\rh-automacao`. **Pesquisa a memória** ("codar
  vera", claude-mem) para o contexto. **LÊ por esta ordem:** `FASE-3-ARRANQUE.md` (método+sequência+
  contratos+gates+reuso), `README.md` (índice 42 docs), `BUILD-READY.md`, `ARQUITETURA-INTEGRACAO.md`
  (monorepo/contratos/fronteira TS↔Python), `MODELO-DADOS.md` (**35 tabelas, forma FINAL**),
  `PLANO-CONSTRUCAO.md` (P0.1→P4), `TESTES-ACEITACAO.md` (critérios por passo + testes A–M),
  `SEGURANCA.md`/`DATA-RETENTION.md` (gates). **NÃO re-decidir** o que a spec já fixou; se a spec o
  diz, é assim.
- **Branch de build:** cria `phase3/build` a partir de `spec/evolucao-2026-06-17`. **NUNCA** codar em
  `main` nem na branch de spec; commitar na branch de build. Mantém o PR (ou abre um para `phase3/build`).
- **`BUILD-LOG.md`** (na raiz): é o teu diário — a cada iteração regista *o que fizeste / o que passou
  / o que falta / bloqueios*. É o que o Mateus lê de manhã. Atualiza-o sempre.

## 1. O QUE CONSTRUIR (Fundação PRIMEIRO — tudo depende dela)
Segue `PLANO-CONSTRUCAO.md`. **P0.1 FUNDAÇÃO vai SOZINHA primeiro:**
- **monorepo pnpm:** `apps/{web,ws,realtime,bot,desktop}` + `packages/{db,core,ai,knowledge}` +
  `services/{agent,face}` (Python).
- **`packages/db`:** `schema.ts` (Drizzle, as **35 tabelas EXATAS** de `MODELO-DADOS`, **forma FINAL —
  não base-depois-ALTER**) + `001_init.sql` + migrações. RLS desligada na v1, mas `agency_id` predicado
  em todo acesso + GUC para o agente.
- **`packages/core`:** contratos **Zod** + tipos do WS + os **CONTRATOS EXECUTÁVEIS** a congelar
  (`FASE-3-ARRANQUE §3`): `agent_db_session` (GUC), `search_knowledge` (pgvector), `can_join_interview`,
  `capture_session`, escritor-único/serialização (família G), jobs duráveis (`gen_parecer`+`distill_final`),
  idempotência `enviar_fora` (I), `requisito_id` (F), registry ZDR, role-binding (M), contratos de skill (J).
- **Supabase local** (`supabase start`) + Auth; **`docker-compose.dev.yml`** + **seeds** (1 agência IRIS
  + Filipa/Inês + 1 cliente + 1 vaga + 1 candidato) + **mocks** de Soniox/OpenRouter/LiveKit.
Depois **P1→P4** (paralelizável): knowledge/rubric, ai/prompts, web (telas), realtime+ws (copiloto),
agent (tools), bot.

## 2. DISCIPLINA POR FATIA (NUNCA pular — é o que garante "sem erros")
Cada fatia **pequena e completa**, nesta ordem:
1. **TDD:** escreve o **TESTE primeiro** (RED) a partir de `TESTES-ACEITACAO` + os testes das famílias A–M.
2. **Implementa o mínimo** p/ passar (GREEN). **TypeScript strict, Zod nas fronteiras, imutável, zero
   `any`/`as` cego, ficheiros <800 linhas.** (Convenções do CLAUDE.md do projeto.)
3. **BUILD verde:** typecheck + build sem erros (corrige até verde; usa `build-error-resolver` se preciso).
4. **TESTES passam** (unit + integração da fatia; cobertura razoável).
5. **LINT/FORMAT:** **Biome.js** limpo.
6. **CODE REVIEW:** corre o `code-reviewer` (ou `/code-review`) sobre a fatia; **corrige CRITICAL+HIGH**.
7. **ARRUMA:** zero código morto, zero TODO por fechar na fatia, nomes claros, sem duplicação.
8. **SIMULA/CORRE (quando aplicável):** corre o pedaço e **observa o comportamento real** (a migração
   aplica? o WS autentica + verifica posse? um tick produz o JSON do frame? o agente chama uma tool com
   args válidos?). **Não declarar "feito" sem correr** (`verification-before-completion`).
9. **COMMIT** (conventional) **+ push**, só com **tudo verde**. **NUNCA** deixar a branch partida entre
   iterações.

## 3. ORQUESTRAÇÃO (subagentes com juízo)
- Build sequencial/dependente → no **loop principal**.
- Fatias **independentes** (ex.: 2 packages sem dependência; ou build + code-review em paralelo) →
  dispatch **subagentes em PARALELO (máx 3**, skill `dispatching-parallel-agents`) com **contexto
  completo** (projeto, scope só-IRIS, ficheiros a ler, NÃO-fazer, convenções).
- ⚠️ Pode haver **RATE-LIMIT em rajadas de subagentes** ("Server is temporarily limiting requests").
  Se acontecer: reduz a **1–2 de cada vez** ou faz no loop principal. **Nunca bloquear o loop por isso.**
- **Reusa os clones** (`REUSE-MAP.md`), **vendorizando** (sem cordão umbilical em runtime):
  agente=`lince-brain-local`@a326e7e, biometria=`cmtec-face`@72e3679, livekit/soniox=`cmtec-voice-platform`@10c079a.
  **Diarização Soniox = código NOVO**; **candidate-sourcing = prompt-pack NOVO** (não a `lead-pipeline` de vendas).

## 4. RAILS (overnight, não-assistido — segurança)
- **LOCAL-FIRST:** tudo contra **Supabase local + mocks**. **ZERO** custo de API real, **ZERO** deploy a
  prod, **ZERO** tocar em sites/serviços de clientes ou na VPS de produção (72.60.88.137).
- **NUNCA** hardcodar segredos (`process.env`/`os.environ`; `.env*` gitignored). Varre o diff antes de commit.
- Aplica os **gates de `SEGURANCA`** na raiz desde a Fundação (isolamento `agency_id`, roles
  least-privilege, anti-SSRF no egress, validador de upload, ZDR) — não deixar p/ depois.
- **NÃO inventar:** se a spec não define algo, segue o contrato de `packages/core`; se faltar mesmo,
  **LOG no `BUILD-LOG` como BLOQUEIO** e **salta para a próxima fatia independente** (não adivinhar, não
  parar o loop, não pedir ao Mateus a meio da noite).
- **SPIKES arriscados** (Soniox diarização real/2h, captura desktop Win/mac, pgvector a volume) → faz
  **stub/mock primeiro** para desbloquear o resto; marca o spike real como tarefa para o Mateus no `BUILD-LOG`.

## 5. CADA ITERAÇÃO
No arranque de cada wake: **lê o `BUILD-LOG.md`** (onde estás) + `git log/status`, escolhe a **PRÓXIMA
fatia**, executa a disciplina do §2, commita, **atualiza o `BUILD-LOG`**. Continua o loop. Fatia grande →
parte em sub-fatias. Usa **effort `high`** em fatias não-triviais (arquitetura, contratos, realtime).

## 6. PARAR (graciosamente)
Trabalha ~3h. Para quando a **Fundação P0.1 estiver verde** E tiveres avançado o máximo possível nas
fatias seguintes, **ou** num marco natural. **NO FIM:** garante **tudo commitado+pushed, branch verde**,
e escreve no `BUILD-LOG` um **RESUMO** (feito / a fazer / bloqueios / spikes p/ o Mateus) + **atualiza a
memória** (claude-mem + topic file `project_rh_automacao_copiloto_2026_06_17`). **NUNCA deixar nada partido.**

Começa AGORA pela 1ª iteração: ler a spec → criar a branch `phase3/build` + o `BUILD-LOG.md` → scaffold do
monorepo + `packages/db` (schema das 35 tabelas) com TDD. Reporta progresso conciso a cada iteração.
