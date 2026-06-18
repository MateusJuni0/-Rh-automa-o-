# Tool registry executável do agente + auth do WebSocket (implementação)

> **Propósito:** dois detalhes que ficavam por baixar de "desenho" para "executável":
> **(A)** o **registo de ferramentas** que o assistente pessoal chama de facto — cada
> uma com schema, efeito, slot de modelo e porta de confirmação; e **(B)** a
> **implementação do auth do WebSocket** (handshake, mensagens, posse, refresh).
>
> **Este doc não reabre decisões — referencia.** A anatomia do agente está em
> [`ASSISTENTE-PESSOAL.md §2.1`](./ASSISTENTE-PESSOAL.md); as rotas em
> [`ARQUITETURA-INTEGRACAO.md §2.3`](./ARQUITETURA-INTEGRACAO.md); os tipos de WS em
> `§2.4` do mesmo; o auth do WS em [`AUTENTICACAO.md §4`](./AUTENTICACAO.md); o schema
> (`assistant_action`, `recruiter_memory_fact`) em [`MODELO-DADOS.md §8`](./MODELO-DADOS.md);
> os slots de modelo em [`MODELOS-E-API.md §1`](./MODELOS-E-API.md). Se algo aqui
> divergir desses, **eles mandam**.

---

# Parte A — Tool registry executável do assistente pessoal

## A.0 Onde isto vive e como liga ao grafo

As ferramentas correm dentro de `services/agent` (o motor Hermes/Lince **clonado e
vendorizado** — FastAPI + LangGraph + estado Postgres + auditoria + kill switch;
[`ARQUITETURA-INTEGRACAO.md §1`](./ARQUITETURA-INTEGRACAO.md)). O nó **EXECUTOR** do
grafo (`ASSISTENTE-PESSOAL.md §2.1`) é quem invoca uma ferramenta, observa o resultado
e repete. **Adicionar capacidade = registar uma ferramenta nova, NÃO mexer no grafo**
(decisão LOCKED 2026-06-17).

Cada ferramenta é declarada como um descritor:

```
{ nome, descrição, input (schema Zod conceptual), efeito, slot_modelo, async, custo_estimado }
```

- **`efeito`** decide a **porta de confirmação** (regra "não chatear", `§2.1`):
  - `leitura` / `rascunho` / `geração` → **flui livre** (gera/pesquisa/lê, não confirma).
  - `gravar` (durável: cria/edita registos, salva documento, grava facto) → **confirma**.
  - `enviar_fora` (irreversível: envia, marca, publica, entra na call) → **confirma**.
- **`slot_modelo`** aponta a uma **capacidade** (`EXTRACTOR`/`ARCHITECT`/`LIVE`), nunca a
  um modelo concreto (`MODELOS-E-API.md §1`). `—` = a ferramenta não chama LLM
  (chama uma API externa ou faz I/O determinístico).
- **Toda chamada** (livre ou confirmada) escreve uma linha em **`assistant_action`**
  (`MODELO-DADOS.md §8`): `tool`, `args`, `result_ref`, `needs_confirm`, `confirmed_by`,
  `status`. As de `efeito ∈ {gravar, enviar_fora}` nascem `status='pending_confirm'`
  com `needs_confirm=true`; só passam a `done` depois do confirm.

> **Mapeamento efeito → `needs_confirm` (nota de coerência):** o schema de
> `assistant_action` não tem coluna `efeito`; tem `needs_confirm` (boolean). A regra é
> determinística: `needs_confirm = efeito ∈ {gravar, enviar_fora}`. O `efeito` vive no
> **descritor da ferramenta** (registry, em código), o `needs_confirm` é a **projeção**
> persistida na auditoria. Single source: o registry.

---

## A.1 As ferramentas (registry)

> Schemas em notação Zod **conceptual** (campos + tipo). A forma canónica vai para
> `packages/core` quando se construir (regra de ouro `ARQUITETURA-INTEGRACAO.md §6`:
> contratos em `core`, ninguém inventa junção). Aqui ficam os **campos e o efeito**.

