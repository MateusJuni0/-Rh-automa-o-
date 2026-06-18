# Retenção & Purga — matriz executável (o que vive quanto tempo, e como morre)

> **Porquê este doc (2026-06-18):** o schema já tem as **alavancas** de retenção
> (`MODELO-DADOS §6` `purge_after`/`anonymized_at`, `§5`/`§7` `retain_until`, `§15.4`/`§15.11`
> purga em cascata + RAG, `SEGURANCA §6` cifra/backups, `ESCALA-E-OPERACAO §3`/`§5`
> crescimento/DR, `LEGAL-E-RGPD §3` defaults sugeridos). O que **faltava** era a **matriz
> única**: por cada classe de dado — quanto se guarda, **porquê**, **quem** a purga, e se
> **anonimiza ou apaga**. Este doc é essa matriz + o desenho do job de purga + a verificação.
>
> Não duplica DDL nem política de falha — **referencia** as secções de origem. É SPEC, não código.

---

## 0. Princípios-raiz (a tensão central: purgar com segurança SEM perder valor)

O Mateus deu duas ordens que puxam em sentidos opostos — e ambas mandam:

1. **NUNCA perder informação de valor.** Transcrição de 2h, memória destilada, calibração e a
   "pasta curada" do candidato são o **ativo** do produto. Purga mal desenhada que apague isto
   é um defeito tão grave como vazar PII. (Trauma real: o claude-mem que parou em silêncio.)
2. **Purgar com segurança o que é PII sensível** — e provar que se purgou (RGPD, anti-PII-órfã).

A reconciliação dos dois é a **distinção que atravessa toda a matriz**:

| Eixo | Regime | Exemplo |
|---|---|---|
| 🔴 **PII bruta / sensível / efémera** | retenção **curta**, **apaga** (hard-delete) | áudio cru, `transcript_chunk` cru, `source_doc.raw_text`, factos `personal` |
| 🟢 **Memória de valor / calibração** | **preserva** (ou **anonimiza**, nunca destrói o sinal) | factos `professional`, `placement_outcome`, `client_verdict`, `recruiter_memory_fact` |
| ⚖️ **Auditoria / integridade** | **REDIGE** (nunca apaga a linha — preserva a cadeia) | `assistant_action`, hash-chain de `transcript_chunk`, `audit_ledger` do Lince |

Regras transversais (já LOCKED noutros docs, repetidas aqui como contrato da purga):
- **Apagar candidato = ANONIMIZAR**, não destruir o sinal (`MODELO-DADOS §6`, Art.17 → §6 deste doc).
- **Purga em cascata cobre o RAG e o Storage**, não só o Postgres (`MODELO-DADOS §15.11`,
  `SEGURANCA §13.n`) — senão ficam embeddings/ficheiros pesquisáveis após o apagamento.
- **Sem falha silenciosa:** todo o cron de purga tem monitor "correu nas últimas 24h senão
  alerta" (`ESCALA-E-OPERACAO §3`).
- **Escopo (2026-06-18):** deployment **único, só IRIS, 2 utilizadoras (Filipa + Inês), VPS
  dedicada.** `agency_id` está em tudo apenas como **costura de expansão futura** — aqui não há
  "comprador" nem multi-tenant a purgar. A purga por `agency_id` existe na mecânica (`§3`) mas na
  prática corre sobre **uma** agência.

> **Quem controla os prazos:** a **retenção/purga é uma alavanca do PRODUTO que a agência (a
> Filipa) configura** — a CMTec fornece o mecanismo e os defaults; os números finais são decisão
> dela (`LEGAL-E-RGPD §3`). Os defaults abaixo são **sugeridos e editáveis**; os 🟦 são onde o
> Mateus fecha o default de fábrica antes da Fase 3 entregar.

---

## 1. Matriz de retenção por classe de dado

> Colunas: **Default** (sugerido, editável pela agência) · **Base** (porquê) · **Purgado por**
> (cron/evento que o remove) · **Ação** (🔴 apaga · 🟢 anonimiza/preserva · ⚖️ redige).
> "Tabela" usa os nomes canónicos de `MODELO-DADOS` (não inventar tabelas novas).

### 1.1 Captura bruta da entrevista (🔴 PII mais sensível, retenção agressiva)

