# BRAIN — RH Automação

> Contexto vivo do projeto. Status rápido + decisões. Carregar no início de cada sessão.

## O que é
Copiloto de IA para **agência de RH** (a Filipa intermédia profissionais para empresas-clientes).
Jornada: **Ingestão de docs → Briefing (roteiro) → Copiloto AO VIVO → Relatório → Memória**.

## Status (2026-06-17 — spec FECHADA, dispatch-ready)

**Fase: spec 100% completa, decisões D1–D5 LOCKED, doc de integração escrito.
Pronto para dispatchar subagentes (scaffold P0.1 ainda não arrancado — Mateus quis
planear tudo primeiro). Entrada: `BUILD-READY.md`. Cola para paralelo: `ARQUITETURA-INTEGRACAO.md`.**

Docs desta iteração (loop /):
- `TELEGRAM-BOT-SPEC.md` (NOVO) — fluxos A–E completos, commands, edge cases, API endpoints, tech stack grammy+Redis
- `BUILD-READY.md` (NOVO) — checklist do que está decidido + 4 perguntas ao Mateus (D1-D4)
- `MODELO-DADOS.md` (ATUALIZADO) — `recruiter.telegram_chat_id`, tabela `intake_session`, campos Telegram em `intake_message`
- `ACESSO-E-CONHECIMENTO.md §8` (ATUALIZADO) — voz + multi-mensagem + problema de identificação de cliente resolvido
- `PLANO-CONSTRUCAO.md P4.1` (ATUALIZADO) — sub-passos a→d + referência ao TELEGRAM-BOT-SPEC.md
- `TESTES-ACEITACAO.md` (ATUALIZADO) — P4.1a-d com critérios para voz, multi-mensagem, CV, setup

Docs escritos na 1ª iteração (commits `a819a9a` + `5ccce44`):
- `CAMADA-CONHECIMENTO.md` — Role Profile JSON, 3 sub-camadas, caching, migração progressiva web→interno
- `ACESSO-E-CONHECIMENTO.md` — base 3 canais de ingestão de docs
- `PLANO-CONSTRUCAO.md` — 14 passos (P0–P4) com entrada/saída/garantia verificável
- `MODELO-DADOS.md` — 16 tabelas SQL + DDL completo + RLS + índices
- `DECISOES-ABERTAS.md` — 5 decisões com recomendação técnica (D1-D5)
- `TESTES-ACEITACAO.md` — critérios de aceitação por passo + 4 regras anti-achismo como testes

## Decisões fechadas

1. **MVP = copiloto AO VIVO desde o início** (não async-first).
2. **Transcrição:** tempo real + diarização + análise ao vivo (sessões 2h). Reusa **Soniox + LiveKit**.
3. **Consentimento/LGPD:** não é bloqueador — onboarding.
4. **Stack:** Next.js 15 + Supabase (self-hosted VPS). Sonnet 4.6 ao vivo, Opus 4.8 roteiro/relatório.
5. **Captura de áudio:** híbrido C — bot online primeiro, presencial local a seguir.
6. **Fluxo real = headhunting** (1 candidato de cada vez via LinkedIn). Não triagem em massa.
7. **Camada de conhecimento externo:** Role Profile via web search (Exa recomendado) antes de cada entrevista. Migra para RAG interno com vereditos acumulados.
8. **Ingestão de docs:** 3 canais (upload web MVP → Telegram bot → WhatsApp Fase 2). Sempre com confirmação da Filipa antes de gravar.
9. **RAG por candidato e por cliente:** embeddings pgvector, factos com proveniência.
10. **Anti-achismo (4 regras):** evidência em todo veredito, facto separado de opinião, incerteza dita, linguagem simples. Ver `INTAKE-E-JULGAMENTO.md Parte C`.

## Decisões D1–D5 — FECHADAS (2026-06-17)

| # | Decisão | **Escolha do Mateus** |
|---|---|---|
| D1 | Web Search API | **Exa (principal) + Brave (fallback)** |
| D2 | Bot de call | **LiveKit próprio desde já** (reusa cmtec-voice-platform; "antes" entrega valor primeiro) |
| D3 | Embeddings | **pgvector** (Supabase self-hosted) |
| D4 | Hosting | **Tudo na VPS** (Docker Compose) — sem Vercel |
| D5 | WhatsApp Canal C | **Telegram + WhatsApp em paralelo** |

**Próximo passo imediato:** dispatchar subagentes. **Agente 1 (Fundação: `packages/db` + `packages/core` + scaffold + docker + Auth/RLS) vai PRIMEIRO**; depois 2–6 em paralelo (ver `ARQUITETURA-INTEGRACAO.md §5`).

## Crux de engenharia

**Estado vivo a custo constante em 2h:** estado estruturado comprimido + janela recente + rolling summary → Claude Sonnet por tick. Custo constante, não cresce com duração. Ver `ARQUITETURA-TEMPO-REAL.md §3`.

**Role Profile sem achismo:** web search → Role Profile JSON com `o_que_e_bom` + rubric por requisito → julgamento ancorado, não palpite. Ver `CAMADA-CONHECIMENTO.md` + `INTAKE-E-JULGAMENTO.md Parte B`.

## Mapa de docs

| Doc | O que tem |
|---|---|
| `VISAO-FILIPA.md` | North star — a dor da Filipa, o produto em 1 frase |
| `ARQUITETURA-TEMPO-REAL.md` | Pipeline ao vivo (4 andares: áudio→STT→estado→UI) |
| `CAMADA-CONHECIMENTO.md` | Role Profile, 3 sub-camadas, migração web→interno |
| `INTAKE-E-JULGAMENTO.md` | Intake automático + rubric + 4 regras anti-achismo + calibração |
| `ACESSO-E-CONHECIMENTO.md` | Acesso às pastas + 3 canais de ingestão |
| `PLANO-CONSTRUCAO.md` | Sequência de build P0–P4 com garantias |
| `MODELO-DADOS.md` | 15 tabelas SQL + DDL + RLS |
| `DECISOES-ABERTAS.md` | 5 decisões + recomendações |
| `TESTES-ACEITACAO.md` | Critérios de aceitação por passo |
| `DECISOES-E-MVP.md` | Log de todas as decisões fechadas |
| `DIA-A-DIA-RECRUTADOR.md` | O dia-a-dia real da Filipa (contexto) |
| `UI-DESIGN.md` | Design das telas |
| `PLANO.md` | Plano inicial (histórico) |
| `TELEGRAM-BOT-SPEC.md` | Fluxos A–E do bot, commands, API endpoints, tech stack |
| `BUILD-READY.md` | **Entrada** — decisões fechadas + sequência de arranque + carris |
| `ARQUITETURA-INTEGRACAO.md` | **Cola p/ paralelo** — módulos (`apps`+`packages`), contratos das junções, env, wiring, 6 carris de subagente |

## Estilo de trabalho com o Mateus (neste projeto)
- Ser **decisivo**, propor e avançar; não encher de ressalvas.
- Compliance/consentimento: "a gente resolve no onboarding".
- **O MVP valida a qualidade das sugestões** — tudo o resto é scaffolding que serve isso.
