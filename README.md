# RH Automação — Copiloto de IA para Recrutamento

Copiloto de IA para uma **agência de RH**. Ajuda a recrutadora (a "Filipa") a
**estudar a vaga e o cliente, conduzir a entrevista ao vivo e entregar um parecer
pronto** — sem a substituir. O coração é um copiloto que ouve a entrevista em tempo
real, separa quem fala, e sugere as perguntas certas (inclusive **as que o cliente
dela quereria fazer**), em linguagem que ela entende.

> **Estado: spec completa, build-ready.** Aguarda 4 decisões do Mateus (hosting,
> web search, bot de call, WhatsApp) para arrancar o scaffold. → **[`BUILD-READY.md`](./BUILD-READY.md)**

---

## 👉 Por onde começar

1. **[`BUILD-READY.md`](./BUILD-READY.md)** — o sumário mestre: o que está decidido,
   o que falta decidir (D1–D5), e como arrancar a construção. **Lê este primeiro.**
2. **[`VISAO-FILIPA.md`](./VISAO-FILIPA.md)** — a visão e o porquê, na linguagem do problema.
3. **[`PLANO-CONSTRUCAO.md`](./PLANO-CONSTRUCAO.md)** — o passo-a-passo P0→P4 com garantias.

## Mapa completo dos documentos

| Documento | O que é |
|---|---|
| [`BUILD-READY.md`](./BUILD-READY.md) | **Entrada.** Decidido vs por-decidir + sequência de arranque |
| [`VISAO-FILIPA.md`](./VISAO-FILIPA.md) | North star: a Filipa, os 3 lados, a lente do cliente |
| [`PLANO.md`](./PLANO.md) | Problema, ideia, diferencial, fases (doc original) |
| [`DIA-A-DIA-RECRUTADOR.md`](./DIA-A-DIA-RECRUTADOR.md) | As dores reais, ranqueadas |
| [`UI-DESIGN.md`](./UI-DESIGN.md) | Princípios de UI + ecrãs (copiloto ao vivo) |
| [`ARQUITETURA-TEMPO-REAL.md`](./ARQUITETURA-TEMPO-REAL.md) | Copiloto ao vivo: captura, transcrição+diarização, estado vivo (2h a custo constante) |
| [`CAMADA-CONHECIMENTO.md`](./CAMADA-CONHECIMENTO.md) | Como o bot sabe "o que é bom" — Role Profile via conhecimento externo |
| [`INTAKE-E-JULGAMENTO.md`](./INTAKE-E-JULGAMENTO.md) | Rubric + as 4 regras anti-achismo + calibração |
| [`ACESSO-E-CONHECIMENTO.md`](./ACESSO-E-CONHECIMENTO.md) | Acesso da Filipa, parecer, painel lateral, canais de ingestão |
| [`TELEGRAM-BOT-SPEC.md`](./TELEGRAM-BOT-SPEC.md) | Canal B: ingestão por Telegram (voz, multi-msg, identificação do cliente) |
| [`MODELO-DADOS.md`](./MODELO-DADOS.md) | Schema completo (tabelas, RLS, pgvector) + DDL |
| [`PLANO-CONSTRUCAO.md`](./PLANO-CONSTRUCAO.md) | Sequência P0→P4, cada passo com garantia verificável |
| [`TESTES-ACEITACAO.md`](./TESTES-ACEITACAO.md) | Como provar que cada passo está realmente feito |
| [`DECISOES-ABERTAS.md`](./DECISOES-ABERTAS.md) | Detalhe das decisões D1–D5 |
| [`DECISOES-E-MVP.md`](./DECISOES-E-MVP.md) | Log cronológico de todas as decisões fechadas |

---

## Em uma frase

> A Filipa não estuda, não divide a atenção e não escreve relatório. O copiloto
> estuda a vaga e o cliente por ela, ouve a entrevista inteira, sugere as perguntas
> que **o cliente dela** quereria fazer, e entrega o parecer pronto. Ela faz só o que
> máquina nenhuma faz: conversar e decidir.