| Classe / tabela | Default 🟦 | Base | Purgado por | Ação |
|---|---|---|---|---|
| **Áudio cru** da entrevista (ficheiro em Storage; LiveKit/local-mic) | **7 dias** após destilação **confirmada** | É a PII mais sensível e a mais pesada; o seu valor passa para `transcript_chunk` + factos. Não há razão para o reter depois de destilado e verificado. | `cron_purge_raw_audio` (evento: `interview.status='done'` **E** factos destilados **E** `now > purge_after`) | 🔴 apaga (Storage) |
| **`transcript_chunk.text`** (Camada A — transcrição diarizada crua) | **30 dias** (`retain_until`) | Fonte-de-verdade do parecer enquanto o processo está vivo / em disputa; passado esse prazo o **valor durável** já está nos factos `professional` + no `report`. | `cron_purge_transcript` (lê `transcript_chunk.retain_until`) | 🔴 apaga o `text`; mantém a linha **selada** (ver nota ⚖️ abaixo) |
| **`transcript_chunk_embedding`** | segue o `transcript_chunk` (cascata) | Sem o chunk, o vetor é PII órfã pesquisável. | cascata (`ON DELETE CASCADE` + purga explícita do RAG, `§3`) | 🔴 apaga |
| **`interview_tick.live_state` / `suggestion`** | **30 dias** (= transcrição) | Vista de trabalho comprimida (Camada B); deriva do chunk, não acrescenta valor durável. | `cron_purge_transcript` (mesmo lote) | 🔴 apaga conteúdo; **mantém** linha de **custo** (ver 1.6) |
| **`interview_gap`** | **mantém** (até purga do `process`) | É **prova de honestidade** ("entre HH:MM não houve captura", `RELATORIO-CLIENTE §3`); minúsculo, sem PII. | só na purga do `process`/candidato | 🟢 preserva |

> ⚖️ **Selo da transcrição vs apagamento (não se atropelam):** `transcript_chunk` ganhou
> hash-chain `content_hash`/`prev_hash` por `interview_id` (`MODELO-DADOS §15.8`, `SEGURANCA §13.b`).
> Ao purgar o `text`, **a linha e o hash permanecem** (a cadeia não pode partir); apaga-se só o
> conteúdo (`text := NULL`, marca `redacted_at`). Assim a Camada A continua **tamper-evident**
> mesmo depois de o conteúdo sair — igual ao padrão `audit_ledger` do Lince (`REUSE-MAP §3`,
> `gdpr.py` redige preservando a cadeia). 🟦 **Mateus:** confirmar que redigir o `text` mantendo o
> hash satisfaz a expectativa (alternativa: apagar a linha inteira e aceitar um "buraco" assinalado
> na cadeia — menos limpo).

### 1.2 Embeddings / RAG (🔴 acompanham sempre a fonte — nunca sobrevivem a ela)

| Classe / tabela | Default | Base | Purgado por | Ação |
|---|---|---|---|---|
| `candidate_memory_embedding` | segue o `candidate_memory_fact` | Vetor sem facto = PII pesquisável órfã. | cascata + purga do RAG (`§3`) | 🔴 apaga |
| `source_doc_embedding` | segue o `source_doc` | idem | cascata + purga do RAG | 🔴 apaga |
| `recruiter_memory_embedding` | segue o `recruiter_memory_fact` | idem (memória da Filipa/Inês) | cascata | 🔴 apaga |
| `transcript_chunk_embedding` | ver 1.1 | — | ver 1.1 | 🔴 apaga |

> **Regra dura (anti-PII-órfã):** **nenhum embedding sobrevive à sua fonte.** Como o store de RAG
> é **pgvector no mesmo Postgres** (`SEGURANCA §1` corrige o Chroma global → 1 store sujeito ao
> mesmo funil de `agency_id`), o `ON DELETE CASCADE` já o garante a nível de DB. **Mas** o teste
> "zero PII órfã" corre **também contra o índice de vetores** (`§4`), porque ANN pode reter nós até
> `REINDEX`/`VACUUM` (`ESCALA-E-OPERACAO §4`). Se um dia o RAG for um store externo, a purga passa
> a incluir `collection.delete(where={...})`/DROP explícito (`MODELO-DADOS §15.11`).

### 1.3 Conhecimento pesquisado / web (🔴 cru curto · 🟢 destilado durável)

