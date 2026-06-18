# Escala & operação a longo prazo — o eixo AGREGADO

> **Porquê (loop de segurança, 2026-06-18):** `RESILIENCIA-E-FALHAS.md` cobre **uma**
> entrevista a falhar (Soniox/LLM/rede cai → reconexão/fallback/gap) e o custo **por**
> entrevista. Este doc cobre o que falta: o **agregado** — **muitas** entrevistas/clientes/anos
> ao mesmo tempo, a VPS partilhada, o crescimento dos dados, e o backup/DR. O Mateus pediu para
> acertar **na raiz** agora (no compose e no schema), porque estes são baratos de decidir agora
> e caríssimos depois de um outage ou perda de dados.
>
> Liga-se a: `INFRA-E-MIGRACAO.md` (runbook/bundle), `MODELO-DADOS.md` (volume/índices),
> `SEGURANCA.md` (rate-limit/WAF, backups cifrados), `RESILIENCIA-E-FALHAS.md` (falha pontual).

---

## 1. Capacidade de entrevistas SIMULTÂNEAS (dimensionar — nunca foi)

**Risco (BLOQUEADOR):** toda a spec de concorrência trata **1 copiloto + 1 agente**. Não há
número para "quantas entrevistas ao vivo aguenta uma VPS". Cada entrevista = 1 stream LiveKit
+ 1 stream Soniox + ticks LLM + WS + escritas a `transcript_chunk`. 3–4 em paralelo na VPS
partilhada (a competir com Cronos/Madalena/Supabase/n8n) podem estourar a latência do tick
(mata o `ARQUITETURA-TEMPO-REAL §3`: 1–3s) **sem nenhuma entrevista "falhar"**.

**Decisões (raiz — muda o desenho do `apps/realtime`):**
- **Teto de entrevistas concorrentes por VPS** (`MAX_CONCURRENT_INTERVIEWS`), medido na
  **simulação de 2h** (lado a lado com B6/B7).
- **`apps/realtime` = worker pool** (não processo único) — cada entrevista num worker isolado;
  o teto é o nº de workers saudáveis.
- **Fila / recusa graciosa** acima do teto: *"agenda cheia, tenta às HH:MM"* — nunca aceitar
  uma entrevista que vai degradar todas as outras (degradação de **capacidade**, distinta da
  falha de **uma** sessão, que já está em `RESILIENCIA`).
- Métrica de saturação (workers ocupados / CPU / latência p95 do tick) → alerta **antes** do teto.

---

## 2. Blast radius na VPS partilhada — limites de recurso por container

**Risco (BLOQUEADOR):** a Vera (Next+ws+realtime+bot+agent+face+Redis+LiveKit) vai na **mesma**
VPS 72.60.88.137 que serve **produção live** (Cronos vende, Madalena responde). Sem limites,
uma entrevista que nunca fecha / um storm de embeddings / um pico de 4 calls esgota CPU/RAM e
**derruba o Cronos**. O MEMORY.md já regista incidentes recorrentes de "self-work derruba prod"
(alertas de CPU Hostinger).

**Decisão (raiz, no compose, dia 1):**
- **Limites de recurso por container** da Vera (Docker `cpus`, `mem_limit`, `pids_limit`) —
  isolar a Vera do resto da VPS. Um pico da Vera **degrada a Vera**, não o Cronos.
- 🟦 Mateus: a médio prazo, considerar **VPS dedicada** à Vera quando houver clientes a pagar
  (a partilhada é aceitável só no piloto IRIS).

---

## 3. Crescimento de dados — particionar e fazer tiering (decidir no schema)

**Risco (ALTO):** `transcript_chunk` + as **4 tabelas de embedding** crescem **sem teto** (2h
= centenas/milhares de chunks + 1 embedding ~6KB cada; × N entrevistas × N agências × anos). A
purga RGPD ajuda no **áudio cru** (`retain_until` curto), mas os factos `professional` são
"duráveis" e os embeddings de `source_doc`/`candidate_memory`/`recruiter_memory` **não tinham
purga**. Tabelas quentes incham → restore lento, queries lentas.