### Documentos & artefactos (geração — flui livre)

| Ferramenta | Descrição | Input (Zod conceptual) | Efeito | Slot | Confirma? |
|---|---|---|---|---|---|
| `gen_spreadsheet` | Gera planilha **.xlsx** (comparação, pipeline, shortlist) — artefacto que ela baixa | `{ kind: 'comparison'\|'pipeline'\|'shortlist', candidateIds?: string[], vagaId?: string, columns?: string[] }` | `geração` | `ARCHITECT` | NÃO |
| `gen_cv` | Reformata/melhora um CV no template do cliente → **.docx/.pdf** | `{ candidateId: string, templateClientId?: string, format: 'docx'\|'pdf', tone?: string }` | `geração` | `ARCHITECT` | NÃO |
| `gen_parecer` | Gera o parecer da entrevista (3 lentes) — entregável | `{ interviewId: string, candidateId: string, format?: 'md'\|'pdf' }` | `geração` | `ARCHITECT` | NÃO |
| `gen_job_ad` | Gera anúncio de vaga / descrição | `{ vagaId: string, channel?: 'linkedin'\|'site'\|'email', tone?: string }` | `geração` | `ARCHITECT` | NÃO |
| `gen_email_draft` | Rascunha email a cliente/candidato **(NÃO envia)** — na voz dela (memória) | `{ to: string, purpose: string, context?: object, lang?: 'pt-PT'\|'pt-BR'\|'en' }` | `rascunho` | `ARCHITECT` | NÃO |
| `gen_document` | Carta, proposta, briefing, follow-up genérico | `{ type: string, context: object, format?: 'md'\|'docx'\|'pdf' }` | `geração` | `ARCHITECT` | NÃO |

> As ferramentas Office (xlsx/docx/pdf) **reaproveitam as skills de geração de ficheiros
> da CMTec** (`ASSISTENTE-PESSOAL.md §3`). O artefacto é guardado em Storage só quando
> ela manda **salvar** (→ `save_artifact`, efeito `gravar`). Gerar ≠ guardar.

### Leitura / pesquisa (flui livre)

| Ferramenta | Descrição | Input | Efeito | Slot | Confirma? |
|---|---|---|---|---|---|
| `query_data` | Procura/filtra no mundo dela (candidatos/clientes/vagas/entrevistas) via RAG+SQL | `{ entity: 'candidate'\|'client'\|'vaga'\|'interview', filters?: object, q?: string }` | `leitura` | `EXTRACTOR` | NÃO |
| `compare_candidates` | Matriz de comparação vs critérios (Modo C, `ASSISTENTE-CONVERSA`) | `{ candidateIds: string[], vagaId?: string, criteria?: string[] }` | `geração` | `ARCHITECT` | NÃO |
| `web_search` | Pesquisa web geral (Exa/Brave) | `{ q: string, freshness?: 'day'\|'week'\|'month', provider?: 'exa'\|'brave' }` | `leitura` | `—` | NÃO |
| `calendar_read` | Lê eventos do Google Calendar | `{ from: string(date), to: string(date), calendarId?: string }` | `leitura` | `—` | NÃO |

### Gravar (durável — CONFIRMA)

| Ferramenta | Descrição | Input | Efeito | Slot | Confirma? |
|---|---|---|---|---|---|
| `save_artifact` | Salva no Storage um documento gerado (CV/planilha/parecer) | `{ artifactRef: string, entity?: string, entityId?: string, name: string }` | `gravar` | `—` | **SIM** |
| `upsert_candidate` | Cria/edita candidato | `{ id?: string, fields: object }` | `gravar` | `EXTRACTOR` | **SIM** |
| `upsert_client` | Cria/edita cliente | `{ id?: string, fields: object }` | `gravar` | `EXTRACTOR` | **SIM** |
| `upsert_vaga` | Cria/edita vaga (pode extrair requisitos de texto colado) | `{ id?: string, clientId: string, rawText?: string, fields?: object }` | `gravar` | `EXTRACTOR` | **SIM** |
| `save_memory_fact` | Grava facto na memória dela (`recruiter_memory_fact`) | `{ kind: 'style'\|'preference'\|'pattern'\|'template', text: string, source?: 'explicit'\|'inferred' }` | `gravar` | `—` | **SIM** |