| Classe / tabela | Default 🟦 | Base | Purgado por | Ação |
|---|---|---|---|---|
| **`source_doc.raw_text`** (conteúdo cru de URLs/repos de terceiros) | **mercado/role: 90 dias** (= `expires_at`); **candidato: até purga do candidato** | Pode conter PII de terceiros (`SEGURANCA §13.n`); o **valor** é o `summary` destilado + os factos, não o cru. Snapshot do candidato mantém-se para defender o parecer. | `cron_purge_source_doc` (lê `source_doc.expires_at`) | 🔴 apaga `raw_text`; mantém `title`/`url`/`summary`/`fetched_at` (proveniência) |
| **`source_doc.summary`** + proveniência | durável (até purga da entidade) | Sinal destilado, baixo-PII, sustenta o parecer ("de onde veio"). | só na purga da entidade-pai | 🟢 preserva |
| **`role_profile`** (conhecimento de mercado por role) | **90 dias** (`expires_at`) | Cache de mercado; re-pesquisa-se. Sem PII de candidato. | `cron_expire_role_profile` | 🔴 apaga (ou re-gera) |

### 1.4 Factos destilados — o coração da memória (distinção PII vs valor)

| Classe / tabela | Default 🟦 | Base | Purgado por | Ação |
|---|---|---|---|---|
| **`candidate_memory_fact`** `classificacao='professional'` (`usar_no_score=TRUE`) | **enquanto candidato ativo** (talent pool) | É **memória de valor** e calibração — o motivo de o candidato ser global. Apagar por tempo destrói o ativo. | só na purga/anonimização do candidato (§6) | 🟢 preserva |
| **`candidate_memory_fact`** `classificacao='personal'` (`usar_no_score=FALSE`) | **90 dias** (`retain_until`) | Dado pessoal/sensível, **fora do score** (só recall). Retenção a mais curta possível (`MODELO-DADOS §5`). | `cron_purge_personal_facts` (lê `retain_until`) | 🔴 apaga |
| **`candidate_memory_fact`** `personal_saude_titular` | **90 dias** ou menos | Saúde **do titular** = categoria especial (`MODELO-DADOS §5`, nota clínica). | `cron_purge_personal_facts` | 🔴 apaga |
| **`candidate_memory_fact`** `professional_clinico` | enquanto candidato ativo | Saúde de **terceiros que o candidato trata** = **a própria evidência profissional** (ex.: enfermeiro). É valor, não PII do titular. | purga do candidato | 🟢 preserva |
| **`client_memory_fact`** (o que a IRIS aprendeu do cliente dela) | **enquanto cliente ativo** | Calibração + preferências do cliente; valor durável, baixo-PII. | purga do `client` | 🟢 preserva |
| **`recruiter_memory_fact`** (estilo/preferências da Filipa/Inês) | **enquanto utilizadora ativa** | É a personalização que torna a Vera "delas"; perdê-la = recomeçar do zero. | só por ordem explícita da utilizadora | 🟢 preserva |

> ⚠️ **Frescura ≠ apagamento (não confundir):** factos `professional` antigos **não se apagam por
> idade** — marcam-se para **re-validar ao vivo** (`candidate_memory_fact.revalidate_after`,
> `MODELO-DADOS §12`). Envelhecer um facto é um sinal de qualidade, não um gatilho de purga.

### 1.5 Parecer, documentos e CVs (🟢 valor · 🔴 a parte bruta)

| Classe / tabela | Default 🟦 | Base | Purgado por | Ação |
|---|---|---|---|---|
| **`report`** (parecer interno + versão cliente) | **enquanto candidato ativo** | Entregável + base de calibração (`bot_verdict` vs `client_verdict`). | purga do candidato/`process` | 🟢 preserva (anonimiza na purga do candidato, §6) |
| **`document`** `doc_type='candidate_cv'`, `source='uploaded'` | **enquanto candidato ativo**; versões antigas **mantidas** | Vários CVs/versões = histórico do candidato global (`MODELO-DADOS §9`). | purga do candidato | 🔴 apaga ficheiro (Storage) na purga do candidato |
| **`document`** `source='generated'` (CV feito pela Vera) / `source='report'` (PDF) | = candidato | Artefacto exportável; nunca destrói o original. | purga do candidato | 🔴 apaga na purga do candidato |
| **Ficheiros em Storage** (CV/áudio/PDF) | seguem a linha `document`/áudio respetiva | Bucket privado, caminho `{agency_id}/...`, só signed URL (`SEGURANCA §4`). | cascata de Storage no job de purga (`§3`) | 🔴 apaga objeto |

