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

- **Chat (`EXTRACTOR`/`ARCHITECT`/`LIVE`)**: roteado por **OpenRouter** (chave única,
  centenas de modelos de vários fornecedores, fallback) **ou** direto ao fornecedor.
  Cada slot tem um `model_id` em config:
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
