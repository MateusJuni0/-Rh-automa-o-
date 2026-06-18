# Modelo de Dados — esquema completo Supabase/PostgreSQL

> **Princípios:** multi-tenant desde o dia 1 (RLS por `agency_id`); IDs UUID; timestamps
> com timezone; sem DELETE físico (soft-delete via `deleted_at`); toda evidência tem
> proveniência (quem disse, quando, de onde veio).

---

## 🧭 Guia de consolidação — schema FINAL canónico (LÊ PRIMEIRO, 2026-06-18)

> Este doc tem o **DDL base** + uma secção **"Evolução"** com supersedes/ALTERs. **O
> build NÃO faz base-depois-ALTER — cria já a forma FINAL.** Aplica estas resoluções ao
> escrever o schema Drizzle (uma só fonte de verdade):

1. **`process` é a chave do ciclo.** `interview`, `client_verdict`, `placement_outcome`
   nascem com **`process_id NOT NULL`** e **SEM** `job_id`/`candidate_id` (derivam de `process`).
2. **`candidate_memory_fact.job_id` → `process_id`** (NULL = facto geral, reutilizável).
3. **`candidate` global** (talent pool) + **`anonymized_at`** (apagar = anonimizar, mantém `placement_outcome` sem PII).
4. **`document` +`candidate_id`/`version`/`is_current`/`source`** — vários CVs por candidato + CVs gerados + relatórios (§9).
5. **`rubric.criteria`** inclui `peso`/`origem`/`origin_criteria_id`; **+`version`** (versionamento mid-process); `report.rubric_version`.
6. **`assistant_action` +`efeito`** (`leitura|gravar|enviar_fora`); `recruiter_memory_fact`(+emb) p/ a memória da Vera.
7. **`process` +`consent_status`/`consent_evidence_ref`/`consent_at`**; **`interview.capture_type` aceita `'none'`** (entrevista sem captura — candidato recusou).
8. **`transcript_chunk`** (Camada A, +emb) · **`source_doc`**(+emb, ciclo de pesquisa) · **`client_criteria`** · **`agenda_event`**.
9. **v1 single-tenant:** `agency_id` fica em todas as tabelas (costura p/ v2) mas **SEM RLS** na v1.
10. **pgvector** em todos os `*_embedding` (dimensão = a do EMBEDDER escolhido; default 1536 — `MODELOS-E-API §3`).

> **Total: 34 tabelas** (+ os campos `consent_*` em `process`). Inclui as 4 de embedding
> (candidate/transcript/source/recruiter), o runtime do agente (`assistant_thread`/
> `assistant_message`/`async_job` — §12), `contradiction` (§13), `interview_gap` (§14) e
> `proactive_task` (§16).
> O DDL detalhado de cada uma está abaixo (base + Evolução); esta lista é o **mapa do que é canónico**.

## Diagrama de relações

> **Mudança estrutural (2026-06-17):** o **candidato é uma entidade GLOBAL**
> (talent pool da agência), **não** filho de uma vaga. A ligação candidato↔vaga é o
> **`process`** (candidatura = candidato × vaga). O mesmo candidato participa em
> vários `process` de vários clientes ao longo do tempo. A entrevista pertence ao
> `process`. Detalhe e racional na secção **"Evolução 2026-06-17"** mais abaixo.

```
agency
 ├── recruiter  (liga a auth.users)
 │    └── intake_message            ← msgs encaminhadas (+ alvo/intenção)
 │
 ├── client
 │    ├── client_memory_fact        ← o que aprendemos sobre o cliente (RAG)
 │    ├── client_criteria           ← perguntas/critérios que ESTE cliente sempre faz
 │    └── job (vaga / mandato)
 │         ├── role_profile         ← conhecimento externo por role-type
 │         ├── rubric               ← gabarito (fraco/ok/forte) por requisito
 │         └── document             ← ficheiros do cliente sobre a vaga
 │
 └── candidate  (GLOBAL — talent pool, cross-cliente)
      ├── candidate_memory_fact     ← o que o candidato disse/é (RAG, durável)
      └── process  (candidatura = candidate × job)
           ├── interview
           │    ├── interview_tick       ← estado vivo por tick (+ custo/tokens/modelo — §14)
           │    ├── interview_gap         ← intervalos SEM captura (falha de infra — §14)
           │    ├── transcript_chunk      ← Camada A: transcrição completa + embedding
           │    └── report                ← parecer (versão interna + versão cliente)
           ├── client_verdict            ← veredito do cliente (calibração)
           └── placement_outcome         ← contratou? ficou/saiu na garantia? (ground-truth)
```

---

## DDL — tabelas em ordem de criação

### Fundação