### 1.6 Calibração / ground-truth (🟢 preservar — é o ativo que melhora a Vera)

| Classe / tabela | Default | Base | Purgado por | Ação |
|---|---|---|---|---|
| **`client_verdict`** (veredito do cliente) | **permanente** (anonimizável) | Ground-truth da precisão (`bot_predicted` vs `verdict`, `INTAKE §D`). Sem isto a Vera não calibra. | só anonimização do candidato (§6) | 🟢 preserva sem PII |
| **`placement_outcome`** (contratou? ficou na garantia?) | **permanente** (anonimizável) | Ground-truth final (`JORNADA-POS-PARECER`). | só anonimização do candidato (§6) | 🟢 preserva sem PII |
| **`interview_tick`** custo/tokens/modelo (`cost_usd`, etc.) | **mantém** (mesmo após purgar `live_state`) | Dashboard de custo + teto por entrevista (`RESILIENCIA §4`); não é PII. | nunca por tempo | 🟢 preserva |

### 1.7 Biometria (🔴 categoria especial — vinculada à utilizadora, não ao candidato)

| Classe / tabela | Default 🟦 | Base | Purgado por | Ação |
|---|---|---|---|---|
| **`face_templates`** (`template_enc` AES-GCM, PK `email`) | **enquanto utilizadora ativa** | Biometria das **2 utilizadoras** (Filipa/Inês), não de candidatos. Clone próprio da Vera, schema `vera_face` (`REUSE-MAP §1`). Cifrada AES-256-GCM, chave fora da DB. | evento: utilizadora desativada → `delete_template(email)` (`db.py`) | 🔴 apaga template |
| **`face_verdicts`** (canal efémero single-use) | **TTL 60s** (sessão) / consumido | Já é efémero por desenho (`consumed_at`, `REUSE-MAP §1`). | expiração natural + `cron_purge_verdicts` (limpa consumidos/expirados) | 🔴 apaga |
| **`trusted_devices`** (device-binding) | **enquanto utilizadora ativa** | Liga a sessão ao dispositivo; sem PII de candidato. | utilizadora desativada / unbind | 🔴 apaga |

### 1.8 Runtime do agente, intake e sessões (🔴 efémero · ⚖️ auditoria)

| Classe / tabela | Default 🟦 | Base | Purgado por | Ação |
|---|---|---|---|---|
| **`assistant_action`** (trilho de ações/tool-calls) | **mantém** (≥ retenção de auditoria) | Trilho **defensável** tipo Lince Brain; `args` guarda **referências/hashes, não payload** (`SEGURANCA §6`). | nunca por tempo curto | ⚖️ **REDIGE** (preserva a cadeia, nunca apaga a linha) |
| **`assistant_thread` / `assistant_message`** (conversa do agente) | **90 dias** 🟦 (ou enquanto entidade ativa) | Conversa durável (`MODELO-DADOS §12`) — pode citar PII de candidatos no corpo. | `cron_purge_assistant_chat` | 🔴 apaga (redige refs a entidades purgadas) |
| **`async_job`** (tarefas longas: sourcing/gen) | **30 dias** após `done`/`failed` | Estado de jobs concluídos; sem valor durável. | `cron_purge_async_jobs` | 🔴 apaga |
| **`intake_session`** (Telegram multi-msg) | **TTL 2h** (`expires_at`) + apaga **7 dias** após fechar | Já é efémero (Redis + persistido ao fechar). | expiração + `cron_purge_intake` | 🔴 apaga |
| **`intake_message`** (msgs encaminhadas; `raw_text`/`doc_path`/`audio_*`) | **30 dias** após `confirmed_at` 🟦 | Depois de extraído e ligado à entidade, o cru não acrescenta valor e pode ter PII. | `cron_purge_intake` | 🔴 apaga `raw_text`/ficheiros; mantém `entity_id`/`extracted` leve |
| **`agenda_event`** | **mantém** (ou 1 ano após `starts_at` 🟦) | Histórico de agenda; baixo-PII. | opcional `cron_purge_agenda` | 🟢 preserva |
| **`contradiction`** | segue o `process` | Base do parecer defensável; aponta para chunks. | purga do `process`/candidato | 🟢 preserva (purga com a entrevista) |

### 1.9 Backups & URLs (infra)

