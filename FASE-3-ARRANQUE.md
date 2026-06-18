# Fase 3 — Arranque (começar AQUI na sessão de código)

> **Estado (2026-06-19):** Fase 1 (cérebro) + Fase 2 (embalagem) + **simulação de prova
> COMPLETA** (11 lentes, 9 famílias de gaps fechadas A–I). Spec **código-pronta**. Este doc é o
> ponto de partida da Fase 3 — lê isto + o `README.md` (índice) + `BUILD-READY.md` antes de codar.
> **Scope LOCKED:** app interno da IRIS Tech, 2 utilizadoras (Filipa + Inês), VPS dedicada, sem revenda.

---

## 1. Método de construção — BUILD + SIMULAÇÃO AO VIVO (pedido do Mateus)

Constrói-se **incremental, com teste/simulação em tempo real a cada fatia** — apanhar bugs à
medida que se constrói, não no fim:

1. **Ambiente local primeiro** (`INFRA-E-MIGRACAO §8`): `docker-compose.dev` sobe web+ws+realtime+
   agent+face+Supabase local; **mocks** de Soniox/OpenRouter/LiveKit + **seed** (1 agência IRIS +
   Filipa/Inês + 1 cliente + 1 vaga + 1 candidato) → simular **sem custo de API**.
2. **TDD por fatia** (`TESTES-ACEITACAO.md` já tem os critérios por passo P0→P4): teste primeiro
   (RED) → implementa (GREEN) → refatora. Os testes das **famílias A–I** (TESTES, blocos da
   simulação) são a **suíte de regressão adversarial**.
3. **Simular ao vivo a cada fatia:** correr a app e passar uma **entrevista simulada** pelo pipeline
   real (transcrição mock → frame → sugestão → parecer) + um **pedido composto** pelo agente
   (sourcing→comparar→parecer→email) → ver o comportamento, arrumar bugs **na hora**.
4. **Verde antes de avançar** (`verification-before-completion`): cada passo só fecha com os
   critérios de aceitação a passar. Nunca declarar "feito" sem correr e observar.
5. **Custo real só no fim de cada carril:** subir os slots a modelos a sério + 1 entrevista real
   (Soniox+ticks) para validar custo 2h (gate B6) antes de mostrar à Filipa.

---

## 2. Sequência (de `PLANO-CONSTRUCAO.md`)

- **P0.1 — Fundação (PRIMEIRO, sozinho):** monorepo (`apps/{web,ws,realtime,bot,desktop}` +
  `packages/{db,core,ai,knowledge}` + `services/{agent,face}`); `packages/db/schema.ts` (Drizzle, as
  **34 tabelas** de `MODELO-DADOS`) + `001_init.sql`; `packages/core` (contratos Zod + tipos WS);
  Supabase Auth; docker-compose.dev + seeds + mocks. **Tudo o resto depende disto.**
- **P1–P4 (depois, paralelizável):** conhecimento/rubric · ai/prompts · web (telas) · realtime+ws
  (copiloto ao vivo) · agente (tools) · bot. Carris e ordem em `PLANO-CONSTRUCAO.md` + `ARQUITETURA-INTEGRACAO.md`.

---

## 3. Contratos EXECUTÁVEIS a congelar no P0.1 (de `packages/core`/`authz`)

Não são "o modelo decide" — são contratos a materializar **antes** de construir em cima:

- **`agent_db_session(agency_id, actor_id)`** — wrapper OBRIGATÓRIO: transação curta + `SET LOCAL
  app.agency_id` + reset garantido no pool (o agente Python não pode furar o isolamento). `SEGURANCA §1`.
- **`search_knowledge(agency_id, scope, embedding, filters)`** — RAG em **pgvector** (não Chroma
  global); ninguém faz vector-search manual. `MODELO §15.9`.
- **`can_join_interview(actor, interview_id)`** — autorização do WS ao vivo (cobre `process_id` nulo
  cold-start). `AUTH-CONTRACT`.
- **Escritor único + serialização (família G)** — `apps/realtime` possui TODO o estado vivo;
  correções/re-atribuição ENFILEIRAM; encerramento por **compare-and-set** sobre `interview.status`;
  entidade-candidato global por advisory lock por `candidate_id`. `ARQUITETURA-TEMPO-REAL §11.1`.
- **Jobs duráveis** — `gen_parecer` **e** `distill_final` (família H): `async_job` com
  status/retry/idempotente por `interview_id`; `interview.distilled_at` = gate da purga de áudio. `MODELO §16.B/H`.
- **Idempotência de `enviar_fora` (família I)** — `idempotency_key`+`provider_message_id` em
  `assistant_action`; estado ambíguo = `unknown` (não re-envia auto). `MODELO §16.I`, `AGENTE-TOOLS A.2`.
- **`requisito_id` canónico (família F)** — frame/sugestão/cobertura/parecer/contradição keiam por id,
  não texto. `MODELO §16.F`.
- **Registry de modelos com ZDR** (`zdr`/`stores_audio`/`stores_text`/`allowed_for_pii`) — deploy
  falha se um slot com PII apontar a provider sem retenção-zero. `SEGURANCA §7`, `MODELOS-E-API §3`.
- **Hierarquia de identidade de falante** (`speaker_source`/`speaker_confidence`/`corrected_by`;
  active-speaker ≠ prova). `MODELO §16.A`.

---

## 4. Gates antes de ENTREGAR com PII real / pôr a Filipa (não impedem codar)

`SEGURANCA §12` + `README` "Portas": isolamento `agency_id`+roles least-privilege · anti-SSRF (egress
namespace, incl. Playwright) · validador único de upload · bucket Storage privado+signed URLs · cifra
em repouso + backups cifrados off-VPS · ZDR (OpenRouter+Soniox+embedder) · rate-limit/lockout +
anti-spoof facial ON · DATA-RETENTION (cron de purga + `distilled_at`) · provar custo 2h (B6) ·
Cyber Neo `--redteam` em staging (`engagement-scope.yml`).

## 5. Spikes (validar CEDO, antes de feature)

Soniox real (diarização/`speaker_id`/2h/reconnect — **trabalho NOVO**, `REUSE-MAP §3`) · captura
desktop Win/macOS + LiveKit · pgvector com filtro+purga em volume · ambiente dev local (`make dev`).

---

## 6. Reuso (de onde clonar — `REUSE-MAP.md`)

Agente = `lince-brain-local` @a326e7e (NÃO o stub `hermes`) · biometria = `painel-cmtec/services/
cmtec-face` @72e3679 (resolver bug enroll na origem ANTES de clonar) · LiveKit/Soniox =
`cmtec-voice-platform/agents` @10c079a (diarização = código novo). **Clonar = instância própria, sem
cordão umbilical.** Skills (sourcing Apify, docx/xlsx/pdf) invocam-se, não se vendorizam.

> **Regra de ouro:** o build cria já a **forma FINAL** do schema (`MODELO-DADOS` Guia de
> consolidação), não base-depois-ALTER. As 9 famílias (A–I) são ADIÇÕES a essa base canónica.
