# Modelo de Dados — esquema completo Supabase/PostgreSQL

> **Princípios:** multi-tenant desde o dia 1 (RLS por `agency_id`); IDs UUID; timestamps
> com timezone; sem DELETE físico (soft-delete via `deleted_at`); toda evidência tem
> proveniência (quem disse, quando, de onde veio).

---

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
           │    ├── interview_tick       ← estado vivo por tick
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
  -- cada critério:
  -- { requisito: "React", pergunta_sonda: "...",
  --   fraco: "diz que sabe mas não explica", ok: "cita hooks", forte: "explica reconciliation",
  --   linguagem_filipa: { fraco: "...", ok: "...", forte: "..." } }
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

**Supersede:** `interview`, `client_verdict` e o novo `placement_outcome` passam a
referenciar **`process_id`** em vez de `job_id`+`candidate_id` (deriváveis via
`process`). `candidate_memory_fact.job_id` continua **opcional** e passa a significar
"o `process` em que o facto surgiu" (NULL = facto geral do candidato, reutilizável).

```sql
ALTER TABLE interview        ADD COLUMN process_id UUID REFERENCES process(id);
ALTER TABLE client_verdict   ADD COLUMN process_id UUID REFERENCES process(id);
-- (job_id/candidate_id ficam como denormalização opcional para queries, ou removem-se na migração real)
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

### Ordem de criação (delta sobre a lista original)
Inserir após `candidate`: **`process`**. Após `interview`: **`transcript_chunk`**
(+ embedding). Junto de `client`: **`client_criteria`**. No fim:
**`placement_outcome`**. ALTERs do §5 aplicam-se às tabelas já existentes.

---

## RLS — políticas chave

```sql
-- Padrão: cada tabela tem RLS por agency_id
-- Exemplo para 'job':
ALTER TABLE job ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency isolation" ON job
  USING (agency_id = (
    SELECT agency_id FROM recruiter WHERE user_id = auth.uid()
  ));
-- Replicar para todas as tabelas com agency_id
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

## Migração de arranque (resumo)

Ordem de criação (respeitando FKs):
1. `agency`
2. `recruiter` ← inclui `telegram_chat_id`
3. `client`
4. `job`
5. `role_profile`
6. `rubric`
7. `candidate`
8. `document`
9. `interview`
10. `interview_tick`
11. `report`
12. `client_memory_fact` + embedding
13. `candidate_memory_fact` + embedding
14. `client_verdict`
15. `intake_session` ← novo (Telegram multi-mensagem)
16. `intake_message` ← inclui campos Telegram + audio_transcript

Extensões necessárias: `pgvector` (já disponível no Supabase self-hosted desde v0.5+).
