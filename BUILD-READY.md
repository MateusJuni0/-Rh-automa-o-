# Build-Ready — o que está decidido e o que falta confirmar

> **Status (2026-06-16):** spec completa. 4 decisões bloqueadoras aguardam aprovação
> do Mateus. Quando fechadas, o scaffold (P0.1) pode começar no dia seguinte.

---

## ✅ Tudo o que está decidido e spec'd

### Produto e fluxo
- [x] **MVP = copiloto ao vivo** (não async-first). Ver `ARQUITETURA-TEMPO-REAL.md`.
- [x] **Fluxo real = headhunting** (1 candidato de cada vez, não triagem em massa).
- [x] **Antes:** vaga + candidato → Role Profile (externo) → Rubric → Briefing.
- [x] **Durante:** transcrição ao vivo (Soniox + LiveKit) + estado vivo + sugestões por WebSocket.
- [x] **Depois:** parecer em linguagem simples + export md/pdf + email rascunho.
- [x] **Painel lateral fixo** (não popup) durante a entrevista.
- [x] **Lente do cliente** (3 lentes: técnica, o que ESTE cliente quer, gaps do CV).

### Anti-achismo
- [x] **Camada de conhecimento externo** (Role Profile via web search) elimina o "bot não sabe o que é bom". Ver `CAMADA-CONHECIMENTO.md`.
- [x] **Rubric** (gabarito fraco/ok/forte por requisito) gerado antes de cada entrevista. Claude Opus. Ver `INTAKE-E-JULGAMENTO.md` Parte B.
- [x] **4 regras anti-achismo:** evidência obrigatória, facto vs opinião, incerteza visível, linguagem simples. Ver `INTAKE-E-JULGAMENTO.md` Parte C.
- [x] **Calibração:** veredito do cliente → precisão do bot ao longo do tempo. Ver Parte D.

### Ingestão automática
- [x] **Canal A:** upload direto na web app (MVP).
- [x] **Canal B:** Telegram bot — fluxo completo spec'd. Ver `TELEGRAM-BOT-SPEC.md`.
  - Setup de conta (código de ligação), identificação do cliente, mensagem de voz, multi-mensagem, CV, requisitos pontuais, consultas rápidas.
- [x] **Canal C:** WhatsApp via Evolution API — só após Canal B validado.
- [x] **Confirmação antes de gravar** (human-in-loop) — nunca grava silenciosamente.
- [x] **Proveniência em cada facto** (de onde veio, quando, trecho original).

### Modelo de dados
- [x] Todas as tabelas desenhadas. Ver `MODELO-DADOS.md`.
  - `agency`, `recruiter` (+ telegram_chat_id), `client`, `job`, `document`
  - `role_profile`, `rubric`
  - `candidate`, `candidate_memory_fact` + embedding (pgvector)
  - `client_memory_fact` + embedding, `client_verdict` (calibração)
  - `interview`, `interview_tick`, `report`
  - `intake_session` (multi-mensagem Telegram), `intake_message`
- [x] RLS multi-tenant por `agency_id` em todas as tabelas.
- [x] Embeddings: **pgvector** no Supabase self-hosted (D3 — já confirmado).

### Modelos de IA por tarefa
- [x] Extração de documentos / classificação → **Haiku 4.5**
- [x] Match candidato vs vaga → **Sonnet 4.6**
- [x] Rubric + Briefing + Parecer → **Opus 4.8**
- [x] Copiloto ao vivo (ticks) → **Sonnet 4.6** (latência manda)

### Stack
- [x] **Frontend + Backend:** Next.js 15 (App Router) + TypeScript
- [x] **Validação:** Zod
- [x] **DB:** Supabase self-hosted (PostgreSQL + pgvector + Auth + Storage)
- [x] **Transcrição ao vivo:** Soniox + LiveKit (reutilizado de cmtec-voice-platform)
- [x] **Push para UI:** WebSocket (servidor separado na VPS)
- [x] **Telegram bot:** grammy (TypeScript) + PM2 na VPS + Redis para sessões

