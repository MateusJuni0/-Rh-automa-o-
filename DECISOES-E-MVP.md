# Decisões & MVP — continuando o raciocínio

> Os três primeiros documentos exploraram **o quê** e **por quê**. Aqui fechamos o
> **o quê primeiro** e o **como**. Cada recomendação vem com a razão; o que ainda
> é decisão do Mateus está marcado com 🟦 **DECISÃO DO MATEUS**.

---

## 1. A tensão que precisa ser resolvida

Há uma contradição saudável entre os documentos:

- `PLANO.md §4` prega **"comece pequeno"**: fazer só a **Fase 1** (roteiro
  assíncrono) primeiro, porque a maior incerteza é a **qualidade das sugestões**,
  não o tempo real.
- `DIA-A-DIA` e `UI-DESIGN` se empolgam (com razão) com a **jornada completa** e
  elegem o **copiloto ao vivo** como a estrela.

As duas coisas parecem brigar: "comece pequeno" vs "a estrela é o tempo real".
Elas não brigam — só foram ditas em níveis diferentes. A solução está em separar
**a jornada** (o valor) da **infra de tempo real** (o custo).

---

## 2. O insight que destrava: a jornada inteira pode ser assíncrona

Olhando a jornada `Triagem → Briefing → Copiloto → Relatório`, **só uma etapa
precisa de tempo real**: o copiloto *ao vivo* durante a call. Todo o resto —
triagem, briefing e relatório — é requisição → resposta. Assíncrono.

E o "cérebro" é o mesmo nas duas versões: as mesmas perguntas, o mesmo checklist
de cobertura, o mesmo julgamento de "boa vs fraca resposta". O tempo real só muda
**de onde vem a transcrição** (streaming ao vivo) e **quando** as sugestões
aparecem (durante vs depois). Não muda a inteligência.

> **Conclusão:** dá para entregar a **jornada completa de valor** sem nenhuma infra
> de áudio em tempo real. Basta o copiloto rodar sobre uma **transcrição já pronta**
> (colada ou de uma gravação) em vez de um stream ao vivo.

---

## 3. Escopo do MVP recomendado — "a jornada, mas assíncrona"

**MVP = `Triagem → Briefing → Relatório`, com um "copiloto sobre transcrição".**

| Etapa | No MVP (assíncrono) | Vira tempo real depois (Fase 2) |
|---|---|---|
| **Vaga** | Colar descrição crua → IA estrutura requisitos | — (igual) |
| **Triagem** | Subir N currículos → ranking por match + resumo | — (igual) |
| **Briefing** | Roteiro de perguntas + "boa vs fraca resposta" + gaps | É o que alimenta o copiloto ao vivo |
| **Entrevista** | Recrutador entrevista normalmente e **cola/sobe a transcrição** | Bot/captura entra na call e transcreve **ao vivo** |
| **Relatório** | IA gera resumo + score vs requisitos + rascunhos de e-mail | — (igual, só fica instantâneo) |

Por que este recorte é o certo:

1. **De-risca a aposta principal.** Se as sugestões e o relatório não convencem o
   recrutador **com a transcrição na mão**, nunca convenceriam ao vivo. Validamos a
   qualidade — a real incerteza — pelo caminho barato.
2. **Entrega o ciclo de valor inteiro**, não um pedaço. O recrutador sente alívio
   na triagem (porta de entrada) e o "uau" no relatório (saída).
3. **Reaproveita 100% do cérebro** quando a Fase 2 chegar: o ao vivo é "o mesmo
   produto, agora em streaming".
4. **Adia o que é caro e arriscado:** captura de áudio multiplataforma, latência,
   WebSocket e o peso de LGPD de **gravar** ao vivo.

🟦 **DECISÃO DO MATEUS:** aceitar este recorte de MVP (jornada assíncrona) **ou**
preferir começar ainda menor, só pela **Triagem** isolada (a feature de alívio mais
imediato), deixando briefing/relatório para a iteração seguinte.

---

## 4. Stack — recomendação fechada (a confirmar)

Uma stack só, alinhada com o que a CMTecnologia já domina e opera:

| Camada | Escolha | Razão |
|---|---|---|
| Frontend + Backend | **Next.js 15 (App Router)** — Route Handlers / Server Actions | uma linguagem só (TS); o MVP é todo request→response, não precisa de servidor à parte |
| Validação | **Zod** | contratos de vaga/candidato/roteiro validados na fronteira |
| IA | **API Anthropic (Claude)** | ver §5 |
| Banco | **PostgreSQL (Supabase)** | a CMTec já roda Supabase self-hosted; reuso de infra |
| Auth | **Supabase Auth** | recrutador faz login; multi-tenant por agência depois |
| Hospedagem | a definir (Vercel ou VPS CMTec) | mesma decisão que os outros produtos |

Por que **não** Python no backend: não há, no MVP, nada que justifique uma segunda
stack (sem ML caseiro, sem pipeline de dados pesado). Tudo é "chamar o Claude e
guardar no Postgres". Uma stack só = menos atrito, menos deploy, mais velocidade.

