# Modelos & camada de API — agnóstica ao fornecedor (troca-se, não se reescreve)

> **Princípio (Mateus, 2026-06-17):** **construímos tudo nós**, mas o cérebro corre
> **100% via API** (sem modelos caseiros). É um **produto para vender** ("sair de
> nós") → **não pode estar amarrado ao Claude.** O comprador tem de poder usar **outro
> LLM** (Gemini com melhor RAG, um modelo mais barato que o Opus, outro STT melhor) sem
> reescrever nada. Por agora hospedado connosco e o Mateus paga (OpenRouter); ao
> vender, trocam-se as chaves/modelos e muda para a VPS do comprador.

---

## 1. A regra de ouro: pensar em CAPACIDADES, não em "Claude"

O sistema **não chama "o Opus"** — chama uma **capacidade**. Cada capacidade é um
**slot configurável** que aponta para um modelo/fornecedor à escolha do deployment.
Trocar de modelo = mudar **config**, nunca código.

| Slot (capacidade) | O que faz | Requisitos do slot (o que NÃO pode partir) | **Default nosso** |
|---|---|---|---|
| `EXTRACTOR` | extração estruturada barata (CV, vaga, destilar) | output estruturado (JSON), barato | Haiku 4.5 |
| `ARCHITECT` | raciocínio de qualidade (rubric, briefing, parecer, comparação) | raciocínio forte + contexto longo + JSON | Opus 4.8 |
| `LIVE` | raciocínio AO VIVO (frame, aprofundamento, veredito, chat) | **baixa latência** + streaming + JSON + tool-use | Sonnet 4.6 |
| `EMBEDDER` | vetores para RAG (pgvector) | dimensão fixa por modelo (ver §3) | text-embedding-3-small (1536d) |
| `STT` | transcrição + diarização ao vivo | streaming + diarização + multi-idioma + sessão 2h | Soniox |

> Os defaults são a **nossa recomendação** (o melhor equilíbrio qualidade/latência/custo
> que encontrámos), **não** um requisito. Um cliente pode pôr `ARCHITECT=gemini-2.x`,
> `EMBEDDER=gemini/voyage`, `STT=deepgram/whisper` — desde que o slot cumpra os
> requisitos da coluna do meio.

---

## 2. Como se troca (config, não código)

- **Chat (`EXTRACTOR`/`ARCHITECT`/`LIVE`)**: **v1 = SÓ via OpenRouter** (decisão Mateus
  2026-06-17 — uma integração só, simples; chave única, centenas de modelos de vários
  fornecedores, fallback). Provedores diretos ficam para v2 se fizer falta.
- **A Filipa troca o modelo na própria app/site** (NÃO é preciso mexer em ficheiros):
  basta a **chave do OpenRouter** estar posta → no ecrã de **Definições**, cada slot
  (`EXTRACTOR`/`ARCHITECT`/`LIVE`) tem um seletor com o **catálogo do OpenRouter**
  (nome + preço/1k tokens visível) e ela escolhe **qualquer modelo de lá**, por slot.
  *(Resposta direta ao Mateus: sim — uma chave OpenRouter = acesso a trocar entre todos
  os modelos do catálogo.)*
- **O seletor é FILTRADO por slot** pelas amarras do §3: no slot **`LIVE`** só aparecem
  modelos de **baixa latência** + JSON/tool-use; no `ARCHITECT` os de raciocínio
  forte/contexto longo. Evita que ela escolha (sem saber) um modelo que parte o tempo
  real. Mostra um aviso se um modelo não cumprir o requisito do slot.
- *O ecrã detalha-se na embalagem (`UI-DESIGN`); a capacidade decide-se aqui.*
  Guarda-se por deployment (e por agência na v2).
- **Embedder e STT NÃO passam pelo OpenRouter** (ele só faz chat/completions) → têm o
  seu próprio provedor configurável (ex.: OpenAI/Gemini para embeddings; Soniox/Deepgram
  para STT). Honesto: "só OpenRouter" vale para os slots de **chat**.
  Cada slot de chat tem um `model_id` em config (default, que a Filipa pode trocar na UI):
  ```env
  MODEL_EXTRACTOR=anthropic/claude-haiku-4-5   # ou google/gemini-..., openai/gpt-..., etc.
  MODEL_ARCHITECT=anthropic/claude-opus-4-8     # trocável se Opus for caro demais
  MODEL_LIVE=anthropic/claude-sonnet-4-6        # tem de ser de baixa latência
  EMBEDDER=openai/text-embedding-3-small        # ver §3 (dimensão!)
  STT_PROVIDER=soniox                           # ou deepgram, whisper, gemini-audio...
  ```
- **Interface fina por capacidade** no código: `chat(messages, schema)`,
  `embed(texts)`, `transcribe(stream)`. Cada fornecedor é um **adapter** atrás desta
  interface → adicionar um modelo novo = um adapter, não mexer no cérebro.
- **Chaves por deployment** (sops+age): `OPENROUTER_API_KEY` (ou as diretas),
  `STT_API_KEY`, `EMBEDDER_API_KEY`, web search, Google OAuth. Vender = trocar chaves +
  host. (Coerente com D4: Docker Compose → portável para a VPS do comprador.)

---

## 3. Os limites reais ao trocar (o "não quebra as coisas")

Trocar é livre, **mas há 3 amarras técnicas a respeitar** — documentadas para o
comprador não se queimar:

1. **EMBEDDER muda a dimensão do vetor.** `text-embedding-3-small`=1536, Gemini/Voyage
   diferem. A coluna `pgvector` é de **dimensão fixa** → trocar de embedder obriga a
   **re-gerar todos os embeddings** e ajustar a dimensão. Logo: o embedder escolhe-se
   **no arranque do deployment**, não a meio. (Mitigação: dimensão em config + script
   de re-index.)
2. **LIVE tem de ser mesmo rápido.** O slot ao vivo corre a cada tick durante 2h — um
   modelo lento parte a experiência (`REVISAO-360` B4). Nem todo o modelo serve aqui,
   mesmo que seja "melhor" noutra coisa. O slot **avisa** se a latência média passa o
   orçamento (1–3 s, §3 tempo-real).
3. **JSON / tool-use obrigatório** nos slots `LIVE` e `ARCHITECT` (o frame e a
   comparação dependem de output estruturado). Um modelo sem structured output fiável
   não entra nesses slots (pode entrar no `EXTRACTOR` com parsing defensivo).

> Mensagem ao comprador: *"usa o LLM que quiseres — só respeita estas 3 amarras."*

### Registry de capacidades (cada modelo declara o que sabe — não só o nome) — 2026-06-18
Para o sistema escolher/validar um modelo num slot, cada entrada do registry tem
**capacidades**, não só o id:
```jsonc
{ "id": "anthropic/claude-sonnet-4-6", "slots": ["LIVE","EXTRACTOR"],
  "supports_json": true, "supports_tools": true, "supports_streaming": true,
  "supports_prompt_cache": true, "max_context": 200000, "cost_in": .., "cost_out": .. }
```
- O seletor da app (Definições) **filtra por slot** usando estas flags (no `LIVE` só
  modelos com `streaming`+`tools`+baixa latência; no `ARCHITECT` `json`+contexto longo).
- **Embedder TRAVADO na v1:** `EMBEDDER = text-embedding-3-small`, **dimensão 1536 fixa**
  (a coluna `pgvector` é 1536). **Trocar o embedder = v2** (obriga re-index de todos os
  vetores — `§3` amarra 1). Não é configurável "ao vivo" na v1.

---

## 4. Custo & venda

- **Custo dominante real:** **STT por hora** + **ticks do slot LIVE** (× 2h). Os slots
  de qualidade (`ARCHITECT`) são 1× por vaga/entrevista. Dashboard por entrevista
  (`REVISAO-360` F1/F2). Trocar o `ARCHITECT`/`STT` por algo mais barato é a alavanca
  de custo nº1 do comprador — por isso tem de ser fácil.
- **Sair de nós:** chega "pronto a apresentar" **já com APIs ligadas** (defaults
  nossos) — o cliente vê-o a funcionar e depois afina os modelos ao gosto/orçamento.
- **Multi-tenant (v2):** cada agência traz as suas chaves/modelos; `agency_id` já está
  na costura (`MODELO-DADOS §RLS`). Slots **por agência** no futuro.
- **Margem:** custo é quase só uso (API+STT) → preço de venda é quase todo margem
  depois do build (modelo CMTec).

> **Princípio de roteamento (a nossa recomendação de defaults):** qualidade onde *é* o
> produto (`ARCHITECT`: rubric, briefing, parecer, comparação) · latência onde manda
> (`LIVE`: tudo ao vivo) · barato no trivial (`EXTRACTOR`). Reavaliar com **custo real**.
> Reclassificámos o **parecer** para o slot `ARCHITECT` (era Sonnet no `§5`): é o
> entregável, sem pressão de tempo.

---

## 5. Falha de modelo a meio + fallback por slot (gap simulação "falha de infra" 2026-06-18)

Faltava o que acontece quando o modelo de um slot **falha a meio** (429/timeout/5xx/
indisponível). Há **dois níveis** de fallback, complementares:

1. **Fallback de PROVIDER (transparente, do OpenRouter):** o OpenRouter já reencaminha
   entre fornecedores do **mesmo** modelo por baixo. Não precisamos de o gerir.
2. **Fallback de MODELO (nosso, explícito):** cada slot tem uma **lista ordenada**, não um
   único `model_id`. Se o primário falha de forma sustentada, desce-se na lista:
   ```env
   MODEL_LIVE=anthropic/claude-sonnet-4-6, anthropic/claude-haiku-4-5   # primário, secundário
   MODEL_ARCHITECT=anthropic/claude-opus-4-8, anthropic/claude-sonnet-4-6
   MODEL_EXTRACTOR=anthropic/claude-haiku-4-5
   ```
   - A **Filipa edita esta lista** no ecrã de Definições (mesmo seletor filtrado por slot do
     §2; o 2.º+ modelo é o "plano B"). O secundário **tem de cumprir as mesmas amarras** do
     slot (§3) — no `LIVE`, baixa latência + streaming + tools.

**Comportamento ao vivo (slot `LIVE`)** — a escada concreta (timeouts, nº de falhas,
degradação para "só transcrição") **vive em `RESILIENCIA-E-FALHAS.md §3`**: tick com
`TICK_TIMEOUT_MS`; falha pontual → tick saltado (Camada A continua); `TICK_FAIL_FALLBACK`
falhas → desce para o secundário e avisa "modo reduzido"; `TICK_DEGRADE_MS` sem sucesso →
"só transcrição" e re-sobe quando recupera. **A entrevista nunca cai por falha de modelo.**

**Comportamento offline (`ARCHITECT`/`EXTRACTOR`):** sem pressão de tempo → retry com
backoff e, se persistir, desce na lista; o parecer/rubric podem esperar (não são
latência-críticos). Um parecer só se marca "gerado" quando um modelo do slot respondeu.

> Registo: cada tick grava `interview_tick.model_used` (`MODELO-DADOS §14`) → dá para ver
> **quanto tempo se correu em fallback** (e o impacto no custo/qualidade) no dashboard.
