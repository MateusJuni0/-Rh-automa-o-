# Modelo de Dados — esquema completo Supabase/PostgreSQL

> **Princípios:** multi-tenant desde o dia 1 (RLS por `agency_id`); IDs UUID; timestamps
> com timezone; sem DELETE físico (soft-delete via `deleted_at`); toda evidência tem
> proveniência (quem disse, quando, de onde veio).

---

## Diagrama de relações

```
agency
 └── recruiter  (liga a auth.users)
      ├── client
      │    ├── client_memory_fact   ← o que aprendemos sobre o cliente (RAG)
      │    └── job
      │         ├── role_profile    ← conhecimento externo por role-type
      │         ├── rubric          ← gabarito (fraco/ok/forte) por requisito
      │         ├── candidate
      │         │    ├── candidate_memory_fact  ← o que o candidato disse (RAG)
      │         │    └── interview
      │         │         ├── interview_tick    ← estado vivo por tick
      │         │         ├── report            ← parecer final
      │         │         └── client_verdict    ← veredito do cliente (calibração)
      │         └── document        ← ficheiros do cliente sobre a vaga
      └── intake_message            ← msgs encaminhadas para processar
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