> **`save_memory_fact` confirma?** Sim por defeito (é gravar durável). **Exceção
> operacional:** factos `source='inferred'` capturados pela aprendizagem contínua
> (`ASSISTENTE-PESSOAL.md §4`) entram **sem prompt** mas **sempre auditados e
> editáveis/apagáveis** por ela (RGPD). A porta de confirmação aplica-se ao **save
> explícito** que o agente propõe na conversa ("queres que guarde que assinas 'Abraço'?").
> Os dois caminhos gravam na mesma tabela com `source` distinto. (Coerente com `§4` e
> `§4.1`: o agente **mostra** o que guardou.)

### Enviar para fora (irreversível — CONFIRMA)

| Ferramenta | Descrição | Input | Efeito | Slot | Confirma? |
|---|---|---|---|---|---|
| `send_email` | Envia email via **Resend** (`RESEND_API_KEY`) | `{ to: string, subject: string, body: string, draftRef?: string }` | `enviar_fora` | `—` | **SIM** |
| `send_message` | WhatsApp/Telegram (Evolution API / grammy) | `{ channel: 'whatsapp'\|'telegram', to: string, body: string }` | `enviar_fora` | `—` | **SIM** |
| `calendar_create` | Cria/reagenda evento no Google Calendar | `{ title: string, start: string, end: string, attendees?: string[], calendarId?: string }` | `enviar_fora` | `—` | **SIM** |
| `join_interview` | "Vou para uma reunião"/link → põe o bot na call (LiveKit) e arranca o copiloto | `{ meetingUrl?: string, vagaId?: string, candidateId?: string }` | `enviar_fora` | `—` | **SIM** |
| `export_data` | Exporta dados (CSV/Excel/PDF) — pode sair do sistema | `{ entity: string, filters?: object, format: 'csv'\|'xlsx'\|'pdf' }` | `enviar_fora` | `—` | **SIM** |

> **`join_interview` ⭐ (a "operar a entrevista", `ASSISTENTE-PESSOAL.md §3`):** ela
> **fala** ("vou entrar numa reunião") ou cola o link — o agente trata da mecânica
> (LiveKit/captura) por trás. É `enviar_fora` (põe um bot numa call real → confirma).
> A orquestração é do agente; ela não toca em LiveKit. Liga à rota
> `POST /api/interviews/join` (`ARQUITETURA-INTEGRACAO.md §2.3`) → `realtime`.

### Sourcing & onboarding (mistos)

| Ferramenta | Descrição | Input | Efeito | Slot | Confirma? |
|---|---|---|---|---|---|
| `source_candidates` | Sourcing via **Apify** (reusa skills `lead-scraper-apify` + `lead-enricher` do Hermes) → cria `process` | `{ vagaId: string, query: string, maxResults?: number, enrich?: boolean }` | `gravar` | `EXTRACTOR` | **SIM** |
| `save_onboarding` | Guarda respostas da lista de onboarding → `recruiter_memory_fact` (origem `explicit`) | `{ answers: { block: string, q: string, a: string }[] }` | `gravar` | `—` | **SIM** |

> **`source_candidates`:** o **disparo** é livre (procurar é leitura), mas **criar o
> `process` + gravar os perfis** é `gravar` → confirma antes de materializar candidatos
> no pipeline. Reusa Apify (5 tokens + token broker já em produção no Hermes) — **não há
> browser automation no LinkedIn** (decisão LOCKED, evita ToS/deteção,
> `ASSISTENTE-PESSOAL.md §3`). É **assíncrona** (ver A.3).
>
> **`save_onboarding`:** uma confirmação para o lote todo (não uma por resposta) — a
> lista é conversa, não formulário (`ASSISTENTE-PESSOAL.md §4.1`). Liga a
> `POST /api/assistant/onboarding`.