| Classe | Default 🟦 | Base | Purgado por | Ação |
|---|---|---|---|---|
| **Backups** (DB `pg_dump` + Storage, **cifrados** `age`, **off-site**) | **14 dias** (alinha com playbook pg-backups da CMTec) → 🟦 considerar **30 dias** | RPO/RTO (`ESCALA-E-OPERACAO §5`); chave de cifra **off-VPS** (`SEGURANCA §6`). | retenção do job de backup (rotação) | 🔴 apaga snapshot expirado |
| **Signed URLs** (Storage) | **TTL curto** (minutos) | Acesso a CV/áudio/PDF só por URL assinada de curta duração (`SEGURANCA §4`). | expiração natural (sem cron) | n/a |
| **Token LiveKit** | **TTL curto** + revogação no fim | Não válido as ~2h todas (`AUTH-CONTRACT`, `SEGURANCA §13.d`). | revogação no encerramento/kill-switch | n/a |

> ⚠️ **Backups são o ponto cego da purga (decisão consciente):** apagar/anonimizar PII na DB **não**
> a apaga dos backups cifrados até a janela de retenção rodar. Aceita-se que um candidato apagado
> **persista em backup cifrado off-site até `backup_retention` dias** — depois a rotação remove-o.
> Isto é defensável (backup cifrado, chave off-VPS), mas tem de estar **escrito** (a Filipa pode
> precisar de o declarar). Não se re-escreve backups para cirurgicamente remover 1 candidato.

---

## 2. Defaults de fábrica — resumo numérico (🟦 = Mateus fecha)

> Coerente com `LEGAL-E-RGPD §3` (que já sugere 30d cru / 90d personal / ativo professional /
> 30d soft→hard). Esta tabela **estende** com as classes que faltavam lá.

| Parâmetro (env / config da agência) | Default sugerido 🟦 | Regime |
|---|---|---|
| `RAW_AUDIO_RETENTION_DAYS` | **7** (após destilação confirmada) | 🔴 |
| `TRANSCRIPT_RAW_RETENTION_DAYS` (`retain_until`) | **30** | 🔴 (sela o hash) |
| `PERSONAL_FACT_RETENTION_DAYS` (`retain_until`) | **90** | 🔴 |
| `PROFESSIONAL_FACT_RETENTION` | **enquanto candidato ativo** (sem expiração por tempo) | 🟢 |
| `SOURCE_DOC_RAW_RETENTION_DAYS` (mercado) | **90** (`expires_at`) | 🔴 cru / 🟢 summary |
| `ROLE_PROFILE_TTL_DAYS` | **90** | 🔴 |
| `ASSISTANT_CHAT_RETENTION_DAYS` | **90** | 🔴 |
| `ASYNC_JOB_RETENTION_DAYS` | **30** | 🔴 |
| `INTAKE_RAW_RETENTION_DAYS` | **30** (após confirmação) | 🔴 |
| `SOFT_TO_HARD_DELETE_DAYS` (`purge_after`) | **30** | janela recuperável |
| `BACKUP_RETENTION_DAYS` | **14** → 🟦 30? | 🔴 |
| `FACE_TEMPLATE_RETENTION` | **enquanto utilizadora ativa** | 🔴 evento |
| `placement_outcome` / `client_verdict` / `interview_tick`-custo | **permanente** (anonimizável) | 🟢 |

---

## 3. Job de purga em cascata — `purge_agency_data` + variantes (ordem importa)

> Bate com `MODELO-DADOS §15.4`/`§15.11` (purga propaga `transcript_chunk → *_embedding →
> source_doc → *_memory_fact`, **inclui RAG + Storage**) e reusa o padrão `gdpr.py`
> `purge_customer` do Lince (`REUSE-MAP §3`: redige `audit_ledger` preservando hash-chain, apaga
> as outras tabelas, tenant-scoped). **Determinístico (código), nunca o LLM a decidir passos**
> (`INFRA-E-MIGRACAO §0`).

### 3.1 Famílias de purga (cada uma é um job determinístico)

| Job | Gatilho | Âmbito |
|---|---|---|
| `cron_purge_raw_audio` | diário; `interview.done` + destilado + `purge_after` | áudio cru (Storage) |
| `cron_purge_transcript` | diário; `transcript_chunk.retain_until < now` | `text` + tick `live_state` (sela hash) |
| `cron_purge_personal_facts` | diário; `retain_until < now` em factos `personal*` | facto + embedding |
| `cron_purge_source_doc` | diário; `source_doc.expires_at < now` | `raw_text` + embedding |
| `cron_expire_role_profile` | diário; `role_profile.expires_at < now` | linha (ou re-gera) |
| `cron_purge_assistant_chat` / `async_jobs` / `intake` / `verdicts` | diário; respetivos TTLs | runtime efémero |
| **`purge_candidate`** | **evento** (Art.17 da Filipa) | **anonimiza** o candidato (§6) — NÃO apaga calibração |
| **`purge_agency_data`** | evento raro (encerrar tudo) | apaga **toda** a agência (existe pela costura; na IRIS = caso-limite) |