> **Reuso importante para a Fase 2:** a CMTec já tem transcrição PT-PT/PT-BR em
> produção no `cmtec-voice-platform` (Soniox + LiveKit). O serviço de transcrição
> ao vivo da Fase 2 provavelmente **não precisa ser construído do zero** — herda-se
> dali. Isso reforça deixar o tempo real para depois: ele já tem caminho.

🟦 **DECISÃO DO MATEUS:** confirmar Next.js + Supabase, e onde hospedar.

---

## 5. Modelos de IA — por tarefa

Confirmado contra a referência atual da Anthropic (jun/2026):

| Tarefa | Modelo | ID | Razão |
|---|---|---|---|
| Estruturar vaga (colar → campos) | Haiku 4.5 | `claude-haiku-4-5-20251001` | extração simples, barato e rápido |
| Triagem / match de CVs | Sonnet 4.6 | `claude-sonnet-4-6` | volume (N CVs) com bom julgamento; custo controlado |
| Gerar o **roteiro** (briefing) | Opus 4.8 | `claude-opus-4-8` | é o "uau" de qualidade; vale o custo, é 1× por vaga |
| Relatório pós-entrevista | Sonnet 4.6 | `claude-sonnet-4-6` | bom resumo + score, custo razoável |
| Copiloto ao vivo (Fase 2) | Sonnet 4.6 | `claude-sonnet-4-6` | latência manda no tempo real |

Princípio: **Opus onde a qualidade é o produto** (roteiro), **Sonnet no grosso**,
**Haiku no trivial**. Reavaliar com dados reais de custo depois do MVP.

---

## 6. Outras decisões em aberto — posição recomendada

- **Idioma da interface:** PT-BR apenas no MVP. (As entrevistas em si podem ser
  PT ou EN — o Claude lida com ambos; a *UI* é que fica PT-BR primeiro.)
- **Quem usa o copiloto:** só o recrutador. Confirmado pelos docs; não muda nada.
- **Plataforma da entrevista:** já decidido — agnóstico. No MVP isso fica trivial,
  porque a transcrição é colada/subida; a plataforma nem importa.
- **Nome/marca e paleta:** azul-teal é ponto de partida. 🟦 **DECISÃO DO MATEUS.**

---

## 7. Modelo de dados (rascunho da Fase 1)

```
agencia (1) ──< recrutador
agencia (1) ──< vaga ──< candidato ──< entrevista ──1 relatorio
                  │           │
                  │           └─ cv (texto extraído) + match (score, gaps)
                  └─ requisitos (skills[], senioridade, idioma, must/nice)

roteiro  : pertence a (vaga + candidato) — perguntas[] com {texto, tipo, boa_resposta}
relatorio: pertence a entrevista — {resumo, scores[], pontos_fortes, red_flags, rascunho_email}
```

Tabelas mínimas para o MVP: `agencia`, `recrutador`, `vaga`, `candidato`,
`roteiro`, `entrevista`, `relatorio`. Multi-tenant por `agencia_id` desde o dia 1
(RLS no Supabase) — barato agora, caro de retrofitar depois.

---

## 8. LGPD no MVP (mais leve, mas não zero)

A versão assíncrona **não grava a call ao vivo**, o que reduz muito o risco. Ainda
assim trata dados pessoais (CVs, transcrição colada). Mínimos para o MVP:

- Termo de consentimento do **candidato** para processar o CV / transcrição.
- Aviso de que há IA assistindo a avaliação.
- Política de **retenção/exclusão** (quanto tempo guardamos CVs e transcrições?).
- O peso maior — consentimento de **gravação ao vivo** — só entra na Fase 2.

---

## 9. Plano de Fase 1 — fatias finas (cada uma entrega algo usável)

1. **Scaffold:** Next.js + Supabase + Auth + esquema base (`agencia`/`recrutador`/`vaga`).
2. **Vaga:** tela de criar vaga + "colar descrição → IA pré-preenche" (Haiku).
3. **Triagem:** subir CVs → match + ranking + resumo (Sonnet). *(maior alívio, dor #1)*
4. **Briefing:** gerar o roteiro a partir de vaga+candidato (Opus). *(o "uau")*
5. **Entrevista assíncrona:** colar/subir transcrição e associar à entrevista.
6. **Relatório:** resumo + score vs requisitos + rascunho de e-mail (Sonnet).
7. **Polimento de UI** segundo `UI-DESIGN.md` (glanceable, semáforo, calmo).

Ordem pensada para **mostrar valor cedo**: já no passo 3 o recrutador sente o
produto; passos 4–6 fecham a jornada. Tempo real (Fase 2) só depois de validar isto.

---

## 10. O que falta para arrancar o código

Só duas respostas do Mateus destravam o scaffold:

1. **Escopo do MVP:** jornada assíncrona completa (§3) ou só Triagem primeiro?
2. **Stack/hosting:** confirma Next.js + Supabase e onde hospedar?

Com isso, o passo seguinte é abrir as fatias do §9 como tarefas pequenas e começar
pelo scaffold (passo 1).