### A.1.1 Segurança das ferramentas de REDE e de conteúdo não-confiável (loop segurança 2026-06-18)

As ferramentas `leitura` **fluem livres** (não confirmam) — o que as torna o vetor de
entrada de **SSRF e prompt-injection** (`SEGURANCA.md §2/§9`). Contratos **obrigatórios**:
- **`web_search`, `query_data` (parte web), `source_candidates` (Apify), e qualquer fetch de
  URL dada pelo candidato/cliente** (pesquisa ao vivo, `ARQUITETURA-TEMPO-REAL §9`) **TÊM de
  passar pelo cliente HTTP guardado** (allowlist de esquema + bloqueio de IP interno antes/
  depois de redirects). O mesmo vale para `document_tools` (`url_to_pdf`/`screenshot_url`,
  Playwright). Tool de rede que **não** use o funil = bug de segurança. (`SEGURANCA §2`.)
- **`join_interview {meetingUrl}`** valida o destino contra **allowlist de domínios de
  reunião** (meet/zoom/teams) — não junta o bot a uma URL arbitrária (`SEGURANCA §2`).
- **Conteúdo fetchado = dados, nunca instruções.** O PLANEADOR **não pode originar** ações
  `gravar`/`enviar_fora` **a partir de texto vindo da web/CV/transcrição** — só a pedido
  explícito da Filipa (a porta de confirmação mantém-se, mas a *origem* é vedada). (`SEGURANCA §9`.)
- **`save_memory_fact` com origem externa** (web/CV) entra **sempre `a_confirmar`** + auditado
  (nunca `direto` auto-persistido) — anti memory-poisoning (`SEGURANCA §9`, `MODELO-DADOS §7`).

---

## A.2 Como se regista uma ferramenta nova (sem tocar no grafo)

O grafo (Roteador→Planeador→Executor→Verificador→Respondedor) é **fixo**. Para dar uma
capacidade nova ao assistente:

1. **Definir o input schema** em `packages/core` (Zod) e o descritor `{ nome, descrição,
   input, efeito, slot_modelo, async, custo_estimado }`.
2. **Implementar o handler** em `services/agent/tools/<nome>.py` — recebe `args`
   validados, devolve `{ result_ref?, summary, ... }`. Handler **puro de efeitos
   declarados**: não pode ter efeito além do que `efeito` promete (um `leitura` nunca
   grava). Falha → levanta, não engole (sem falhas silenciosas).
3. **Registar** no `TOOL_REGISTRY` (dict nome→descritor). O EXECUTOR descobre as
   ferramentas a partir daqui; o LLM recebe os descritores como tool definitions.
4. **Porta de segurança automática:** se `efeito ∈ {gravar, enviar_fora}`, o runtime
   intercepta **antes** de executar, cria a `assistant_action` `pending_confirm`, e
   devolve à UI uma proposta. Não há confirmação "à mão" por ferramenta — é derivada do
   `efeito`. (Não chatear: `leitura/rascunho/geração` saltam isto.)
5. **Auditoria automática:** o wrapper escreve sempre em `assistant_action`. O handler
   não precisa de se lembrar.

> Resultado: a superfície que muda ao adicionar uma tool é **o registry + um handler**.
> O grafo, a porta de confirmação e a auditoria são transversais e não se tocam — é o
> que torna o agente extensível sem reabrir o core (decisão `ASSISTENTE-PESSOAL.md §2.1`).

---

## A.3 Ferramentas longas (assíncronas, com progresso)

Algumas ferramentas (`source_candidates`, exportações grandes, geração de muitos
documentos) **não cabem num turno** de chat. Padrão:

- A tool declara `async: true`. Ao ser chamada, o EXECUTOR **não bloqueia**: cria um
  **job** (estado em Postgres / Redis, `REDIS_URL`), responde já *"a procurar…"* e
  devolve um `jobId`.
