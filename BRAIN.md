# BRAIN — RH Automação

> Contexto vivo do projeto. Status rápido + decisões. Carregar no início de cada sessão.

## O que é
Copiloto de IA para **agência de RH** (a Filipa intermédia profissionais para empresas-clientes).
Jornada: **Ingestão de docs → Briefing (roteiro) → Copiloto AO VIVO → Relatório → Memória**.

## Status (2026-06-23 — desktop overlay ✅ build verde, bugs críticos corrigidos)

### Sessão 2026-06-23 — correções overnight
- **FloatingVera.tsx**: estado idle (bolha conn dot quando sem entrevista), ponto 🔴 de gravação, botão ✕ fechar no painel expandido + na bolha idle, badge ● no subtítulo do header, footer "Terminar entrevista"
- **preload.ts**: exposto `wsUrl`, `wsToken`, `wsInterviewId` (para ligação WS real na Fase K)
- **renderer/main.tsx**: suporte a WS real com handshake JWT + reconnect automático; fallback para mock feed quando sem URL
- **main.ts**: corrigido `skipTaskbar: false` → `true` (conforme APP-DESKTOP.md)
- **packages/db**: `pg.Pool` agora com `connectionTimeoutMillis: 8000` (fix freeze /vagas)
- **web/supabase/middleware.ts + server.ts**: fetch com timeout 6s/8s (fix freeze quando Docker Supabase not running)
- **web/.env.local**: adicionado `ALLOW_DEV_SESSION=1` + comentário de setup
- **Build monorepo**: verde ✅ (desktop + web + packages)

**Pendente / próximos passos:**
- Endpoint web para gerar JWT do WS e passar `interviewId` ao desktop (Fase K)
- Fase K: audio capture (LiveKit), transcrição real (Soniox), ticks ao vivo
- `/vagas` freeze: com ALLOW_DEV_SESSION=1 + timeout fetch, deve resolver quando Docker down; se ainda travar investigar cookies Supabase no browser local

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
- `MODELO-DADOS.md` — 28 tabelas SQL + DDL completo + RGPD + índices
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

## Evolução de design — 2026-06-17 (validada, ANTES de qualquer código)

11. **Memória 2 camadas:** A = captura sem perdas (Camada A, `transcript_chunk`); B = compreensão semântica (mata "gatilhos"). `ARQUITETURA-TEMPO-REAL.md §8–§9`.
12. **Frame de avaliação ao vivo:** estado por requisito + escada de prioridade + rede de segurança + ritmo/rapport + PORQUÊ por sugestão.
13. **Candidato GLOBAL** (talent pool) + **`process`** (candidato × vaga); cliente = mandato multi-vaga. `MODELO-DADOS.md`.
14. **Relatório anti-ping-pong:** critério-a-critério vs `client_criteria`, citação+timestamp, 2 versões. `RELATORIO-CLIENTE.md` (NOVO).
15. **Q&A bilingue** Filipa↔bot (RAG citado) + **input tipado** (alvo+intenção, `corrigido_pela_filipa`).
16. **Resto do recrutador:** motivação/logística/venda + `placement_outcome` → calibração. **RGPD:** pessoal etiquetado, fora do score.
> ⚠️ Estas mudanças tocam o schema (candidato global + process) e a Camada A — quem dispatchar o Agente 1 deve ler a secção "Evolução 2026-06-17" do `MODELO-DADOS.md` ANTES. Gaps abertos: `REVISAO-360-2026-06-17.md`.

## Evolução de design — 2026-06-17 (ronda 2)

17. **App DESKTOP de secretária** (Electron/Tauri) = overlay ao vivo **+ captura de áudio local**; always-on-top, sem moldura, 1 sugestão auto-dismiss. **Web app mantém-se** para o resto. Mesmo backend. `ARQUITETURA-INTEGRACAO`, `UI-DESIGN`.
18. **STT multi-idioma** PT-PT/PT-BR/EN/FR (Filipa fala inglês; saída PT).
19. **Assistente PROATIVO** (`ASSISTENTE-PROATIVO.md` NOVO): agenda (resumo de preparação) + deteção de lacunas. **Calendário = Google Calendar (OAuth), decidido**; manual é fallback.
20. **Diarização:** falante ativo da plataforma (bot na call) + fallback voz/enrollment Filipa; 3+ vozes (cliente→prefs ao vivo); correção por toque; sugestões **privadas**.
21. **Chat ao vivo** no overlay; **desambiguação** sempre confirma alvo; **pesos must/nice + compensação holística**.
22. **RGPD fechado:** reutilização entre clientes **permitida** (consent = Filipa); consent manual; apagamento soft **recuperável** (`purge_after`); **v1 SINGLE-TENANT (só IRIS, sem RLS por agência)**.
23. **Calibração:** override da Filipa treina; arranque a frio apoia-se em Role Profile + critérios.
> ⚠️ **REVISAO-360 ronda 2:** 4/6 bloqueadores resolvidos; sobram **auth do desktop/WS** + **validar com a Filipa**. Novos: distribuição desktop + permissão de microfone do SO, enrollment de voz, janela `purge_after`.

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