```sql
-- Agência (tenant raiz)
CREATE TABLE agency (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Recrutador (liga a Supabase Auth)
CREATE TABLE recruiter (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id         UUID NOT NULL REFERENCES agency(id),
  user_id           UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  name              TEXT NOT NULL,
  telegram_chat_id  BIGINT UNIQUE,         -- ligado via /start no bot (ver TELEGRAM-BOT-SPEC.md §2)
  telegram_linked_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### Cliente e memória do cliente

```sql
-- Cliente (empresa que contrata)
CREATE TABLE client (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   UUID NOT NULL REFERENCES agency(id),
  name        TEXT NOT NULL,
  notes       TEXT,                   -- notas livres da Filipa
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Factos sobre o cliente (RAG — o que o cliente valoriza)
-- Cada facto tem proveniência: de onde veio e quando
CREATE TABLE client_memory_fact (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES client(id),
  agency_id       UUID NOT NULL,                          -- denormalized para RLS
  fact_text       TEXT NOT NULL,                          -- "cliente valoriza liderança de equipa"
  fact_type       TEXT NOT NULL,                          -- 'preference' | 'rejection_reason' | 'context'
  source_type     TEXT NOT NULL,                          -- 'intake_doc' | 'client_verdict' | 'manual'
  source_ref      TEXT,                                   -- ex.: intake_message.id ou verdict.id
  source_snippet  TEXT,                                   -- trecho original que gerou o facto
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,                            -- NULL = aguarda confirmação da Filipa
  deleted_at      TIMESTAMPTZ
);
```

### Vaga e documentos

```sql
-- Vaga (job opening)
CREATE TABLE job (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL,
  client_id       UUID NOT NULL REFERENCES client(id),
  recruiter_id    UUID NOT NULL REFERENCES recruiter(id),
  title           TEXT NOT NULL,                          -- "Dev Frontend React Pleno"
  role_type_slug  TEXT NOT NULL,                          -- "dev_frontend_react_pleno"
  requirements    JSONB NOT NULL DEFAULT '{}',            -- extraído do documento do cliente
  status          TEXT NOT NULL DEFAULT 'active',         -- 'active' | 'closed' | 'paused'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Documentos ligados à vaga (ou ao cliente)
CREATE TABLE document (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  job_id        UUID REFERENCES job(id),
  client_id     UUID REFERENCES client(id),
  filename      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,                            -- Supabase Storage path
  doc_type      TEXT NOT NULL,                            -- 'job_requirements' | 'candidate_cv' | 'other'
  extracted     JSONB,                                    -- resultado da extração Claude Haiku
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Role Profile (camada de conhecimento externo)

```sql
-- Role Profile — conhecimento do mercado por tipo de role
-- Partilhado dentro da agência; cache 90 dias
CREATE TABLE role_profile (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id             UUID NOT NULL,
  role_type_slug        TEXT NOT NULL,                    -- "dev_frontend_react_pleno"
  competencias          JSONB NOT NULL DEFAULT '[]',      -- [{skill, nivel, obrigatorio}]
  o_que_e_bom           JSONB NOT NULL DEFAULT '{}',      -- {skill: "o que é boa resposta"}
  sinais_nivel_errado   JSONB NOT NULL DEFAULT '[]',      -- ["diz X anos mas não sabe Y"]
  linguagem_filipa      JSONB NOT NULL DEFAULT '{}',      -- {termo_tecnico: "explicação simples"}
  perguntas_chave       JSONB NOT NULL DEFAULT '[]',      -- perguntas que separam níveis
  sources               JSONB NOT NULL DEFAULT '[]',      -- [{url, acedido_em}]
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
  UNIQUE (agency_id, role_type_slug)
);
```

### Candidato e memória do candidato

```sql
-- Candidato
CREATE TABLE candidate (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL,
  name            TEXT NOT NULL,
  linkedin_url    TEXT,
  profile         JSONB NOT NULL DEFAULT '{}',            -- extraído do CV
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Factos da memória do candidato (RAG — o que o candidato disse ou tem)
-- Indexado por competência/requisito; com timestamp da entrevista
CREATE TABLE candidate_memory_fact (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidate(id),
  agency_id       UUID NOT NULL,
  job_id          UUID REFERENCES job(id),                -- a qual vaga pertence (NULL = geral)
  competencia     TEXT NOT NULL,                          -- "React", "liderança", "inglês"
  fact_text       TEXT NOT NULL,                          -- o que disse/demonstrou
  evidence_quote  TEXT,                                   -- trecho da transcrição
  evidence_ts     TEXT,                                   -- timestamp na entrevista (ex: "12:04")
  speaker         TEXT,                                   -- 'candidate' | 'recruiter'
  fact_type       TEXT NOT NULL DEFAULT 'statement',      -- 'statement' | 'skill_demo' | 'gap'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Embedding para RAG (pgvector)
CREATE TABLE candidate_memory_embedding (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id     UUID NOT NULL REFERENCES candidate_memory_fact(id) ON DELETE CASCADE,
  agency_id   UUID NOT NULL,
  embedding   VECTOR(1536) NOT NULL                       -- modelo: text-embedding-3-small ou equiv.
);
CREATE INDEX ON candidate_memory_embedding USING ivfflat (embedding vector_cosine_ops);
```

### Rubric (gabarito de avaliação)

```sql
-- Rubric — gabarito por vaga (gerado por Claude Opus antes da entrevista)
CREATE TABLE rubric (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID NOT NULL REFERENCES job(id) UNIQUE,
  agency_id     UUID NOT NULL,
  criteria      JSONB NOT NULL DEFAULT '[]',
  -- cada critério (shape — fecha o gap G3, inclui origem + peso):
  -- { requisito: "React", pergunta_sonda: "...",
  --   fraco: "diz que sabe mas não explica", ok: "cita hooks", forte: "explica reconciliation",
  --   linguagem_filipa: { fraco: "...", ok: "...", forte: "..." },
  --   peso: "must|normal|nice",
  --   origem: "role_profile|client_criteria|ambos",     -- de onde veio a linha (CAMADA-CONHECIMENTO)
  --   origin_criteria_id: "uuid|null" }                  -- FK lógica p/ client_criteria, se origem inclui cliente
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  model_used    TEXT NOT NULL DEFAULT 'claude-opus-4-8'
);
```

### Entrevista e estado vivo

```sql
-- Entrevista
CREATE TABLE interview (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL,
  job_id          UUID NOT NULL REFERENCES job(id),
  candidate_id    UUID NOT NULL REFERENCES candidate(id),
  recruiter_id    UUID NOT NULL REFERENCES recruiter(id),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'scheduled',       -- 'scheduled' | 'live' | 'done'
  capture_type    TEXT,                                    -- 'bot_online' | 'local_mic'
  livekit_room    TEXT                                     -- room name se bot online
);

-- Ticks do estado vivo (snapshots comprimidos a cada N falas)
-- Não guardamos toda a transcrição crua aqui — vai para candidate_memory_fact
CREATE TABLE interview_tick (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    UUID NOT NULL REFERENCES interview(id),
  tick_n          INT NOT NULL,
  live_state      JSONB NOT NULL,                          -- o estado comprimido naquele tick
  suggestion      JSONB,                                   -- {texto, lente, requisito}
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Relatório / parecer

```sql
-- Relatório gerado no final da entrevista
CREATE TABLE report (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    UUID NOT NULL REFERENCES interview(id) UNIQUE,
  agency_id       UUID NOT NULL,
  content_md      TEXT NOT NULL,                          -- parecer em markdown
  content_edited  TEXT,                                   -- versão editada pela Filipa
  model_used      TEXT NOT NULL DEFAULT 'claude-opus-4-8',
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  exported_at     TIMESTAMPTZ
);
```

### Veredito do cliente (calibração)

```sql
-- O que o cliente disse sobre o candidato após a entrevista
-- É o feedback que calibra a precisão do bot ao longo do tempo
CREATE TABLE client_verdict (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL,
  job_id          UUID NOT NULL REFERENCES job(id),
  candidate_id    UUID NOT NULL REFERENCES candidate(id),
  report_id       UUID REFERENCES report(id),
  verdict         TEXT NOT NULL,                          -- 'approved' | 'rejected' | 'pending'
  reason          TEXT,                                   -- porquê (em linguagem do cliente)
  reason_type     TEXT,                                   -- 'skill_gap' | 'cultural_fit' | 'salary' | 'other'
  bot_predicted   TEXT,                                   -- o que o bot tinha dito ('strong' | 'ok' | 'weak')
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Nota: bot_predicted vs verdict = métrica de precisão que acompanhamos (Parte D de INTAKE-E-JULGAMENTO.md)
```

### Sessão de ingestão multi-mensagem (Telegram)

```sql
-- Sessão de criação de vaga via múltiplas mensagens no Telegram
-- Mantida em Redis (TTL 30 min) para contexto vivo; persistida aqui só ao fechar
-- Ver TELEGRAM-BOT-SPEC.md §7 (Fluxo C)
CREATE TABLE intake_session (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL,
  recruiter_id    UUID NOT NULL REFERENCES recruiter(id),
  telegram_chat_id BIGINT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',    -- 'open' | 'confirmed' | 'cancelled' | 'expired'
  target_entity   TEXT,                            -- 'new_job' | 'existing_job' | 'candidate_cv'
  target_job_id   UUID REFERENCES job(id),         -- preenchido quando Filipa seleciona a vaga
  target_client_id UUID REFERENCES client(id),
  messages_raw    JSONB NOT NULL DEFAULT '[]',     -- [{type, content, received_at}]
  extraction      JSONB,                           -- extração acumulada de todas as mensagens
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours'
);
CREATE INDEX ON intake_session (telegram_chat_id, status) WHERE status = 'open';
```

### Ingestão de mensagens

```sql
-- Mensagens encaminhadas pela Filipa (Telegram/web/email)
CREATE TABLE intake_message (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL,
  recruiter_id    UUID NOT NULL REFERENCES recruiter(id),
  source          TEXT NOT NULL,                          -- 'telegram' | 'web_upload' | 'email'
  telegram_chat_id BIGINT,                               -- preenchido quando source='telegram'
  telegram_msg_id  BIGINT,                               -- ID da mensagem no Telegram
  session_id      UUID REFERENCES intake_session(id),    -- se faz parte de uma sessão multi-mensagem
  raw_text        TEXT,
  doc_path        TEXT,                                   -- se foi ficheiro (Supabase Storage)
  audio_path      TEXT,                                   -- se foi áudio (transcrito via Soniox)
  audio_transcript TEXT,                                  -- transcrição do áudio, se aplicável
  extracted       JSONB,                                  -- o que Claude Haiku extraiu
  entity_type     TEXT,                                   -- 'job_requirements' | 'candidate_cv' | 'client_feedback' | 'unknown'
  entity_id       UUID,                                   -- ligado a job/candidate/client após confirmação
  confirmed_at    TIMESTAMPTZ,                            -- NULL = aguarda confirmação da Filipa
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Evolução 2026-06-17 — candidato global, Camada A, critérios do cliente, RGPD

> Esta secção **supersede** partes do DDL acima onde indicado. Mantemos o DDL
> original como base e marcamos aqui as mudanças (é doc de design, não migração).

### 1. Candidato GLOBAL + `process` (candidatura) — decisão talent pool

**Problema do modelo antigo:** a entrevista ligava direto a `job_id` + `candidate_id`,
e o candidato vivia "dentro" da lógica da vaga. Mas o mesmo candidato repete-se entre
clientes e vagas ao longo do tempo. Prender o candidato a uma vaga perde o **talent
pool**.

**Modelo novo:** `candidate` é **global** por agência (já não tem nada que o prenda a
uma vaga — a DDL de `candidate` acima mantém-se, é só reinterpretada como entidade de
topo). A ligação candidato↔vaga passa a ser o **`process`**:

```sql
-- Processo = candidatura de UM candidato a UMA vaga (candidate × job)
-- O mesmo candidate_id aparece em vários process, de vários clientes.
CREATE TABLE process (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  candidate_id  UUID NOT NULL REFERENCES candidate(id),
  job_id        UUID NOT NULL REFERENCES job(id),
  recruiter_id  UUID NOT NULL REFERENCES recruiter(id),
  stage         TEXT NOT NULL DEFAULT 'sourced',   -- 'sourced'|'screening'|'interview'|'submitted'|'client_iv'|'offer'|'placed'|'rejected'|'withdrawn'
  status_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  closed_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  UNIQUE (candidate_id, job_id)
);
CREATE INDEX ON process (job_id, stage);
CREATE INDEX ON process (candidate_id);
```

**Supersede — CANÓNICO para a Fase 3 (fecha G1/G2, 2026-06-18):** `process_id` é a
**chave canónica** em `interview`, `client_verdict` e `placement_outcome`. No build
real, estas tabelas nascem **já com `process_id NOT NULL`** e **SEM** `job_id`+
`candidate_id` (deriva-se via `process`). `candidate_memory_fact.job_id` passa a
`process_id` (semântica "o `process` em que o facto surgiu"; NULL = facto geral,
reutilizável). Os `ALTER` abaixo são só o caminho de evolução a partir do DDL-base
acima — **a migração inicial (Fase 3) cria já o formato canónico**, não o antigo.

```sql
ALTER TABLE interview        ADD COLUMN process_id UUID REFERENCES process(id);
ALTER TABLE client_verdict   ADD COLUMN process_id UUID REFERENCES process(id);
-- build novo: process_id NOT NULL; job_id/candidate_id NÃO existem nestas tabelas (derivam de process)
```

### 2. Camada A — transcrição completa sem perdas (`transcript_chunk`)

```sql
-- A FONTE DE VERDADE da entrevista: transcrição inteira, diarizada, com timestamp.
-- NADA é descartado (inclui conversa pessoal — ver classificação RGPD §5).
CREATE TABLE transcript_chunk (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id  UUID NOT NULL REFERENCES interview(id),
  agency_id     UUID NOT NULL,
  seq           INT NOT NULL,                 -- ordem dentro da entrevista
  speaker       TEXT NOT NULL,                -- 'candidate' | 'recruiter' | 'other'
  ts_start      TEXT NOT NULL,                -- "12:03"
  ts_end        TEXT,
  text          TEXT NOT NULL,                -- o que foi dito, cru
  classificacao TEXT NOT NULL DEFAULT 'professional', -- 'professional' | 'personal' (RGPD §5)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  retain_until  TIMESTAMPTZ                   -- janela de retenção (cru); NULL = regra default
);
CREATE INDEX ON transcript_chunk (interview_id, seq);

CREATE TABLE transcript_chunk_embedding (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id    UUID NOT NULL REFERENCES transcript_chunk(id) ON DELETE CASCADE,
  agency_id   UUID NOT NULL,
  embedding   VECTOR(1536) NOT NULL
);
CREATE INDEX ON transcript_chunk_embedding USING ivfflat (embedding vector_cosine_ops);
```

> `interview_tick.live_state` continua a ser a **vista de trabalho comprimida** (Camada
> B); `transcript_chunk` é a **fonte** (Camada A). O Q&A da Filipa e a destilação de
> factos correm sobre `transcript_chunk`, não sobre o `resumo_corrente`.

### 3. Critérios do cliente (`client_criteria`) — base do relatório

```sql
-- As perguntas/critérios que ESTE cliente sempre faz (capturados no setup).
-- Viram linhas do rubric e secções do relatório (RELATORIO-CLIENTE.md).
CREATE TABLE client_criteria (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  client_id     UUID NOT NULL REFERENCES client(id),
  job_id        UUID REFERENCES job(id),       -- NULL = vale para todas as vagas deste cliente
  criterio      TEXT NOT NULL,                 -- "já liderou equipa?", "remoto a sério?"
  peso          TEXT NOT NULL DEFAULT 'normal', -- 'must' | 'normal' | 'nice'
  origem        TEXT NOT NULL DEFAULT 'setup',  -- 'setup' | 'verdict_inferido' | 'manual'
  source_ref    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX ON client_criteria (client_id);
```

### 4. Resultado da colocação (`placement_outcome`) — ground-truth da calibração

```sql
CREATE TABLE placement_outcome (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  process_id    UUID NOT NULL REFERENCES process(id) UNIQUE,
  decision      TEXT NOT NULL,                 -- 'hired' | 'offer_declined' | 'rejected'
  decline_reason TEXT,                         -- se o candidato recusou (contraproposta?)
  guarantee_result TEXT,                       -- 'stayed' | 'left_in_guarantee' | 'pending'
  guarantee_until TIMESTAMPTZ,                 -- fim do período de garantia
  bot_predicted TEXT,                          -- 'strong'|'ok'|'weak' que o bot tinha dado
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. RGPD — classificação pessoal/profissional + correções da Filipa + relatório 2 versões

```sql
-- Factos etiquetados: 'personal' NUNCA entra na avaliação/score (só recall).
ALTER TABLE candidate_memory_fact ADD COLUMN classificacao TEXT NOT NULL DEFAULT 'professional'; -- 'professional'|'personal'
ALTER TABLE candidate_memory_fact ADD COLUMN usar_no_score BOOLEAN NOT NULL DEFAULT TRUE;          -- FALSE p/ personal
ALTER TABLE candidate_memory_fact ADD COLUMN corrigido_pela_filipa BOOLEAN NOT NULL DEFAULT FALSE; -- correção humana ganha prioridade
ALTER TABLE candidate_memory_fact ADD COLUMN corrected_by UUID REFERENCES recruiter(id);
ALTER TABLE candidate_memory_fact ADD COLUMN retain_until TIMESTAMPTZ;                              -- retenção curta p/ personal
ALTER TABLE client_memory_fact    ADD COLUMN corrigido_pela_filipa BOOLEAN NOT NULL DEFAULT FALSE;

-- Intake tipado (alvo + intenção) — ver INTAKE-E-JULGAMENTO.md
ALTER TABLE intake_message ADD COLUMN alvo     TEXT;  -- 'cliente'|'vaga'|'candidato'
ALTER TABLE intake_message ADD COLUMN alvo_id  UUID;
ALTER TABLE intake_message ADD COLUMN intencao TEXT;  -- 'setup'|'add_requisito'|'corrigir_facto'|'pergunta'|'nova_vaga'

-- Relatório em duas versões (interna + cliente) — ver RELATORIO-CLIENTE.md
ALTER TABLE report ADD COLUMN content_client_md TEXT;     -- versão polida para o cliente
ALTER TABLE report ADD COLUMN client_sent_at    TIMESTAMPTZ;
-- content_md = versão interna (leitura rápida da Filipa); content_edited = edição da Filipa
```

**Regra de score (RGPD):** qualquer cálculo de adequação/score **filtra**
`usar_no_score = TRUE` e `classificacao = 'professional'`. Os factos pessoais existem
para *recall* (o bot pode responder à Filipa) mas são invisíveis ao juízo de
adequação. Regimes de retenção: cru (`transcript_chunk.retain_until`) curto;
profissional durável; pessoal o mais curto possível.

**Quem classifica (fecha o gap C3):** o **LLM classifica automaticamente** na
destilação (deteta "isto é pessoal" — família, saúde, religião, etc. → `personal`,
`usar_no_score=FALSE`); a **Filipa pode reclassificar** (marca `corrigido_pela_filipa`,
prioridade humana). **Auditável:** como o score só lê factos `professional` +
`usar_no_score=TRUE`, dá para **provar exatamente que factos entraram** num juízo (lista
filtrável) — a prova de que o pessoal não pesou.

**Default CONSERVADOR para categorias de risco (correção 2026-06-18):** o default geral é
`professional`, **mas** se o LLM detetar **qualquer sinal de categoria especial** (saúde,
gravidez, religião, etnia, orientação, filiação) com **dúvida**, o default vira
`personal`/`usar_no_score=FALSE` — **na dúvida, FORA do score** (nunca o contrário; um
falso-negativo aqui é um dado sensível a pesar num juízo). Mede-se o **falso-negativo da
classificação** num teste (`TESTES-ACEITACAO`), não só que `personal` não entra.

> ⚠️ **Distinção CRÍTICA p/ nichos clínicos (gap simulação enfermagem 2026-06-18):**
> "saúde" tem de separar **saúde DO TITULAR** (do candidato — sensível → `personal`, fora
> do score) de **saúde OCUPACIONAL / clínica de TERCEIROS** que o candidato *trata* (ex.:
> enfermeiro: "geri um doente em choque séptico, ajustei a sedação no desmame"). Esta
> última **é a própria evidência profissional** → `professional`, **dentro** do score. Um
> classificador que mande tudo o que cheira a "saúde/doente/fármaco" para `personal`
> **esvazia a avaliação** de enfermagem/medicina. Campo: `classificacao` ganha o valor
> `personal_saude_titular` vs `professional_clinico` quando o contexto é clínico.

### 6. Ronda 2 (2026-06-17) — agenda, voz, pesos, apagamento recuperável, override

```sql
-- Agenda do assistente proativo (ver ASSISTENTE-PROATIVO.md)
CREATE TABLE agenda_event (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  recruiter_id  UUID NOT NULL REFERENCES recruiter(id),
  process_id    UUID REFERENCES process(id),    -- a que entrevista/candidatura se refere
  title         TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  source        TEXT NOT NULL DEFAULT 'google_calendar',  -- 'google_calendar' (decidido) | 'manual' (fallback)
  external_ref  TEXT,                            -- id do evento no Google Calendar, se aplicável
  prep_sent_at  TIMESTAMPTZ,                     -- quando o resumo de preparação foi enviado
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollment da voz da Filipa (fallback de diarização — ARQUITETURA-TEMPO-REAL §2)
ALTER TABLE recruiter ADD COLUMN voice_enrollment_path TEXT;   -- amostra gravada 1×
ALTER TABLE recruiter ADD COLUMN voice_enrolled_at TIMESTAMPTZ;

-- Diarização: marcar trechos reatribuídos pela Filipa
ALTER TABLE transcript_chunk ADD COLUMN speaker_corrected BOOLEAN NOT NULL DEFAULT FALSE;

-- Pesos do rubric: cada critério ganha obrigatoriedade (avaliação holística — Parte F)
-- rubric.criteria[].peso  : 'must' | 'normal' | 'nice'   (client_criteria.peso já existe)
-- (rubric.criteria é JSONB; documentar o campo no shape, não precisa de DDL)

-- Override da Filipa ao veredito do bot (alimenta calibração — INTAKE Parte D)
ALTER TABLE report ADD COLUMN filipa_verdict_override TEXT;   -- 'strong'|'ok'|'weak' segundo a Filipa
ALTER TABLE report ADD COLUMN filipa_override_reason  TEXT;
ALTER TABLE report ADD COLUMN bot_verdict             TEXT;   -- o que o bot tinha dito (p/ comparar)

-- Apagamento recuperável (RGPD — ordem da Filipa "apaga tudo deste cliente/candidato")
-- Já temos deleted_at (soft-delete). Acrescentar a janela até purge definitivo:
ALTER TABLE candidate ADD COLUMN purge_after TIMESTAMPTZ;   -- NULL = não agendado p/ purge
ALTER TABLE client    ADD COLUMN purge_after TIMESTAMPTZ;
-- Cron faz hard-delete só após purge_after; antes disso, dá para "voltar atrás" (limpar deleted_at/purge_after).
ALTER TABLE candidate ADD COLUMN anonymized_at TIMESTAMPTZ;  -- apagar = ANONIMIZAR (ver nota abaixo)
```

> **Apagar candidato = ANONIMIZAR, não destruir o sinal (decisão 2026-06-18, fecha o
> órfão do `placement_outcome`):** no hard-delete da PII do candidato, **mantém-se o
> `placement_outcome`/`client_verdict` sem dados pessoais** (carimba `anonymized_at`,
> remove nome/CV/contactos/transcrição, guarda só o outcome `strong/ok/weak` vs
> `hired/stayed/left`). Assim cumpre-se o apagamento **e** não se perde o ground-truth da
> calibração (`INTAKE §D.1`). É a única exceção ao "apaga tudo" — e é sobre dados **já
> anónimos**.

> **Reutilização entre clientes:** como é **permitida** (decisão 2026-06-17, RGPD do
> lado da Filipa), `candidate_memory_fact` (global ao candidato) **não** precisa de
> restrição de âmbito por cliente. Cai o `visibility_scope` que a `REVISAO-360` D1
> sugeria. Single-tenant v1 reforça: sem fronteiras internas a impor.

### 7. Ciclo de pesquisa (`source_doc`) — o que o bot guarda do que pesquisa (2026-06-17)

> Resolve o gap "ele pesquisa e faz o quê com o conteúdo?". Ver
> `CAMADA-CONHECIMENTO.md` ("O que o bot FAZ com o que pesquisa").

```sql
-- Conteúdo CRU pesquisado/fetchado (web, repo, site) — rastreável e pesquisável (RAG).
-- Vale para o Role Profile (Antes) E para a pesquisa ao vivo (link/repo do candidato).
CREATE TABLE source_doc (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  kind          TEXT NOT NULL,                 -- 'web' | 'repo' | 'site' | 'doc'
  url           TEXT,                          -- origem (NULL se veio de upload)
  title         TEXT,
  raw_text      TEXT,                          -- conteúdo extraído (limpo)
  summary       TEXT,                          -- resumo destilado (Haiku)
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- a que entidade se refere (uma só, conforme o uso):
  job_id        UUID REFERENCES job(id),       -- pesquisa de mercado/role
  candidate_id  UUID REFERENCES candidate(id), -- repo/portfólio do candidato
  client_id     UUID REFERENCES client(id),    -- empresa/cliente
  confianca     TEXT NOT NULL DEFAULT 'media',  -- 'alta' | 'media' | 'baixa' (fonte fraca/contraditória)
  expires_at    TIMESTAMPTZ,                   -- role/mercado: +90d; candidato: NULL (snapshot mantido)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON source_doc (candidate_id);
CREATE INDEX ON source_doc (job_id);

CREATE TABLE source_doc_embedding (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES source_doc(id) ON DELETE CASCADE,
  agency_id   UUID NOT NULL,
  embedding   VECTOR(1536) NOT NULL
);
CREATE INDEX ON source_doc_embedding USING ivfflat (embedding vector_cosine_ops);

-- Proveniência web nos factos destilados (além do transcript):
ALTER TABLE candidate_memory_fact ADD COLUMN source_type TEXT NOT NULL DEFAULT 'interview'; -- 'interview'|'research'|'cv'
ALTER TABLE candidate_memory_fact ADD COLUMN source_doc_id UUID REFERENCES source_doc(id);  -- se veio de pesquisa
ALTER TABLE candidate_memory_fact ADD COLUMN estado_prova TEXT NOT NULL DEFAULT 'direto';   -- 'direto'|'a_confirmar' (research = a_confirmar até o candidato confirmar)
ALTER TABLE client_memory_fact    ADD COLUMN source_doc_id UUID REFERENCES source_doc(id);
-- Nota: facto 'research'/'a_confirmar' NÃO entra no score até virar 'direto' (confirmado ao vivo).
```

### 8. Assistente pessoal — memória que aprende + auditoria de ações (2026-06-17)

> Suporta `ASSISTENTE-PESSOAL.md` (o "ChatGPT dela"). O que o torna *dela*: aprende o
> estilo/preferências; e regista tudo o que faz (estrutura tipo Lince Brain).

```sql
-- Memória do RECRUTADOR: estilo, preferências, padrões da Filipa (personalização).
CREATE TABLE recruiter_memory_fact (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  recruiter_id  UUID NOT NULL REFERENCES recruiter(id),
  kind          TEXT NOT NULL,                 -- 'style' | 'preference' | 'pattern' | 'template'
  fact_text     TEXT NOT NULL,                 -- "escreve emails curtos, assina 'Abraço, Filipa'"
  source_type   TEXT NOT NULL DEFAULT 'learned', -- 'learned' (de edições/correções) | 'explicit' (ela disse)
  source_ref    TEXT,                          -- ex.: o rascunho que ela editou
  confidence    TEXT NOT NULL DEFAULT 'media',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX ON recruiter_memory_fact (recruiter_id, kind);

CREATE TABLE recruiter_memory_embedding (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id     UUID NOT NULL REFERENCES recruiter_memory_fact(id) ON DELETE CASCADE,
  agency_id   UUID NOT NULL,
  embedding   VECTOR(1536) NOT NULL
);
CREATE INDEX ON recruiter_memory_embedding USING ivfflat (embedding vector_cosine_ops);

-- Trilho de auditoria das AÇÕES do assistente (tool-calls) — defensável, tipo Lince Brain.
-- Ações para fora (enviar email, marcar, apagar) exigem confirmed_by antes de executar.
CREATE TABLE assistant_action (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  recruiter_id  UUID NOT NULL REFERENCES recruiter(id),
  tool          TEXT NOT NULL,                 -- 'gen_spreadsheet'|'gen_cv'|'send_email'|'create_event'|'export'|'web_search'|...
  efeito        TEXT NOT NULL DEFAULT 'leitura', -- 'leitura'|'gravar'|'enviar_fora' (do tool registry — AGENTE-TOOLS-E-WS.md)
  args          JSONB NOT NULL DEFAULT '{}',
  result_ref    TEXT,                          -- storage path do artefacto, id do email, etc.
  needs_confirm BOOLEAN NOT NULL DEFAULT FALSE, -- = (efeito ∈ {gravar, enviar_fora}); TRUE p/ ações com efeito durável/externo
  confirmed_by  UUID REFERENCES recruiter(id), -- NULL até a Filipa confirmar (porta de segurança)
  status        TEXT NOT NULL DEFAULT 'done',  -- 'pending_confirm'|'done'|'rejected'|'failed'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON assistant_action (recruiter_id, created_at);

-- Versionamento de requisitos/rubric (gap H4 — cliente muda requisitos a meio)
ALTER TABLE rubric ADD COLUMN version INT NOT NULL DEFAULT 1;
ALTER TABLE rubric ADD COLUMN superseded_at TIMESTAMPTZ;   -- quando uma versão foi substituída
ALTER TABLE report ADD COLUMN rubric_version INT;          -- contra que versão o parecer avaliou
```

### 9. Documentos do candidato — VÁRIOS CVs, versões e CVs gerados (2026-06-18)

> Mateus: "a secretária tem de poder adicionar **vários CVs por candidato** (faz muita
> coisa, ou atualiza daqui a 1 ano), e às vezes a Filipa quer **gerar um CV novo** para
> o candidato, ou **relatórios em PDF**." O candidato é global → acumula documentos ao
> longo do tempo.

```sql
-- O document já existe; ligar ao candidato GLOBAL + versionar + marcar gerados.
ALTER TABLE document ADD COLUMN candidate_id UUID REFERENCES candidate(id);  -- CVs pertencem ao candidato (global), não à vaga
ALTER TABLE document ADD COLUMN version     INT NOT NULL DEFAULT 1;          -- CV v1, v2… ao longo do tempo
ALTER TABLE document ADD COLUMN is_current   BOOLEAN NOT NULL DEFAULT TRUE;   -- qual CV é o "atual" p/ leitura
ALTER TABLE document ADD COLUMN source       TEXT NOT NULL DEFAULT 'uploaded';-- 'uploaded' | 'generated' (CV feito pela Vera) | 'report'
ALTER TABLE document ADD COLUMN generated_for TEXT;                          -- ex.: 'cliente TechCorp' (CV reformatado p/ um cliente)
CREATE INDEX ON document (candidate_id, doc_type, version);
```
- **Vários CVs:** um `candidate` tem **N `document`** (`doc_type='candidate_cv'`), com
  `version`/`created_at` → histórico (CV de hoje + o de há 1 ano). O `is_current` marca
  o que alimenta o perfil destilado; os antigos ficam para consulta.
- **CV gerado pela Vera:** `source='generated'` (reformatar no template do cliente, ou
  melhorar) — fica guardado, exportável (PDF/markdown), nunca destrói os originais.
- **Relatórios PDF:** o parecer (`report`) e outros documentos exportam para PDF
  (ferramenta do assistente, `ASSISTENTE-PESSOAL §3`); o ficheiro vai para Storage.

### 10. Qualidade de STT + diarização no `transcript_chunk` (2026-06-18)

> O motor ao vivo depende de saber a **confiança** do STT, os **gaps** de áudio e **quem
> falou** (diarização). O `transcript_chunk` ganha os campos de qualidade:

```sql
ALTER TABLE transcript_chunk ADD COLUMN is_final           BOOLEAN NOT NULL DEFAULT TRUE; -- parcial vs final
ALTER TABLE transcript_chunk ADD COLUMN stt_confidence     REAL;        -- 0..1 (baixa → não vira prova; §9)
ALTER TABLE transcript_chunk ADD COLUMN speaker_confidence REAL;        -- confiança da diarização
ALTER TABLE transcript_chunk ADD COLUMN audio_gap_ms       INT;         -- gap antes deste chunk (queda/silêncio)
ALTER TABLE transcript_chunk ADD COLUMN start_ms           INT;         -- offset no áudio
ALTER TABLE transcript_chunk ADD COLUMN end_ms             INT;
ALTER TABLE transcript_chunk ADD COLUMN source_stream_id   TEXT;        -- qual stream (reconexão = novo stream)
ALTER TABLE transcript_chunk ADD COLUMN provider_segment_id TEXT;       -- id do segmento no Soniox
-- speaker já existe ('candidate'|'recruiter'|'other') + speaker_corrected (§6)
```

> ⚠️ **RISCO NOVO (REUSE-MAP, 2026-06-18): a diarização do Soniox NÃO está implementada**
> no adapter atual do `cmtec-voice-platform` (`STTResult` sem `speaker_id`). É **trabalho
> NOVO** do carril tempo-real — não vem "de graça" do reuso. Caminho v1: **bot na call**
> dá faixa-por-participante (diarização perfeita); o adapter de diarização-por-voz fica
> para o presencial/fallback. Ver `REUSE-MAP.md` e `ARQUITETURA-TEMPO-REAL §2`.

### Ordem de criação (delta sobre a lista original)
Inserir após `candidate`: **`process`**. Após `interview`: **`transcript_chunk`**
(+ embedding). Junto de `client`: **`client_criteria`**. Depois: **`placement_outcome`**,
**`agenda_event`**, **`source_doc`** (+ embedding), **`recruiter_memory_fact`**
(+ embedding), **`assistant_action`**. ALTERs (§5, §6, §7, §9, §10, §11) aplicam-se às
tabelas já existentes.

### 11. Gaps da simulação "Enfermeiro UCI" (nicho regulado/não-técnico) — 2026-06-18

```sql
-- (BLOQ 1+2) Role Profile: porta de confirmação + confiança da FONTE (web pode trazer lixo)
ALTER TABLE role_profile ADD COLUMN confirmed_by  UUID REFERENCES recruiter(id); -- NULL = não confirmado pela Filipa
ALTER TABLE role_profile ADD COLUMN confirmed_at  TIMESTAMPTZ;
ALTER TABLE role_profile ADD COLUMN source_confidence TEXT NOT NULL DEFAULT 'media'; -- 'alta'|'media'|'baixa'
ALTER TABLE role_profile ADD COLUMN n_sources     INT NOT NULL DEFAULT 0;
-- Regra: n_sources < mínimo OU confiança baixa → role_profile 'não confirmado'; rubric/parecer
-- herdam confiança baixa VISÍVEL até um veredito de cliente calibrar. Nichos que a Filipa não
-- valida → confirmação não-bloqueia mas marca-se baixa (não fingir autoridade).

-- (BLOQ 3) Critério de CREDENCIAL/FACTO (binário, verificado por DOCUMENTO — não por narrativa)
-- rubric.criteria[].tipo: 'competencia' (prova-se pela profundidade) | 'credencial' (por documento)
ALTER TABLE candidate_memory_fact ADD COLUMN tipo_criterio TEXT NOT NULL DEFAULT 'competencia';
ALTER TABLE candidate_memory_fact ADD COLUMN credencial_estado TEXT; -- 'por_verificar'|'verificado'|'invalido'|'expirado'
ALTER TABLE candidate_memory_fact ADD COLUMN credencial_doc_ref TEXT; -- documento que prova (ex.: cédula Ordem)
-- Ex.: "inscrição na Ordem dos Enfermeiros (cédula ativa)", "SAV válido", "X anos UCI" → tipo='credencial';
-- só 'verificado' por DOCUMENTO; uma explicação brilhante NÃO o risca.

-- (MÉDIO 8) Contratação em VOLUME (ex.: hospital precisa de 6 enfermeiros)
ALTER TABLE job ADD COLUMN n_vagas INT NOT NULL DEFAULT 1; -- nº de colocações desta vaga
-- placement_outcome é por process → N colocações por job; garantia/follow-up iteram por COLOCAÇÃO.
```
- **Role Profile** deixa de ser verdade cega: confiança de **fonte** + porta de confirmação;
  num nicho que a Filipa não domina, o sistema **diz que não pôde validar** em vez de fingir
  autoridade. Ver `CAMADA-CONHECIMENTO`.
- **Credenciais** (reguladas/legais) = **tipo à parte**, verificado por documento — a
  "profundidade > checklist" **NÃO se aplica a factos binários** (exceção em
  `FILOSOFIA-DAS-PERGUNTAS`). Parecer tem secção "Credenciais a verificar" (`RELATORIO-CLIENTE`).

---

## 12. Runtime do agente + entidade + entrevista órfã (gaps simulação "dia caótico" 2026-06-18)

> A camada de runtime do agente estava só em prosa. Estas tabelas/campos fazem-na descer
> ao modelo (senão o "ChatGPT dela" desfaz-se no 1º dia com volume).

```sql
-- (BLOQ1) Conversa do agente — persiste entre sessões (não Redis-only)
CREATE TABLE assistant_thread (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  recruiter_id  UUID NOT NULL REFERENCES recruiter(id),
  active_context JSONB NOT NULL DEFAULT '{}',  -- entidade(s) em foco: {client_id?, job_id?, candidate_id?, process_id?}
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE assistant_message (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES assistant_thread(id),
  role          TEXT NOT NULL,            -- 'recruiter'|'assistant'
  content       TEXT NOT NULL,
  refs          JSONB,                    -- entidades/fontes citadas
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- (Redis = cache do estado quente do grafo; a VERDADE da conversa/contexto está aqui.)

-- (ALTO4) Tarefas longas (sourcing) — duráveis, retomáveis, sobrevivem a fechar a app
CREATE TABLE async_job (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  recruiter_id  UUID NOT NULL REFERENCES recruiter(id),
  thread_id     UUID REFERENCES assistant_thread(id),
  kind          TEXT NOT NULL,            -- 'sourcing'|'gen_doc'|'export'|...
  args          JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'running', -- 'running'|'done'|'failed'|'pending_confirm'
  progress      JSONB,                    -- {pct, msg}
  result_ref    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
-- o jobId dos frames WS (ARQUITETURA-INTEGRACAO §2.4) referencia esta tabela.

-- (MÉDIO9) Ligar cada ação à conversa (fila de confirmações por thread)
ALTER TABLE assistant_action ADD COLUMN thread_id UUID REFERENCES assistant_thread(id);
-- a "fila de confirmações pendentes" = SELECT * FROM assistant_action WHERE status='pending_confirm' AND thread_id=?
ALTER TABLE assistant_action ADD COLUMN expires_at TIMESTAMPTZ; -- confirmação pendente expira

-- (ALTO5) Chaves de dedup/resolução de entidade do candidato
ALTER TABLE candidate ADD COLUMN email TEXT;
ALTER TABLE candidate ADD COLUMN phone TEXT;
ALTER TABLE candidate ADD COLUMN name_normalized TEXT; -- nome sem acentos/maiúsculas p/ matching
CREATE INDEX ON candidate (agency_id, name_normalized);
CREATE INDEX ON candidate (email);
-- (BAIXO11) alias de cliente
ALTER TABLE client ADD COLUMN aliases TEXT[]; -- alcunhas ("TechCorp", "a Tech")

-- (ALTO7) Entrevista ÓRFÃ (começou sem contexto — §12 arranque a frio)
ALTER TABLE interview ALTER COLUMN process_id DROP NOT NULL; -- pode ser NULL até estruturar
-- interview.status ganha 'unstructured' (gravou, falta ligar a vaga/candidato)
-- fila visível: SELECT * FROM interview WHERE status='unstructured'

-- (MÉDIO8) Frescura de factos (re-entrevista) — re-validar o que envelheceu
ALTER TABLE candidate_memory_fact ADD COLUMN revalidate_after TIMESTAMPTZ; -- > N meses → flag p/ re-confirmar ao vivo
```
- **Conversa + contexto ativo + jobs** são **duráveis** (Postgres) → sobrevivem a fechar a
  app (cumpre `ASSISTENTE-PESSOAL §4`). Redis é só cache quente.
- **Entrevista órfã:** `process_id` nulo + `status='unstructured'` resolve o "começou sem
  contexto" (`ARQUITETURA-TEMPO-REAL §12`); fila do que falta estruturar.
- **Dedup universal:** as chaves (`name_normalized`+`email`/`phone`+`linkedin_url`) servem
  a resolução de entidade em TODOS os pontos de criação (ver `INTAKE`).

## 13. Cenário adversarial + cliente na call (gaps simulação 2026-06-18)

```sql
-- (BLOQ1) O falante pode ser o CLIENTE (3+ vozes) — não cai em 'other'
ALTER TABLE transcript_chunk      ALTER COLUMN speaker TYPE TEXT; -- valores: 'candidate'|'recruiter'|'client'|'other'
ALTER TABLE transcript_chunk      ADD COLUMN speaker_label TEXT;  -- nome do participante (N pessoas)
-- (candidate_memory_fact.speaker idem: passa a aceitar 'client'); correção de diarização ganha o balde 'client'.

-- (ALTO3) Inconsistência DURÁVEL e citável dos dois lados (não só num JSONB de trabalho)
CREATE TABLE contradiction (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  process_id    UUID NOT NULL REFERENCES process(id),
  requisito     TEXT,
  tipo          TEXT NOT NULL,            -- 'vs_cv' | 'interno' (afirmação A vs B)
  chunk_a       UUID REFERENCES transcript_chunk(id),  -- 1º lado (ex.: 11:58)
  chunk_b       UUID REFERENCES transcript_chunk(id),  -- 2º lado (ex.: 40:12) ou NULL se vs CV
  detalhe       TEXT,                     -- "disse 5 anos; CV diz 3"
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- o parecer cita OS DOIS lados com timestamp (defensável).

-- (MÉDIO6) Estado "afirmou alto e NÃO sustentou" (distinto de 'raso' honesto)
ALTER TABLE candidate_memory_fact ADD COLUMN nao_sustentado BOOLEAN NOT NULL DEFAULT FALSE;
-- afirmou forte → sob aprofundamento não provou. Distingue 'não sabe' (raso) de 'inflou'. SEM imputar intenção.

-- (ALTO5) Calibração aprende "era treta"
-- client_verdict.reason_type ganha 'misrepresentation' (além de skill_gap|cultural_fit|salary|other)
ALTER TABLE client_verdict ADD COLUMN bot_flag_inconsistencia BOOLEAN; -- a Vera tinha marcado contradito/nao_sustentado?
-- par (bot marcou ↔ cliente confirmou desonestidade) = ground-truth da deteção de mentira.

-- (ALTO2) Preferência do cliente REVELADA ao vivo → persiste (não evapora)
-- client_memory_fact.source_type ganha 'live_reveal'; gravada como pendente (confirmed_at NULL) no pós-call.
```
- O **cliente na call** passa a ser cidadão de 1ª classe (falante próprio, preferências ao
  vivo persistidas, fala rotulada no parecer/Q&A).
- **Inconsistência** é durável e **citada dos dois lados** — base da reportagem defensável.
- **"Não sustentado"** ≠ "raso": o parecer pode dizer "afirmou X mas não sustentou sob
  aprofundamento" **sem** dizer "mentiu" (ver regra anti-difamação, `INTAKE`).

## 14. Resiliência ao vivo — intervalos não-capturados + custo do tick (gaps simulação "falha de infra" 2026-06-18)

> Suporta `RESILIENCIA-E-FALHAS.md`. Dois buracos no schema: (1) não havia onde registar
> o intervalo "não-capturado" → o parecer não conseguia **provar** o buraco (BLOQUEADOR);
> (2) o `interview_tick` (o custo dominante × 2h) não guardava custo/tokens/modelo/latência
> → o "dashboard de custo" e o teto por entrevista não tinham destino.

```sql
-- (BLOQUEADOR) Intervalo SEM captura — queda de STT/rede/app/PC. O parecer lê isto para
-- assinalar honestamente "entre HH:MM e HH:MM não houve captura" (RELATORIO-CLIENTE §3).
-- Sem esta tabela, ausência de transcrição = indistinguível de silêncio (Regra 3 anti-achismo).
CREATE TABLE interview_gap (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id            UUID NOT NULL REFERENCES interview(id),
  agency_id               UUID NOT NULL,
  start_ms                INT NOT NULL,            -- offset no áudio onde a captura parou
  end_ms                  INT,                     -- NULL = ainda aberto (gap a decorrer)
  cause                   TEXT NOT NULL,           -- 'stt_reconnect'|'network'|'app_crash'|'pc_sleep'|'manual_pause'|'cost_cap'
  source_stream_id_before TEXT,                    -- stream que morreu (liga a transcript_chunk.source_stream_id)
  source_stream_id_after  TEXT,                    -- stream que retomou
  created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON interview_gap (interview_id);

-- (ALTO) Custo/tokens/modelo/latência por tick — fonte do dashboard F1/F2 e do teto por
-- entrevista (RESILIENCIA §4). O tick é o custo dominante (×2h); sem isto não se mede nada.
ALTER TABLE interview_tick ADD COLUMN tokens_in      INT;
ALTER TABLE interview_tick ADD COLUMN tokens_out     INT;
ALTER TABLE interview_tick ADD COLUMN cost_usd       NUMERIC(10,5);
ALTER TABLE interview_tick ADD COLUMN model_used     TEXT;        -- qual slot/modelo correu (LIVE vs fallback EXTRACTOR)
ALTER TABLE interview_tick ADD COLUMN tick_latency_ms INT;        -- p/ B4 (tick_latency_p95)
ALTER TABLE interview_tick ADD COLUMN degraded       BOOLEAN NOT NULL DEFAULT FALSE; -- tick saltado/modo reduzido (§3)
```
- **`interview_gap`** fecha a promessa de honestidade: custo de entrevista = `Σ interview_tick.cost_usd`
  + STT-horas; **teto por entrevista** (`INTERVIEW_COST_CAP_USD`) impõe o que o
  `LINCE_DAILY_BUDGET_USD` herdado **não** impunha (`REUSE-MAP §2`).
- **Política de falha/retry/fallback/teto** (constantes, backoff, degradação) vive em
  `RESILIENCIA-E-FALHAS.md` — não se repete aqui.

## 15. Implicações de SEGURANÇA & ESCALA no schema (loop segurança 2026-06-18)

> O schema é onde alguns controlos de `SEGURANCA.md` e `ESCALA-E-OPERACAO.md` têm de nascer
> certos — mudá-los depois exige migrar tabelas grandes. **Decidir na Fundação P0.1:**

1. **`agency_id` predicado obrigatório (defesa-em-profundidade desde a v1):** todo o repo de
   dados injeta `agency_id` em **todas** as queries (incl. RAG e posse do WS), mesmo sem RLS
   na v1. RLS por `agency_id` (abaixo) é a 2ª camada. Roles Postgres **least-privilege** por
   serviço; `service-role` **só migrações** (`SEGURANCA §1`, `AUTH-CONTRACT §7`).
2. **Particionar `transcript_chunk` (+ embedding) por tempo** + tiering (frio/comprimido) — não
   crescem sem teto (`ESCALA-E-OPERACAO §3`).
3. **Índices pgvector:** decidir **HNSW** (preferido a alto volume) ou `ivfflat` com **`lists`
   afinado** (hoje estão sem `lists`) + `REINDEX` agendado (`ESCALA-E-OPERACAO §4`).
4. **Purga em cascata** (RGPD + anti-PII-órfã): `purge_after`/`retain_until` propagam
   `transcript_chunk → *_embedding → source_doc → *_memory_fact`; cron no inventário de
   migração + monitor de frescura. Testar "zero PII órfã" (`ESCALA-E-OPERACAO §3`).
5. **Storage:** bucket **privado**, caminho `{agency_id}/...`, acesso só por **signed URL**
   curta do backend — nunca público (`SEGURANCA §4`).
6. **Cifra em repouso** de `transcript_chunk.text`/contactos/áudio (LUKS + bucket cifrado;
   idealmente pgcrypto a nível de coluna) e **backups cifrados** (`SEGURANCA §6`).
7. **Autovacuum** afinado nas tabelas quentes (`interview_tick`/`transcript_chunk`/
   `assistant_action`/`async_job`) — `ESCALA-E-OPERACAO §10`.

**Adições da verificação adversarial R2 (`SEGURANCA §13`):**
8. **Selar a transcrição (não-repúdio):** `transcript_chunk` é a **fonte de verdade do
   parecer** mas não era tamper-evident. Ganha `content_hash` encadeado por `interview_id`
   (hash-chain RFC 8785, como o `audit_ledger`) carimbado no `is_final` → um insider que edite
   um chunk no Postgres deixa rasto; um parecer disputado é defensável (`SEGURANCA §13.b`).
   ```sql
   ALTER TABLE transcript_chunk ADD COLUMN content_hash TEXT;  -- hash encadeado (prev_hash∥conteúdo)
   ALTER TABLE transcript_chunk ADD COLUMN prev_hash    TEXT;  -- GENESIS no 1º chunk da entrevista
   ```
9. **Isolamento de tenant na conexão do AGENTE (GUC):** as políticas RLS usam
   `current_setting('app.agency_id')::uuid` (não `auth.uid()`, que é NULL para o role de
   serviço do agente) → funcionam para a conexão `psycopg2` do Lince Brain, que faz
   `SET LOCAL app.agency_id` por pedido (`SEGURANCA §1`). **RAG em pgvector** (não Chroma
   global) para herdar o mesmo filtro.
10. **pgvector e RLS na v2 (ANN não conhece RLS):** uma busca de similaridade pode devolver
    vizinhos de **outra agência** mesmo com RLS nas tabelas-pai. Na v2 partilhada, o filtro
    `agency_id` entra **dentro** da query de vetores (não só na tabela). 🟦 Confirmar
    instância-por-agência (fecha na raiz, `INFRA §7`) vs multi-tenant partilhado (`SEGURANCA §13.l`).
11. **Cifra + purga abrangem `source_doc.raw_text`** (conteúdo cru de URLs de terceiros, pode
    ter PII) **e o store de RAG** — a purga em cascata inclui `collection.delete(where=…)`/DROP
    da coleção do candidato (senão embeddings ficam pesquisáveis após Art.17). Teste "zero PII
    órfã" corre **contra o RAG**, não só o Postgres (`SEGURANCA §13.n`).

## 16. Fixes da simulação de prova (2026-06-18) — proveniência, parecer, multi-CV, proativo, calibração

> A simulação multi-ângulo (12 lentes + crítico de completude) achou **5 famílias** de gaps de
> SCHEMA/contrato a fechar **ANTES da migração inicial** (regra "o build cria a forma FINAL").
> Aqui as ADIÇÕES (colunas/tabela); os CONTRATOS de processo estão nos docs indicados.

### A — Proveniência dura chunk→facto/tick (raiz da cascata de diarização)
```sql
ALTER TABLE candidate_memory_fact ADD COLUMN source_chunk_id    UUID[];  -- chunks que fundamentam o facto (FK lógica → transcript_chunk)
ALTER TABLE candidate_memory_fact ADD COLUMN source_document_id UUID REFERENCES document(id); -- se veio de um CV: qual
ALTER TABLE candidate_memory_fact ADD COLUMN cv_version         INT;     -- versão do CV-fonte (multi-CV)
ALTER TABLE interview_tick        ADD COLUMN derived_from_chunk_ids JSONB; -- chunks que o tick usou (re-atribuição/auditoria)
```
- Sem isto a "rastreabilidade" (`ARQUITETURA-TEMPO-REAL §8`) e a "correção que se propaga" (§2)
  eram irrealizáveis (só `transcript_chunk_embedding` e `contradiction.chunk_a/b` tinham FK a
  chunk). **Serviço de re-atribuição** (chunk com `speaker` alterado → recomputar/invalidar
  factos/ticks/contradições que o citam) + **reversão de estado** em `ARQUITETURA-TEMPO-REAL §2/§9`.

### B — Ciclo de vida do parecer (`report`)
```sql
ALTER TABLE report ADD COLUMN status TEXT NOT NULL DEFAULT 'generating'
  CHECK (status IN ('generating','ready','failed'));
ALTER TABLE report ADD COLUMN invalidated_at TIMESTAMPTZ;  -- ficou stale (correção a montante)
ALTER TABLE report ADD COLUMN stale_reason   TEXT;
```
- Geração **durável** (`async_job kind='gen_parecer'`), **gatilho único** de encerramento
  (Filipa/assistente/reaper → `interview.ended_at` + enfileira) e guarda `status='ready'` na
  transição →`submitted`: contratos em `JORNADA-POS-PARECER §1`. Correção a montante de um
  `report` já `ready` → `invalidated_at`/`stale_reason` + alerta (`RELATORIO §8`).

### C — Multi-CV: o juízo só contra o CV de REFERÊNCIA
```sql
ALTER TABLE document ADD COLUMN based_on_document_id UUID REFERENCES document(id); -- CV gerado → CV-fonte
ALTER TABLE document ADD CONSTRAINT doc_is_current_only_uploaded
  CHECK (is_current = FALSE OR source IN ('uploaded','attested'));   -- CV gerado pela Vera NUNCA alimenta o perfil/juízo
ALTER TABLE contradiction ADD COLUMN cv_document_id    UUID REFERENCES document(id); -- vs_cv: contra QUAL CV
ALTER TABLE contradiction ADD COLUMN divergence_origin TEXT; -- 'candidate' | 'vera_generated' (este exclui-se da deteção de mentira)
```
- CV `source IN ('generated','report')` nasce `is_current=FALSE` e NUNCA alimenta
  `candidate.profile`/gap-analysis/`vs_cv`. `vs_cv` mede contra o CV de referência e o parecer
  cita o **document concreto** (filename+version), não "(CV)". Factos `source_type='cv'` de CV
  não-corrente → `estado_prova='superseded'` (fora do score). Divergência candidato↔CV-**gerado**
  → `divergence_origin='vera_generated'` → **excluída** de `misrepresentation`/calibração
  (anti-difamação por artefacto nosso). Selo "reformatado por IA" no CV gerado enviado (`RELATORIO`).

### D — Motor proativo (NOVA tabela — não existia entidade de tarefa agendada)
```sql
CREATE TABLE proactive_task (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id     UUID NOT NULL,
  recruiter_id  UUID NOT NULL REFERENCES recruiter(id),
  kind          TEXT NOT NULL,   -- 'guarantee_followup'|'comparison_suggest'|'prep_summary'|'noshow_reschedule'
  target_type   TEXT NOT NULL,   -- 'candidate'|'process'|'interview'|'client'
  target_id     UUID NOT NULL,
  due_at        TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'fired'|'cancelled'|'suppressed'
  payload       JSONB NOT NULL DEFAULT '{}',
  fired_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON proactive_task (status, due_at);
```
- Worker/cron determinístico: `due_at<now AND status='pending'` → **GUARD DE FRESCURA obrigatório**
  (re-ler a entidade-alvo) ANTES de disparar; aborta/suprime se obsoleta. Regras (cancelar no
  purge/anonimização; suprimir durante entrevista `live`; re-ler `process.stage`) em
  `ASSISTENTE-PROATIVO`. `agenda_event` (reuniões) **≠** `proactive_task` (follow-ups a 80 dias).

### E — Calibração determinística e honesta
```sql
ALTER TABLE client_verdict    ADD COLUMN rubric_version INT;  -- segmentar a precisão por versão de régua
ALTER TABLE placement_outcome ADD COLUMN rubric_version INT;
```
- **Hierarquia + contagem por `process`** (1 amostra máx; ground-truth `placement_outcome >
  client_verdict > filipa_verdict_override`; sinais fracos numa métrica SEPARADA); calibração só
  agrega pares da **mesma `rubric_version`**; **piso `CALIBRATION_MIN_N`** + **IC de Wilson** antes
  de exibir "%". Regras em `INTAKE-E-JULGAMENTO §D.1`.

### F — Requisito com ID CANÓNICO (recuperado da sim tempo-real, 2026-06-18)
A rubric não dava **identidade estável** a cada requisito — `origin_criteria_id` é proveniência
(de onde a linha veio), não identidade. Toda a cadeia a jusante usava **texto livre** como chave
(`rubric.criteria[].requisito`, frame/`live_state`, `interview_tick.suggestion.requisito`, WS
`coverage.update`, `contradiction.requisito`, `candidate_memory_fact.competencia`) → reformular
um requisito ou **recompilar a rubric** (que tem `version` — §8) **parte** as referências.
```sql
-- rubric.criteria[] ganha um requisito_id ESTÁVEL (UUID) — persiste através de rubric.version:
--   um requisito que transita para a nova versão mantém o MESMO requisito_id.
ALTER TABLE contradiction         ADD COLUMN requisito_id UUID;  -- além do texto (display)
ALTER TABLE candidate_memory_fact ADD COLUMN requisito_id UUID;  -- liga o facto ao REQUISITO, não só competencia TEXT
```
- O **frame** (`interview_tick.live_state`), a `suggestion.requisito`, o WS `coverage.update`, o
  parecer e a comparação referenciam o **`requisito_id`**, não texto. O texto fica só para
  **display** / linguagem da Filipa. (`CAMADA-CONHECIMENTO` atribui o id na compilação da rubric;
  `ARQUITETURA-TEMPO-REAL §9` keia o frame por id.)
- A Família A (`source_chunk_id`) é proveniência **chunk→facto** (a jusante) — **não** resolve a
  identidade do requisito (a montante). São ortogonais.

> **Nota (sim):** `source_doc` (§7) JÁ está no schema canónico (#20 da ordem de criação); o
> canal **facto-de-pesquisa→tick** é `candidate_memory_fact source_type='research'`/
> `estado_prova='a_confirmar'` (não entra no score até confirmado ao vivo).

### G — Serialização do estado vivo (sem schema novo)
Família G = **prosa** em `ARQUITETURA-TEMPO-REAL §11.1` (escritor único estendido + encerramento
compare-and-set + entidade global por advisory lock). Sem tabela/coluna nova — é invariante de runtime.

### H — Destilação-final como JOB DURÁVEL (não só advisory-lock) — sim cascata-erro 2026-06-18
```sql
ALTER TABLE interview ADD COLUMN distilled_at TIMESTAMPTZ;  -- set quando o async_job 'distill_final' termina (done)
```
- A destilação-final pós-call (que escreve `candidate_memory_fact` a partir da Camada A) passa a
  **`async_job kind='distill_final'`** (durável: `generating→done/failed`, retry com backoff,
  **idempotente por `interview_id`**), espelhando o `gen_parecer` (`JORNADA §1.1.b`). Substitui o
  mero advisory-lock de `ARQUITETURA-TEMPO-REAL §11.1(5)`.
- O flag "factos destilados" = **`interview.distilled_at IS NOT NULL`** (produtor explícito =
  `distill_final=done`). **`cron_purge_raw_audio`** (`DATA-RETENTION §1.1`) **exige** `distilled_at`
  → o áudio (a FONTE) **nunca** se purga sem destilação completa. Crash a meio dos INSERTs = job
  `failed`+alerta (não factos parciais sem deteção). Health-check vigia a destilação **POR
  ENTREVISTA** (`ASSISTENTE-PESSOAL §4`), não só a consolidação periódica (anti-saga-claude-mem).

### I — Idempotência das ações `enviar_fora` (anti duplo-envio em retry) — sim cascata-erro 2026-06-18
```sql
ALTER TABLE assistant_action ADD COLUMN idempotency_key     TEXT;  -- gerado na criação (pending_confirm), ANTES de executar
ALTER TABLE assistant_action ADD COLUMN provider_message_id TEXT;  -- id do provider (Resend Message-ID, Calendar event) — dedup+auditoria
```
- As tools `enviar_fora` (`send_email`/`send_message`/`calendar_create`/`export_data`) levam o
  `idempotency_key` propagado ao provider (Resend `Idempotency-Key`, Calendar `requestId`, dedup por
  Message-ID). O **VERIFICADOR** separa "falhou ANTES de executar" (re-tentar é seguro) de "o efeito
  pode JÁ ter ocorrido" (resposta perdida) → estado **`unknown`**: **NÃO re-envia auto**; verifica
  pelo idempotency-key/Message-ID ou pergunta à Filipa. (`AGENTE-TOOLS-E-WS A.1/A.2`.)

> **Contagem: 34 tabelas** (+`proactive_task`). As restantes adições (incl. H/I) são colunas à base canónica.

## RLS — políticas chave

> ⚠️ **v1 é SINGLE-TENANT (só a IRIS) — decisão 2026-06-17.** Nesta versão **não há RLS por
> agência** ativa. **MAS (correção loop segurança 2026-06-18):** o `agency_id` é **predicado
> obrigatório nas queries da aplicação desde a v1** (defesa-em-profundidade, §15.1) — o que a
> v1 **não** liga é a RLS no Postgres, não o filtro. As políticas abaixo ficam como plano para
> a v2; o código já não depende delas para isolar (não se adia o filtro para a v2).

```sql
-- (v2) Padrão futuro: cada tabela tem RLS por agency_id
-- Exemplo para 'job' (caminho Next/Supabase — usa auth.uid()):
ALTER TABLE job ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency isolation" ON job
  USING (agency_id = (
    SELECT agency_id FROM recruiter WHERE user_id = auth.uid()
  ));
-- Replicar para todas as tabelas com agency_id

-- ⚠️ (§15.9) O AGENTE Python (Lince Brain) liga com role de serviço → auth.uid() é NULL.
-- A política para a conexão do agente usa o GUC de tenant (SET LOCAL app.agency_id por pedido):
CREATE POLICY "agency isolation (agent)" ON job
  USING (agency_id = current_setting('app.agency_id', true)::uuid);
-- Sem isto, a RLS por auth.uid() é INERTE para o agente (SEGURANCA §1).
```

---

## Índices críticos

```sql
-- Busca de factos por candidato + competência (RAG)
CREATE INDEX ON candidate_memory_fact (candidate_id, competencia);

-- Role profiles por agência + slug
CREATE UNIQUE INDEX ON role_profile (agency_id, role_type_slug);

-- Calibração: ver todos os vereditos de um job
CREATE INDEX ON client_verdict (job_id, verdict);

-- Intake: mensagens não confirmadas
CREATE INDEX ON intake_message (agency_id, confirmed_at) WHERE confirmed_at IS NULL;
```

---

## Migração de arranque (34 tabelas) — ordem de criação

> ⚠️ **Aplica o "🧭 Guia de consolidação" do topo** (forma FINAL canónica). Esta é a
> ordem por FKs das **34 tabelas** (a lista antiga de 16/28/29/33 estava stale — corrigida
> 2026-06-18: faltavam `assistant_thread`/`assistant_message`/`async_job` (§12) e
> `contradiction` (§13) na ordem; + `interview_gap` §14; + `proactive_task` §16, criar após
> `process`/`recruiter`). As colunas novas do §16 são ALTERs às tabelas já listadas.

1. `agency` · 2. `recruiter` (+`telegram_chat_id`, +`voice_enrollment_path`) · 3. `client`
(+`purge_after`) · 4. `job` · 5. `role_profile` · 6. `candidate` (+`anonymized_at`,
+`purge_after`) · 7. **`process`** (+`consent_status`/`consent_evidence_ref`/`consent_at`)
· 8. `document` (+`candidate_id`/`version`/`is_current`/`source`) · 9. `rubric`
(+`version`, criteria com `peso`/`origem`) · 10. `client_criteria` · 11. `interview`
(`process_id NOT NULL`, `capture_type` aceita `'none'`) · 12. `interview_tick`
(+custo/tokens/modelo/latência — §14) · 12b. **`interview_gap`** (§14) · 13.
**`transcript_chunk`** (+ embedding; +campos de qualidade STT — ver §STT) · 14. `report`
(+`content_client_md`/`rubric_version`/`filipa_verdict_override`) · 15. `client_verdict`
(`process_id`) · 16. **`placement_outcome`** · 17. `client_memory_fact` (+ embedding,
+`source_doc_id`) · 18. `candidate_memory_fact` (+ embedding, +`source_type`/`source_doc_id`/`estado_prova`)
· 19. `agenda_event` · 20. **`source_doc`** (+ embedding) · 21. **`recruiter_memory_fact`**
(+ embedding) · 22. **`assistant_action`** (+`efeito`/`thread_id`) · 22b. **`assistant_thread`**
(§12) · 22c. **`assistant_message`** (§12; FK→`assistant_thread`) · 22d. **`async_job`** (§12) ·
22e. **`contradiction`** (§13; FK→`process`+`transcript_chunk`) · 23. `intake_session` · 24.
`intake_message`.
*(Contagem: 24 numeradas + 4 embeddings (candidate/transcript/source/recruiter) +
`interview_gap` + `assistant_thread`/`assistant_message`/`async_job` + `contradiction` +
`proactive_task` = **34 tabelas**. Nota de FK: `assistant_action.thread_id`→`assistant_thread`,
criar `assistant_thread` no mesmo bloco; `contradiction` depois de `process`+`transcript_chunk`;
`proactive_task` depois de `recruiter`.)*

Extensões: **`pgvector`** (Supabase self-hosted). **v1 single-tenant: sem RLS** (agency_id
fica como costura p/ v2).
