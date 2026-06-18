# Vera — Copiloto de IA para Recrutamento

**Vera** ajuda a recrutadora (a "Filipa") a **estudar a vaga e o cliente, conduzir a
entrevista ao vivo e entregar um parecer pronto** — sem a substituir. O coração é um
copiloto que ouve a entrevista em tempo real, separa quem fala, e **aprofunda** as
respostas com as perguntas certas (inclusive **as que o cliente dela quereria fazer**),
em linguagem que ela entende. *(Marca pública = Vera; motor interno = Lince.)*

> **Estado (2026-06-18): Fase 1 (cérebro) e Fase 2 (embalagem & design) COMPLETAS em
> spec.** Próxima = **Fase 3: codar tudo** (ainda não começou — nada de código até lá).
> Decisões de arranque (hosting, web search, bot de call, WhatsApp) já estão **fechadas**.
>
> **🟥 SCOPE (LOCKED 2026-06-18):** a Vera é **só para a IRIS Tech — NÃO se revende.** Um
> deployment, **2 utilizadoras** (Filipa + Inês), **VPS dedicada**. `agency_id` fica só como
> costura para expansão futura, não como produto multi-tenant. (ADR em `DECISOES-E-MVP`.)

## Fases
1. **Cérebro** ✅ spec — o que o produto pensa/decide.
2. **Embalagem & design** ✅ spec — app desktop, web app, agente, biometria, infra, UI.
3. **Código** ⏳ — construir tudo (local-first → nossa infra → comprador).

## Portas antes de a Fase 3 ENTREGAR (não impedem codar)
Bug de enroll da biometria · anti-spoof ON antes do **uso real** (2 utilizadoras, a cara
destranca a conta) · cláusula RGPD no contrato (RGPD = responsabilidade da agência) ·
retenção/purga (`DATA-RETENTION.md`) · provar custo 2h ·
**gates de segurança** (`SEGURANCA.md §12`: isolamento por `agency_id`+roles, anti-SSRF,
validador de upload, bucket privado, cifra+backups cifrados, ZDR, rate-limit) ·
**gates de escala** (`ESCALA-E-OPERACAO §12`: limites de container, capacidade, backup do Storage).

## Decisões 🟦 — FECHADAS (2026-06-18; ADR completo em `DECISOES-E-MVP`)
1. **Scope:** só IRIS, **sem revenda** → multi-tenant comercial / admin-comprador / migração-p/-comprador = **fora** (futuro-opcional, não gate).
2. **Painel web** existe com secções (chat-Vera / candidatos / clientes / pipeline / comparar / definições) — mockup feito.
3. **Identidade do candidato:** v1 = atestação da recrutadora + selo "não verificada"; biometria do candidato = futuro.
4. **VPS dedicada** + **chave de backup off-VPS** + **memória auto-salva** (nunca pedir "guarda").
5. **Soniox + embedder:** ZDR/no-training **fail-closed** nos dois (default Soniox sem-retenção; embedder OpenAI sem-treino ou self-host).
6. **Auth:** email/senha **ou** biometria; biometria **só após 1º login** → depois passwordless; 2 utilizadoras (Filipa+Inês).
7. **IP/licença:** **tudo da IRIS Tech.**
8. **Contratos P0.1 a congelar** (review ChatGPT): `agent_db_session` (GUC), `search_knowledge`, `can_join_interview`, `capture_session`, registry ZDR, hierarquia de falante.

---

## 👉 Por onde começar
1. **[`BUILD-READY.md`](./BUILD-READY.md)** — sumário mestre: o que está decidido + arranque.
2. **[`VISAO-FILIPA.md`](./VISAO-FILIPA.md)** — a visão e o porquê (a dor da Filipa).
3. **[`ARQUITETURA-INTEGRACAO.md`](./ARQUITETURA-INTEGRACAO.md)** — a cola: monorepo, contratos, carris (a usar na Fase 3).

## Mapa dos documentos (41)

> Além dos 41 docs de spec, há 2 **artefactos** (fora da contagem): `engagement-scope.yml`
> (gate do Cyber Neo `--redteam`) e `PROMPT-CHATGPT-REVIEW.md` (prompt p/ revisão externa).

**Visão & entrada**
| Doc | O que é |
|---|---|
| [`BUILD-READY.md`](./BUILD-READY.md) | Entrada: decidido vs arranque |
| [`VISAO-FILIPA.md`](./VISAO-FILIPA.md) | North star: a Filipa, a lente do cliente |
| [`PLANO.md`](./PLANO.md) · [`DIA-A-DIA-RECRUTADOR.md`](./DIA-A-DIA-RECRUTADOR.md) | Problema, ideia, dores ranqueadas |
| [`BRAIN.md`](./BRAIN.md) | Contexto/estado de sessão do projeto |