- O job corre fora do request. Emite **progresso** que chega à UI — reusando o canal
  WebSocket (ver Parte B): mensagem `alert`/tick com o `jobId` e percentagem
  (*"3 perfis encontrados"*). (Não inventamos um tipo novo de WS sem o pôr em
  `packages/core` primeiro, `ARQUITETURA-INTEGRACAO.md §6`.)
- Ao terminar: a tool de efeito durável (ex.: criar `process`) entra na **porta de
  confirmação** só **no fim** (ela confirma materializar os resultados), não antes de
  pesquisar.
- **Degrada e avisa, não finge:** se a API (Apify, etc.) cair ou a plataforma bloquear,
  o job termina `failed`, a `assistant_action` fica `failed`, e a UI mostra o erro real
  (`ASSISTENTE-PESSOAL.md §3` + `§2.1`). Sem sucesso falso.

> Coerência de concorrência (`ARQUITETURA-TEMPO-REAL §11`): durante uma entrevista ao
> vivo o motor ao vivo é o **escritor único** do estado da entrevista; o agente **só lê**
> nesse período, e qualquer tool pesada do agente corre **assíncrona** fora do caminho do
> tick. As tools de `gravar`/`enviar_fora` do agente não competem com a escrita do tick.

---

## A.4 Orçamento por pedido (anti-loop / anti-custo)

Herdado do Lince Brain (`ASSISTENTE-PESSOAL.md §2.1` "Salvaguardas") e ligado à
disciplina de tokens (`ARQUITETURA-TEMPO-REAL §3`):

- **Limite de passos por pedido** (nº de tool-calls num ciclo ReAct) — estourou →
  o agente **para e pergunta** ("isto está a dar voltas, queres que continue?"), não
  faz loop infinito.
- **Limite de tokens/custo por pedido** — o PLANEADOR estima custo antes; se for caro
  (ex.: gerar 50 CVs), **pede orientação** em vez de avançar.
- **Limite de chamadas externas pagas** (Apify/Exa/Brave) por pedido — protege a fatura.
- Estouro de orçamento **regista em `assistant_action`** (`status='failed'` + razão) →
  auditável, e o **kill switch** corta se descarrilar.

---

# Parte B — Auth do WebSocket (implementação)

> Fecha o detalhe de implementação do desenho já LOCKED em `AUTENTICACAO.md §4` e §8.
> Os **tipos de mensagem** são os de `ARQUITETURA-INTEGRACAO.md §2.4` — **não se
> redefinem aqui**, reusam-se.

## B.1 Porquê na 1ª mensagem e não na query-string

O `access_token` (JWT do Supabase) vai na **primeira mensagem** do WebSocket, **nunca**
em query-string (`AUTENTICACAO.md §4`). Razão: query-strings ficam em **logs de
servidor, histórico de proxy e referrers** → o token vazaria. O handshake HTTP de
upgrade do WS não leva o token; ele só viaja **dentro** do canal já aberto, no primeiro
frame.

## B.2 Handshake passo-a-passo

```
[cliente: apps/desktop ou apps/web]
   │ 1. abre o WS (wss://… , sem token no URL)
   │ 2. 1ª frame:  { "type": "auth", "accessToken": "<JWT Supabase>", "interviewId": "<uuid>" }
   ▼
[servidor: apps/ws]
   │ 3. verifica assinatura do JWT com o segredo do Supabase + valida `exp`
   │ 4. extrai `sub`  → recruiter_id
   │ 5. VERIFICA POSSE:  SELECT 1 FROM interview WHERE id=$interviewId AND recruiter_id=$recruiter_id
   │ 6a. tudo OK  → { "type": "auth.ok" }  → começa a empurrar tick.update / suggestion.next / coverage.update / alert
   │ 6b. falha     → { "type": "auth.error", "code": "...", "reason": "..." } → FECHA o socket (close code abaixo)
```

**Estado da ligação:** até receber `auth.ok`, a ligação está **não-autenticada** e o
servidor **não empurra nada** (nenhum tick, nenhuma sugestão). Uma ligação que mande
qualquer outra coisa antes da frame `auth` é fechada.