**Decisões (no schema Drizzle — mudar depois exige migrar tabela grande):**
- **Particionar `transcript_chunk` (+ embedding) por intervalo de tempo** (mês/`interview`).
- **Tiering:** chunks antigos → frio/comprimido (ou destilados e o cru purgado conforme
  retenção); o quente fica enxuto.
- **Purga em cascata** (fecha o gap de PII órfã): apagar/anonimizar propaga
  `transcript_chunk → *_embedding → source_doc → *_memory_fact`. Testar "zero PII órfã".
- O **cron de purga** entra no inventário de `INFRA-E-MIGRACAO §3` (senão "esquece-se de
  migrar" e os dados ficam para sempre) + **monitor "purga correu nas últimas 24h senão alerta"**
  (a dor do claude-mem que parou em silêncio — não repetir).

---

## 4. pgvector a escala — HNSW vs ivfflat afinado + reindex

**Risco (ALTO):** os 4 índices são `USING ivfflat (... vector_cosine_ops)` **sem `lists`**
(default baixo) e sem reindex. `ivfflat` **degrada recall/latência** com volume; precisa de
`lists` afinado ao nº de linhas + `REINDEX` periódico — ou migrar para **HNSW** (melhor recall
a alto volume, pgvector recente). O RAG ao vivo e o Q&A da Filipa ficam lentos/imprecisos.

**Decisão:** escolher **HNSW** (preferido a alto volume) **ou** `ivfflat` com `lists` afinado;
fixar o parâmetro no schema; janela de `REINDEX` agendada. Afinar com volume real (medir).

---

## 5. Backup & DR — RPO/RTO, Storage, off-site, drill

**Risco (BLOQUEADOR + ALTO):** (a) o backup periódico é **só `pg_dump` da DB** — o **Storage**
(CVs, **áudios**, pareceres PDF) **não tem backup periódico** (só o `tar` no momento da
migração). Disco corrompido = DB intacta a apontar para ficheiros que já não existem. (b) Sem
**RPO/RTO** definidos; backup parece ficar **na mesma VPS** (perder a VPS = perder DB+backup);
sem **restore drill** provado. "Perda de dados de um cliente é inaceitável" (citado no doc).

**Decisões (alinhar com o playbook pg-backups que a CMTec já tem):**
- **Backup diário do Storage** a par do `pg_dump` (mesma retenção, **cifrado** — `SEGURANCA §6`).
- **RPO/RTO explícitos** (ex.: RPO ≤ 24h no piloto → considerar WAL/PITR se entrevistas valiosas;
  RTO documentado no runbook).
- **Off-site:** mandar o backup (DB+Storage, cifrado) **para fora da VPS**.
- **Restore drill mensal** que restaura **DB + Storage** (não só a DB) e verifica contagens.
- Há precedente CMTec de backups que **pararam em silêncio** → monitor "backup fresco nas
  últimas 24h senão alerta" (já existe `backup.db_dump_fresh` no healthcheck do Lince — replicar).

---

## 6. Rate-limiting / WAF nos endpoints públicos

**Risco (ALTO):** `/api/auth/face/*`, `/api/intake`, uploads, webhook do Telegram e o WS ficam
expostos pelo túnel Cloudflare **sem rate-limit/WAF** (o CF free **não** o traz por defeito).
Login sem throttle = brute-force (liga a `SEGURANCA §8`); upload sem cap = esgotar disco (§3).

**Decisão:** rate-limit por IP/sessão nas rotas sensíveis (**middleware Next** + **Cloudflare
rules**) + cap de tamanho/tipo no upload (o validador do `SEGURANCA §3`), **fail-closed**.

---

## 7. Reaper de entrevistas órfãs (agregado)

**Risco (MÉDIO):** a nível de **uma** sessão, o heartbeat fecha o stream Soniox órfão
(`RESILIENCIA §5`). O gap é **agregado**: várias entrevistas deixadas em `status='live'` (a
Filipa fecha o portátil sem parar) somam streams/locks/ticks e **Soniox-horas** de toda a VPS.

**Decisão:** **reaper global** que encerra entrevistas `live` sem heartbeat há X minutos
(marca `interview_gap` + fecha streams) — liga ao teto de capacidade (§1) e ao custo.

---

## 8. Frota de N instâncias vendidas — monitorização sem violar a independência

**Risco (MÉDIO):** "instância independente, sem cordão umbilical" (`INFRA-E-MIGRACAO §7`)
resolve o **acoplamento** (correto), mas deixa por desenhar: com 10 compradores em 10 VPS, como
se sabe que **o backup de cada um corre**, que está de pé, que houve uma falha? "Updates =
entrega opcional" cobre patching, não saúde.

**Decisão:** cada bundle inclui um **self-monitor** que reporta saúde/backup-ok **ao próprio
dono** (email/alerta dele) — ou, **opt-in**, a um endpoint de status nosso. Define-se o mínimo
agora **sem** criar dependência de runtime (não viola a independência: é telemetria de saúde,
não controlo).

---

## 9. Evolução single-VPS → escala (esboço na raiz)

**Risco (MÉDIO):** o desenho é bom em statelessness implícita (estado na DB, Redis=cache,
escritor único do estado vivo). Falta o mapa "quando 1 VPS não chega". O risco não é faltar
agora — é descobrir tarde um acoplamento escondido (ex.: Redis assumido local, `apps/ws`
single-process) que **force reescrita**.

**Decisão (meia página, agora):** confirmar o que **já é stateless** (web, ws, realtime-workers
com estado na DB) e o que precisaria de **extração** ao crescer (DB para máquina própria;
realtime para nó(s) dedicado(s); Redis externo). Manter tudo **12-factor** (config por env,
estado fora do processo) para que escalar seja "mover", não "reescrever".

---

## 10. Higiene de DB — autovacuum nas tabelas quentes

**Risco (BAIXO):** `interview_tick`, `transcript_chunk`, `assistant_action`, `async_job` têm
muito INSERT + soft-delete (`deleted_at`) → bloat; o autovacuum default pode não chegar.
**Decisão:** afinar autovacuum por tabela quente (no schema/migração).

---

## 11. Observabilidade & alertas (saber ANTES de cair)

Transversal aos pontos acima: métricas de **capacidade** (workers ocupados, latência p95 do
tick, conexões WS), **saturação de recursos** por container, **frescura de backup/purga**, e
**custo agregado** (além do por-entrevista do `RESILIENCIA §4`). Alertas com limiar **antes** do
ponto de rutura — não depois. (Reutilizar o padrão de healthcheck do Lince Brain.)

---

## 12. Resumo — o que decidir AGORA (raiz) vs depois

| Decidir agora (raiz: compose/schema) | Pode afinar com volume real |
|---|---|
| Limites de recurso por container (§2) | Teto exato de concorrência (§1) — medir na sim 2h |
| Worker pool no `apps/realtime` (§1) | `lists`/HNSW tuning (§4) |
| Partição + tiering de `transcript_chunk` (§3) | RPO/RTO finais (§5) |
| Purga em cascata + cron no inventário (§3) | Autovacuum por tabela (§10) |
| Backup do Storage + off-site + cifrado (§5) | Frota/self-monitor (§8) |
| Rate-limit/WAF nas rotas sensíveis (§6) | Mapa de extração single-VPS (§9) |

> Os 3 BLOQUEADORES (capacidade §1, blast-radius §2, backup do Storage §5) custam **barato** no
> compose/schema agora e **caríssimo** depois de um outage ou perda de dados — por isso são as
> portas reais antes de a Fase 3 **entregar** (não impedem codar).
