# Decisões Abertas — recomendação + critério de fecho

> ✅ **FECHADAS TODAS (2026-06-16):** D4=**Tudo na VPS** · D1=Exa+Brave · D2=**LiveKit
> próprio** · D5=Telegram+WhatsApp em paralelo · D3=pgvector. Detalhe/racional em
> `BUILD-READY.md`; log em `DECISOES-E-MVP.md §11`.
>
> ⚠️ **As "Recomendações" no corpo abaixo são HISTÓRICO e algumas foram REVERTIDAS**
> (D4 recomendava Vercel → escolhido **VPS**; D2 recomendava Recall.ai → escolhido
> **LiveKit próprio**; D5 recomendava "após Telegram" → escolhido **em paralelo**).
> **Não seguir as recomendações abaixo** — valem as escolhas ✅ acima.

> Estas 5 decisões foram identificadas em `PLANO-CONSTRUCAO.md`. Cada uma tem uma
> recomendação técnica com razão. O Mateus fecha com SIM / NÃO / alternativa.
> Quando uma decisão fechar, o item vai para `DECISOES-E-MVP.md §11`.

---

## D1 — Web Search API (Camada de Conhecimento Externo)

**Pergunta:** qual API usar para o web search que alimenta o Role Profile?

| Opção | Custo | Qualidade conteúdo técnico | SDK | Latência |
|---|---|---|---|---|
| **Exa** | $5/1k queries | ⭐⭐⭐ (semântico, não keyword) | JS/Python simples | ~500ms |
| Brave Search | $3/1k queries | ⭐⭐ (keyword, cobre bem PT-BR) | REST simples | ~300ms |
| DuckDuckGo (unofficial) | grátis | ⭐ (instável, sem SLA) | não-oficial | variável |

**Recomendação: Exa**
- A Exa faz busca semântica (não keyword) — para queries como "what makes a good senior React dev" o resultado é muito superior.
- O Role Profile é gerado 1× por role-type (não por entrevista) e tem TTL de 90 dias → custo total é irrisório (dezenas de queries/mês no MVP).
- SDK JavaScript nativo (npm install exa-js) → zero fricção com Next.js.
- Brave fica como fallback se Exa ficar caro com volume.

**Critério de fecho:** Mateus diz "usa Exa" → task P1.2 começa. Se nenhuma for escolhida, DuckDuckGo não entra (sem SLA).

---

## D2 — Bot que entra na call (captura de áudio online)

**Pergunta:** construir bot LiveKit próprio (headless) ou usar Recall.ai como serviço?

| Opção | Tempo de construção | Custo | Controlo | Suporte a Meet/Zoom/Teams |
|---|---|---|---|---|
| **Recall.ai** (serviço) | 2–3 dias | ~$0.60/bot-hora | Limitado ao que a API oferece | ✅ os três |
| Bot LiveKit próprio (headless) | 3–5 semanas | infra VPS (já temos) | Total | ✅ com engenharia extra |
| Hybrid: Recall para MVP, LiveKit depois | semanas mais tarde | Recall agora, zero depois | Progressivo | ✅ |

**Recomendação: Recall.ai para MVP → LiveKit quando houver volume**
- Recall.ai entra na call como participante e devolve stream de áudio por participante — diarização perfeita sem esforço nosso.
- 2–3 dias de integração vs 3–5 semanas de engenharia própria.
- O que valida o produto não é o bot — é a qualidade das sugestões. Não gastamos semanas no scaffolding da captura.
- Quando tivermos clientes reais e o custo Recall for relevante, migramos para o bot LiveKit próprio (o pipeline Soniox já está feito; só troca o input).

**Critério de fecho:** Mateus autoriza conta Recall.ai (registo gratuito, pay-per-use) → task P2.1 pode começar.

---

## D3 — Embeddings para RAG de candidato e cliente

**Pergunta:** pgvector (Supabase) ou serviço externo (Pinecone/Weaviate)?

**Recomendação: pgvector no Supabase self-hosted** (já decidido em PLANO-CONSTRUCAO.md, só a confirmar)
- A VPS já corre Supabase com pgvector disponível.
- O volume de embeddings no MVP é baixo (centenas de factos, não milhões).
- Evita mais um serviço externo, mais um key, mais uma fatura.
- Pinecone faz sentido quando ultrapassarmos 1M+ vetores — não é o problema agora.

**Critério de fecho:** confirmar que pgvector está habilitado na instância Supabase VPS → `SELECT * FROM pg_extension WHERE extname = 'vector';` retorna 1 linha. Se não, `CREATE EXTENSION vector;`.

---

## D4 — Hosting da aplicação

**Pergunta:** onde correr o Next.js app e o servidor WebSocket?

| Componente | Opção A | Opção B |
|---|---|---|
| **Next.js app** (UI + API routes) | Vercel (free tier / Pro) | VPS CMTec (Docker + nginx) |
| **WebSocket server** (copiloto ao vivo) | Vercel não suporta WS longo | VPS (obrigatório) |
| **Soniox / LiveKit** | VPS (já em uso) | VPS (já em uso) |

**Recomendação: Vercel para Next.js + VPS para WebSocket**
- Next.js é o que a Vercel faz melhor — deploy instantâneo, preview URLs, zero config.
- O servidor WebSocket **tem de correr na VPS** de qualquer forma (Vercel não suporta conexões WS persistentes nas Edge Functions).
- Arquitetura: browser ↔ Vercel (UI, API routes assíncronas) + browser ↔ VPS:PORT (WebSocket copiloto ao vivo).
- Alternativa all-VPS simplifica o stack mas perde os benefícios de deploy do Vercel. Vale só se o custo Vercel Pro for inaceitável.

**Critério de fecho:** Mateus confirma "Vercel + VPS" → scaffold começa. Se all-VPS for preferido, mudar para Docker Compose na VPS (base já existe).

---

## D5 — WhatsApp (Canal C) — só após Telegram validado?

**Pergunta:** avançamos com WhatsApp (Canal C) em paralelo com Telegram (Canal B)?

**Recomendação: Canal C só após Canal B validado em produção**
- Canal B (Telegram) e Canal C (WhatsApp via Evolution API) têm o mesmo fluxo de negócio — a diferença é só o transporte.
- Se construímos Canal B com a lógica bem separada (intake_message → extração → confirmação), Canal C é quase um adapter.
- Evolution API já corre no VPS, então o esforço de Canal C depois de Canal B é 1–2 dias.
- Fazer os dois em paralelo agora: duplica o debug antes de sabermos se o fluxo de negócio funciona.

**Critério de fecho:** Canal B (Telegram) testado com a Filipa em ≥3 documentos reais → planear Canal C.

---

## Tabela resumida para decisão do Mateus

| # | Decisão | Recomendação | Impacto se aguardar |
|---|---|---|---|
| D1 | Web Search API | Exa | Não bloqueia P0; bloqueia P1.2 |
| D2 | Bot de call | Recall.ai para MVP | Não bloqueia P0-P1; bloqueia P2.1 |
| D3 | Embeddings | pgvector (confirmar extensão) | Bloqueia P3.3 |
| D4 | Hosting | Vercel (app) + VPS (WS) | Bloqueia P0.1 |
| D5 | WhatsApp | Após Telegram validado | Não bloqueia nada agora |

**Próximo passo:** Mateus lê, confirma D4 primeiro (desbloqueia o scaffold P0.1), depois D1 e D2 à medida que avançamos.