> Mensagens `auth` / `auth.ok` / `auth.error` são **frames de controlo do WS** —
> devem ser adicionadas aos tipos de `packages/core` junto dos de `§2.4`
> (`tick.update`, `suggestion.next`, `coverage.update`, `alert`). Regra de ouro: o
> contrato muda em `core` primeiro (`ARQUITETURA-INTEGRACAO.md §6`).

## B.3 Verificação de posse da entrevista (a query)

Saber o `interviewId` **não chega** — tem de ser **dele** (`AUTENTICACAO.md §4`):

```sql
SELECT 1 FROM interview WHERE id = $interviewId AND recruiter_id = $recruiterId;
```

Sem linha → `auth.error` + fecha. É isto que impede uma ligação qualquer de espreitar as
sugestões privadas do overlay. **Mantém-se mesmo em v1 single-tenant** (só IRIS): o
risco cross-tenant não existe na v1, mas a posse da entrevista é a fronteira que
protege o conteúdo ao vivo.

> **Decisão (loop segurança 2026-06-18):** a query de posse leva **`AND agency_id = $agencyId`
> já na v1** (derivado do JWT), como **defesa-em-profundidade** — `agency_id` é predicado
> obrigatório em TODO o acesso a dados desde já (`AUTH-CONTRACT §7`, `SEGURANCA §1`). Redundante
> na v1, essencial na v2; a v2 liga RLS por cima. Não se adia o filtro para a v2.

## B.4 Mensagens depois do `auth.ok` (reuso, não redefinição)

O servidor passa a empurrar os tipos já definidos em `ARQUITETURA-INTEGRACAO.md §2.4`:

| Tipo | Origem | Quando |
|---|---|---|
| `tick.update` | `realtime` → `ai(LIVE)` → `ws` | a cada tick do estado vivo |
| `suggestion.next` | idem | nova pergunta sugerida (lente técnica/cliente/gap) |
| `coverage.update` | idem | mudou a cobertura de requisitos |
| `alert` | idem / jobs do agente | contradição detetada, ou **progresso de tool assíncrona** (A.3) |

Fluxo do estado vivo: `realtime` agrega transcrição → `ai(LIVE)` devolve `EstadoVivo` →
publica em `apps/ws` → empurra para a UI (`ARQUITETURA-INTEGRACAO.md §2.5`).

## B.5 Expiração + refresh silencioso

O JWT do Supabase **expira a meio das 2h** de entrevista. Não pode interromper a Filipa
(`AUTENTICACAO.md §4`, §8):

- O servidor sabe o `exp` (passo B.2.3). **Antes** de expirar (margem ~60s), avisa:
  `{ "type": "auth.refresh_needed" }`.
- O cliente obtém um `access_token` novo do Supabase via `refresh_token` (guardado no
  `safeStorage` cifrado no desktop; sessão do browser na web) e **reenvia** uma frame
  `auth` com o token novo no **mesmo socket** — sem reabrir, sem perder o stream.
- Servidor re-verifica (assinatura + `exp` + posse) → `auth.ok`. A Filipa **não nota**.
- Se o refresh falhar (refresh_token inválido/revogado) → `auth.error` + fecha → o
  cliente cai para o ecrã de login (biometria/email+senha, `AUTENTICACAO.md §2`).

## B.6 Reconexão

- **Queda de rede:** o cliente reconecta com **backoff exponencial** (1s, 2s, 4s… teto
  ~30s) e repete o handshake B.2 com o token corrente. O estado vivo **vive no servidor**
  (escritor único, `ARQUITETURA-TEMPO-REAL §11`) → ao re-autenticar, o servidor manda um
  **snapshot** do `EstadoVivo` corrente (não só deltas) para a UI re-sincronizar.
- **Token expirou durante a queda:** o reconnect já manda o token refrescado (B.5).
- **Idempotência:** reabrir a ligação não duplica a entrevista nem reinicia a captura
  (essa é do `apps/desktop`/`realtime`, separada do WS de leitura).

## B.7 O que acontece a uma ligação não-autorizada