**Fase 1 — o cérebro**
| Doc | O que é |
|---|---|
| [`CAMADA-CONHECIMENTO.md`](./CAMADA-CONHECIMENTO.md) | "O que é bom" — Role Profile (nicho-agnóstico), ciclo de pesquisa, rubric |
| [`INTAKE-E-JULGAMENTO.md`](./INTAKE-E-JULGAMENTO.md) | Input tipado + rubric + 4 regras anti-achismo + calibração + entrada de candidato |
| [`FILOSOFIA-DAS-PERGUNTAS.md`](./FILOSOFIA-DAS-PERGUNTAS.md) | Como a Vera gera perguntas: **profundidade (como/porquê/caso real), não checklist de tecnologias** |
| [`ARQUITETURA-TEMPO-REAL.md`](./ARQUITETURA-TEMPO-REAL.md) | Copiloto ao vivo: 2 camadas, frame, **o fosso (aprofundamento)**, concorrência, tokens |
| [`RESILIENCIA-E-FALHAS.md`](./RESILIENCIA-E-FALHAS.md) | **Falha de infra a meio de 2h:** reconexão STT, fallback de modelo, teto de custo, gaps não-capturados |
| [`RELATORIO-CLIENTE.md`](./RELATORIO-CLIENTE.md) | Parecer critério-a-critério (anti-ping-pong), selo de origem, 2 versões |
| [`ASSISTENTE-CONVERSA.md`](./ASSISTENTE-CONVERSA.md) | Cérebro do chatbot: Q&A ancorado + comparar candidatos |
| [`ASSISTENTE-PESSOAL.md`](./ASSISTENTE-PESSOAL.md) | O "ChatGPT dela": agente (motor Hermes), ferramentas, memória que aprende |
| [`ASSISTENTE-PROATIVO.md`](./ASSISTENTE-PROATIVO.md) | Agenda + deteção de lacunas + follow-up |
| [`JORNADA-POS-PARECER.md`](./JORNADA-POS-PARECER.md) | A cauda: oferta → colocado → garantia (calibração) |
| [`MODELO-DADOS.md`](./MODELO-DADOS.md) | Schema completo (34 tabelas) + DDL + RGPD |
| [`MODELOS-E-API.md`](./MODELOS-E-API.md) | Modelos por slot, agnósticos, via OpenRouter |

**Fase 2 — embalagem & design**
| Doc | O que é |
|---|---|
| [`ARQUITETURA-INTEGRACAO.md`](./ARQUITETURA-INTEGRACAO.md) | Monorepo, contratos das junções, env, wiring, carris de subagente |
| [`APP-DESKTOP.md`](./APP-DESKTOP.md) | App desktop (Electron): overlay always-on-top + captura de áudio |
| [`AGENTE-TOOLS-E-WS.md`](./AGENTE-TOOLS-E-WS.md) | Ferramentas do agente + auth do WebSocket |
| [`AUTENTICACAO.md`](./AUTENTICACAO.md) | Biometria (clone) + email + auth WS + multi-dispositivo |
| [`AUTH-CONTRACT.md`](./AUTH-CONTRACT.md) | Claims JWT, validação WS, S2S, matriz de permissões |
| [`REUSE-MAP.md`](./REUSE-MAP.md) | De onde clonar/reaproveitar (biometria, agente, LiveKit/Soniox) — repo/commit/módulos/smoke |
| [`UI-DESIGN.md`](./UI-DESIGN.md) | Princípios + ecrãs + estados; direção visual **HUD escuro (Vera)** |
| [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md) | Tokens de cor/tipografia/espaço/raio (fonte única do dark HUD) |
| [`TELEGRAM-BOT-SPEC.md`](./TELEGRAM-BOT-SPEC.md) | Canal B: ingestão por Telegram (voz, multi-msg) |
| [`INFRA-E-MIGRACAO.md`](./INFRA-E-MIGRACAO.md) | Local → nossa infra → comprador; bundle portável + runbook |
| [`SEGURANCA.md`](./SEGURANCA.md) | **Postura técnica de segurança + modelo de ameaças (lente Cyber Neo):** isolamento de tenant, anti-SSRF, upload, cifra, ZDR, testes |
| [`ESCALA-E-OPERACAO.md`](./ESCALA-E-OPERACAO.md) | **Escala agregada:** capacidade simultânea, crescimento de dados, backup/DR, blast-radius |
| [`DATA-RETENTION.md`](./DATA-RETENTION.md) | **Matriz de retenção + purga em cascata** (transcrição/embeddings/RAG/Storage/backups); auto-salva, nunca perder info |
| [`ACESSO-E-CONHECIMENTO.md`](./ACESSO-E-CONHECIMENTO.md) | Acesso da Filipa, canais de ingestão |

**Legal · validação · processo**
| Doc | O que é |
|---|---|
| [`LEGAL-E-RGPD.md`](./LEGAL-E-RGPD.md) | RGPD = responsabilidade da agência; o que o produto oferece; segurança técnica |
| [`VALIDACAO-FILIPA.md`](./VALIDACAO-FILIPA.md) · [`validacao-caso-01-mateus-securegpt.md`](./validacao-caso-01-mateus-securegpt.md) | Como validar a "lente do cliente" + 1º caso real |
| [`PLANO-CONSTRUCAO.md`](./PLANO-CONSTRUCAO.md) · [`ARRANQUE.md`](./ARRANQUE.md) | Sequência P0→P4 + pré-requisitos de arranque |
| [`TESTES-ACEITACAO.md`](./TESTES-ACEITACAO.md) | Critérios de "feito" por passo + fluxos novos |
| [`DECISOES-E-MVP.md`](./DECISOES-E-MVP.md) | Log cronológico de TODAS as decisões |
| [`DECISOES-ABERTAS.md`](./DECISOES-ABERTAS.md) | Histórico das D1–D5 (todas fechadas) |
| [`REVISAO-360-2026-06-17.md`](./REVISAO-360-2026-06-17.md) | Revisão 360° + auditoria de gaps |

---

## Em uma frase
> A Filipa não estuda, não divide a atenção e não escreve relatório. A Vera estuda a
> vaga e o cliente por ela, ouve a entrevista inteira, **aprofunda** as respostas com as
> perguntas que o cliente dela quereria fazer, e entrega o parecer pronto. Ela faz só o
> que máquina nenhuma faz: conversar e decidir.