### 3.2 `purge_candidate(candidate_id)` — ordem concreta (anonimizar mantendo o sinal)

> É o job mais delicado: tem de **apagar a PII** e **preservar a calibração**. Ordem por FKs:

1. **Marcar** `candidate.deleted_at` + `anonymized_at = now()` (carimbo de auditoria).
2. **Storage:** apagar **todos** os objetos do candidato — CVs (`document` `uploaded`/`generated`),
   áudios de entrevistas, PDFs de pareceres. (Bucket privado, caminho por `{agency_id}/...`.)
3. **RAG / embeddings:** apagar `candidate_memory_embedding` + `source_doc_embedding` +
   `transcript_chunk_embedding` dos `interview` do candidato (cascata FK **+** confirmar no índice
   pgvector — `§4`). Se RAG externo um dia: `collection.delete(where={candidate_id})`.
4. **Conteúdo bruto:** `transcript_chunk.text := NULL` + `redacted_at` (mantém a **linha + hash**,
   §1.1 ⚓); apagar `source_doc.raw_text`; apagar `candidate_memory_fact` (todos — pessoal e
   profissional saem com a PII do titular).
5. **Documentos:** apagar linhas `document` do candidato.
6. **Anonimizar** (NÃO apagar) o que é **ground-truth de calibração**:
   `report` (remover nome/PII do `content_md`/`content_client_md`, manter veredito/estrutura),
   `client_verdict` e `placement_outcome` (manter `bot_predicted`/`verdict`/`hired/stayed/left`,
   sem PII). Carimbar `anonymized_at`. → cumpre Art.17 **e** preserva `INTAKE §D.1`.
7. **PII direta** no `candidate`: limpar `name`/`name_normalized`/`email`/`phone`/`linkedin_url`/
   `profile`; manter o `id` como âncora anónima dos outcomes.
8. **Auditoria:** escrever em `assistant_action` / `audit_ledger` a operação de purga
   (quem/quando/contagens), **redigindo** (preserva hash-chain — `gdpr.py`), nunca apagando o trilho.

> **`face_templates` NÃO entra aqui** — é biometria das **utilizadoras**, não dos candidatos
> (§1.7). Purga-se por evento "utilizadora desativada", não no `purge_candidate`.

### 3.3 Janela recuperável (anti-arrependimento)

`deleted_at`/`purge_after` dão **soft-delete recuperável**: o hard-delete (passos 2–7) só corre
**após `purge_after`** (default 30d). Antes disso, "voltar atrás" = limpar `deleted_at`/`purge_after`
(`MODELO-DADOS §6`). Protege contra a Filipa apagar por engano.

---

## 4. Verificação — provar que purgou, e que purgou em silêncio não

> Três testes/monitores obrigatórios (entram no gate da Fase 3 e em `TESTES-ACEITACAO`):

1. **Teste "zero PII órfã" (Postgres + RAG + Storage)** — após `purge_candidate` num candidato de
   teste:
   - **Postgres:** nenhuma linha com PII do candidato (nome/email/phone/`raw_text`/`text`) em
     **nenhuma** tabela; `report`/`client_verdict`/`placement_outcome` existem mas **sem PII**.
   - **RAG (pgvector):** uma busca de similaridade pelos termos do candidato **não devolve** os
     seus vetores (correr após `VACUUM`/`REINDEX` — ANN pode reter nós, `ESCALA §4`).
   - **Storage:** nenhum objeto sob o caminho do candidato; signed URL antiga → 404.
   - **Calibração intacta:** o par `bot_predicted`↔`outcome` **continua** contável (não se perdeu o
     ground-truth). Este sub-teste é o que prova a regra "purgar sem perder valor".
2. **Monitor "purga correu nas últimas 24h senão alerta"** — cada `cron_purge_*` regista
   `last_run_ok`; um healthcheck (padrão `backup.db_dump_fresh` do Lince) alerta a Filipa/Mateus se
   um job **não correu** ou **falhou** (a dor do claude-mem que parou em **silêncio** — não repetir).