| Situação | Resposta | Close code (convenção) |
|---|---|---|
| JWT inválido / assinatura errada | `auth.error code="invalid_token"` | `4401` |
| JWT expirado (e sem refresh) | `auth.error code="token_expired"` | `4401` |
| Sem posse da entrevista (passo B.3 vazio) | `auth.error code="forbidden"` | `4403` |
| Frame não-`auth` antes de autenticar | fecha sem detalhe | `4400` |
| `interviewId` malformado/ausente | `auth.error code="bad_request"` | `4400` |

Códigos `44xx` são do espaço **privado de aplicação** do WebSocket (`4000–4999`),
escolhidos para ecoar os HTTP `401/403/400` — facilita o debug e os testes
(`TESTES-ACEITACAO.md`). A confirmar na construção (não bloqueante).

## B.8 Notas de segurança

- **Token só dentro do canal** (B.1) — nunca em URL/log.
- **Servidor valida a assinatura** com o segredo do Supabase (sops+age,
  `ARQUITETURA-INTEGRACAO.md §3`); **não confia** em claims sem verificar.
- **Posse re-verificada a cada (re)auth**, não só na 1ª ligação (revogação reflete-se no
  próximo refresh; janela ≤ tempo de vida do JWT).
- **Email/recruiter_id nunca vêm do cliente** — derivam sempre do JWT verificado
  (`sub`), espelhando a regra do device-binding do painel (`AUTENTICACAO.md §3`).
- **Transporte:** WSS sobre túnel Cloudflare (`AUTENTICACAO.md §8`).
- **Re-auth periódica:** a re-autenticação facial periódica (24h, `AUTENTICACAO.md §8`)
  invalida sessões antigas → o próximo refresh do WS falha → liga-se de novo. Perda/roubo
  do PC: ela revoga o dispositivo (`trusted_devices`) → refresh falha → socket morre, sem
  expor dados (estão na VPS).
- **Multi-dispositivo:** vários sockets do mesmo recrutador na mesma entrevista são
  permitidos (PC novo continua de onde estava, `AUTENTICACAO.md §8`); cada um autentica
  e verifica posse independentemente.

---

## Resumo & decisões em aberto

**Escrevi:** um doc novo `AGENTE-TOOLS-E-WS.md` com duas partes. **Parte A** — o tool
registry executável do assistente: descritor padrão `{nome, descrição, input(Zod),
efeito, slot_modelo, async, custo_estimado}`, ~22 ferramentas em tabelas por categoria
(documentos/leitura/gravar/enviar_fora/sourcing+onboarding) com a porta de confirmação
derivada do `efeito`, o processo de registar uma tool nova sem tocar no grafo, o padrão
de tools assíncronas com progresso, e o orçamento por pedido. **Parte B** — auth do WS:
handshake passo-a-passo (frame `auth` com JWT na 1ª msg), query de posse, refresh
silencioso, reconexão com snapshot, tabela de close codes para ligações não-autorizadas,
e notas de segurança. Tudo **referencia** os docs existentes, não os redefine.

**Decisões em aberto que encontrei (para o Mateus/sessão decidir):**
1. **Frames de controlo do WS** (`auth`/`auth.ok`/`auth.error`/`auth.refresh_needed`) e o
   tipo de **progresso de job assíncrono** ainda não estão em `ARQUITETURA-INTEGRACAO §2.4`
   — têm de ser acrescentados a `packages/core` quando se construir (sinalizei no doc).
2. **Close codes `44xx`** são convenção minha (espaço privado WS) — a ratificar.
3. **`save_memory_fact` com `source='inferred'`** salta a confirmação (só auditado +
   editável); o save **explícito** confirma. Documentei a regra, mas é uma escolha de
   produto que vale a pena a Filipa validar (quão "falador" deve ser ao guardar factos).
4. **`assistant_action` não tem coluna `efeito`** — mapeei `efeito → needs_confirm` e
   deixei o `efeito` a viver no registry (código). Se quiserem o `efeito` persistido para
   auditoria mais rica, é um `ALTER TABLE` (decisão de `MODELO-DADOS`, não toquei).