---

## 🟦 Decisões que o Mateus precisa de fechar (bloqueadoras)

### D4 — Hosting ← **DESBLOQUEIA O SCAFFOLD (P0.1) — fechar primeiro**

> Impacto: sem esta decisão, não sabemos onde configurar o scaffold.

**Recomendação:** Vercel (Next.js app) + VPS (WebSocket server)
- Vercel: deploy instantâneo, preview URLs, zero config para Next.js.
- VPS: obrigatório para WebSocket persistente (Vercel não suporta).
- Supabase já corre na VPS — sem infra nova.

Alternativa: tudo na VPS (Docker Compose) — mais simples, perde benefícios de deploy Vercel.

**Resposta:** `Vercel + VPS` / `Tudo na VPS`

---

### D1 — Web Search API ← **DESBLOQUEIA P1.2 (Role Profile)**

> Impacto: sem API de search, o bot não consegue buscar "o que é bom" para um role.

**Recomendação: Exa**
- Busca semântica (não keyword) — muito melhor para queries técnicas como "what makes a good senior React dev".
- $5/1k queries; TTL 90 dias → dezenas de queries/mês no MVP.
- SDK JS nativo (`exa-js`).
- Brave Search como fallback ($3/1k, keyword, bom para PT-BR).

**Resposta:** `Exa` / `Brave Search` / `Ambos (Exa + Brave fallback)`

---

### D2 — Bot que entra na call ← **DESBLOQUEIA P2.1 (copiloto ao vivo)**

> Impacto: sem isto, o "durante" (coração do produto) não existe.

**Recomendação: Recall.ai para MVP → LiveKit próprio quando houver volume**
- Recall.ai: 2–3 dias de integração, ~$0.60/bot-hora, cobre Meet + Zoom + Teams, diarização por faixa perfeita.
- LiveKit headless próprio: 3–5 semanas, mas zero custo operacional depois.
- O que valida o produto é a qualidade das sugestões — não o mecanismo de captura. Recall agora, migrar depois.

**Resposta:** `Recall.ai para MVP` / `LiveKit próprio desde o início`

---

### D5 — WhatsApp (Canal C) ← não bloqueia nada agora

> Já recomendado: só após Canal B (Telegram) validado com a Filipa em ≥3 docs reais.

**Resposta:** `Confirmar` / `Avançar em paralelo`

---

## 🚀 Sequência para começar a construir

```
Fechar D4 → arrancar P0.1 (scaffold + auth + schema base)
Fechar D1 → arrancar P1.2 (Role Profile web search)
Fechar D2 → arrancar P2.1 (bot na call)
D3 (pgvector) → verificar com: SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Passo 0 imediato após D4 fechada:**
```bash
npx create-next-app@latest rh-copiloto --typescript --tailwind --app
# + supabase init
# + drizzle-kit init
```

---

## 📋 Ficheiros de spec para referência durante o build

| Ficheiro | Usa quando |
|---|---|
| `VISAO-FILIPA.md` | Quem é o produto e para quem |
| `MODELO-DADOS.md` | Schema completo + DDL |
| `CAMADA-CONHECIMENTO.md` | Implementar Role Profile (P1.2) |
| `INTAKE-E-JULGAMENTO.md` | Implementar Rubric (P1.5) + regras anti-achismo |
| `ARQUITETURA-TEMPO-REAL.md` | Implementar copiloto ao vivo (P2.x) |
| `ACESSO-E-CONHECIMENTO.md` | UX, painel lateral, entregável final |
| `TELEGRAM-BOT-SPEC.md` | Implementar Canal B (P4.1) |
| `TESTES-ACEITACAO.md` | Verificar que cada passo está realmente feito |
| `DECISOES-ABERTAS.md` | Referência para D1-D5 |
| `PLANO-CONSTRUCAO.md` | Sequência P0→P4 com garantias por passo |