3. **Cron no inventário de migração** — todos os `cron_purge_*` entram na lista de timers de
   `INFRA-E-MIGRACAO §3` (passo 12), com o seu monitor, para **não se esquecerem** num salto de
   infra (medo explícito do Mateus: "esqueces de migrar a config certinha").

> **Teste do classificador (liga à matriz):** o `TESTES-ACEITACAO` mede o **falso-negativo** da
> classificação `personal`/`professional` (`MODELO-DADOS §5`) — porque se um dado sensível for
> mal-classificado como `professional`, **escapa** ao regime de retenção curta desta matriz. Na
> dúvida → `personal` (fora do score **e** retenção curta).

---

## 5. Distinção RGPD — alavanca do produto, mecanismo nosso

Coerente com `LEGAL-E-RGPD` (LOCKED): **o RGPD é responsabilidade da agência (Filipa); a CMTec
fornece o mecanismo.** Tradução para retenção/purga:

- **A agência configura** os prazos (a tabela `§2` é o **default de fábrica**, editável por ela) e
  **dispara** o apagamento (Art.17) quando um titular o pede. É a alavanca **dela**.
- **A CMTec fornece** o mecanismo correto: cascata que não deixa PII órfã, cifra em repouso,
  backups cifrados off-site, e a verificação. Isto é **segurança técnica = qualidade = nossa**.
- **Pedido de apagamento de candidato (Art.17)** = `purge_candidate` (§3.2): **anonimiza mantendo
  `placement_outcome`/`client_verdict` sem PII** (já decidido em `MODELO-DADOS §6`). É a **única**
  exceção ao "apaga tudo" — e incide sobre dados que ficam **anónimos**, logo fora do âmbito do
  Art.17.
- Nós **não** validamos o consentimento dela nem auditamos o uso — só damos as alavancas
  (`LEGAL-E-RGPD §2`).

---

## 6. Apagamento de candidato (Art.17) = ANONIMIZAR — regra única

Repetida aqui como contrato porque é a interseção crítica das duas ordens do Mateus:

> **Apagar candidato NÃO destrói o sinal de calibração.** `purge_candidate` (§3.2) remove
> nome/CV/contactos/transcrição/embeddings/áudio (🔴) **e preserva**, **sem PII**, o `report`
> anonimizado + `client_verdict` + `placement_outcome` (🟢) — carimba `anonymized_at`. Resultado:
> cumpre-se o apagamento **e** mantém-se o ground-truth `strong/ok/weak` ↔ `hired/stayed/left`
> (`INTAKE §D.1`). Esta é a forma de honrar "purgar com segurança" **sem** "perder informação de
> valor" — as duas ordens, satisfeitas em simultâneo.

---

## 7. 🟦 Decisões do Mateus (defaults de fábrica a fechar antes da Fase 3 entregar)

> Nenhuma bloqueia **codar**; bloqueiam **fixar os defaults de fábrica** / pôr PII real.

1. **`RAW_AUDIO_RETENTION_DAYS = 7`** (após destilação confirmada) — ok ou mais curto/longo?
2. **`TRANSCRIPT_RAW_RETENTION_DAYS = 30`** — e confirmar **redigir `text` mantendo o hash** vs
   apagar a linha inteira (§1.1 ⚓).
3. **`PERSONAL_FACT_RETENTION_DAYS = 90`** — ok? (categoria especial: mais curto?)
4. **`SOURCE_DOC_RAW_RETENTION_DAYS = 90`** (mercado) — ok?
5. **`ASSISTANT_CHAT_RETENTION_DAYS = 90`** e **`ASYNC_JOB = 30`** / **`INTAKE_RAW = 30`** — ok?
6. **`BACKUP_RETENTION_DAYS`: 14 vs 30** — e ratificar que PII apagada **persiste em backup
   cifrado off-site** até a rotação (§1.9 ⚠️).
7. **`SOFT_TO_HARD_DELETE_DAYS = 30`** (janela recuperável) — ok?
8. **`agenda_event`**: manter para sempre vs apagar 1 ano após o evento?

> Os 🟦 de **segurança** que tocam retenção/purga (chave de backup off-VPS, data-policy
> Soniox/embedder, audit de **leitura** de PII) vivem em `SEGURANCA.md`/`README §Decisões 🟦` —
> aqui só os **prazos**.
