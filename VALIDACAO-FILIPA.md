# Kit de validação com a Filipa — o gate de produto (bloqueador #6)

> **Porquê este doc:** a "**lente do cliente**" é o coração do produto e, por
> enquanto, é uma **aposta** (REVISAO-360 §I1). Antes de investir em otimização — ou
> sequer em todo o tempo real — temos de pôr isto à frente de uma pessoa real e
> ouvir um veredito. Este kit torna esse teste **concreto, barato e falsificável.**
>
> Regra de ouro (REVISAO-360): **não otimizar nada antes de passar este gate.**

---

## 1. A hipótese, escrita para poder FALHAR

> **H:** Um copiloto que sugere as perguntas que **o cliente da Filipa** faria —
> não só avaliação técnica genérica — produz (a) sugestões que a Filipa reconhece
> como **úteis e que ela não teria feito sozinha**, e (b) um **parecer que o cliente
> considera completo** (responde ao que ele queria saber, sem ping-pong).

Falsificável: se a Filipa olhar para as sugestões da lente do cliente e disser *"isto
é óbvio / eu já perguntaria / não é o que o cliente quer"*, **a hipótese falha** e
pivotamos antes de gastar semanas de tempo real.

**O que NÃO estamos a testar aqui:** latência, diarização, UI do overlay, custo.
Isso é engenharia, vem depois. Aqui testamos **só a inteligência e a relevância.**

---

## 2. Três testes, do mais barato ao mais completo

| Teste | Custo | Código? | O que prova |
|---|---|---|---|
| **T0 — Wizard-of-Oz** | ~1h | **Zero** | A inteligência (briefing + parecer) convence a Filipa com material real. |
| **T1 — Retrospetivo** ⭐ | ~1h | Zero | **Padrão-ouro:** o bot, às cegas, antecipa o que o cliente REALMENTE valorizou. |
| **T2 — Carril A (async)** | ~dias | Sim | Confirma a qualidade quando o pipeline real gera o briefing/parecer. |

**Arrancar por T0+T1 (zero código).** Só construir o T2 (Carril A) **se T0/T1
passarem** — é a recomendação da REVISAO-360 (validar barato antes do tempo real).

---

## 2.1 — ⭐ Primeiro caso real: a entrevista do Mateus (amanhã, LIVE)

**Proposta do Mateus (2026-06-17):** a Filipa está a tentar arranjar-lhe emprego e
tem uma **entrevista com ele amanhã**. Usamos isso como o **primeiro caso real** —
de graça, ao vivo, com pessoas reais.

**Mapeamento de papéis (importante — fixa quem é quem):**

| Papel no produto | Quem é, neste caso |
|---|---|
| **Recrutadora** (usa o copiloto) | **Filipa** |
| **Candidato** (entrevistado) | **Mateus** |
| **Cliente** (empresa que contrata — a quem o parecer serve) | **A empresa da vaga** |

**O que temos:**
- ✅ **Requisitos da vaga** — o Mateus tem acesso. *(É o input da lente técnica + base da lente do cliente.)*
- ❌ **A empresa em si** — não temos os detalhes do cliente. *(Limita a lente do cliente ao que se infere da vaga; honesto anotar.)*
- ✅ **CV do Mateus** — eu já o tenho e conheço-o bem.

**Que teste é:** é um **T0 ao vivo** (não T1 retrospetivo — o veredito ainda não
existe; é uma entrevista futura). Eu gero o **briefing em 3 lentes** que a Filipa
*usaria para entrevistar o Mateus* (incl. 🟢 as perguntas que a empresa-cliente
quereria). Validamos ao vivo: **as perguntas da lente do cliente fazem sentido? a
Filipa reconhece-as como úteis?**

**Caveats deste caso (para não enganar o resultado):**
- O Mateus é o **candidato** → não é juiz neutro da utilidade ("eu já perguntaria
  isso" vem viciado). O sinal forte é a **reação da Filipa**, não a auto-avaliação.
- Sem os dados da **empresa-cliente**, a lente do cliente fica **inferida da vaga**
  (mais fraca do que com o brief real do cliente). Mede o **piso**, não o teto.
- Como bónus: depois da entrevista, **se a empresa der veredito** (avançou/recusou +
  porquê), isto converte-se num **T1 retrospetivo** completo.

**Para arrancar:** o Mateus passa-me os **requisitos da vaga** (cola o texto) → eu
gero o briefing de 3 lentes **nesta sessão** → ele leva à entrevista de amanhã.

---

## 3. Material a recolher da Filipa (o input do teste)

Pedir à Filipa **um caso real e já fechado** da IRIS (candidato que o cliente já
aprovou ou recusou — ver T1). Precisamos de:

1. **O que o cliente pediu** — a mensagem/brief cru, na forma que o cliente mandou
   (WhatsApp, email, PDF). *Sem limpar — queremos o input real e bagunçado.*
2. **O que a função faz** — descrição da vaga / contexto do cliente.
3. **O CV do candidato.**
4. **(Para T1) O veredito do cliente** — aprovou? recusou? **e porquê** (as razões
   reais que o cliente deu). *Isto fica escondido do bot até ao fim.*
5. **(Ideal) Uma transcrição** de uma entrevista passada (ou notas/áudio). Se não
   houver, T0/T1 funcionam só com vaga+brief+CV (testam o **briefing**, que é onde
   a lente do cliente vive).

> Privacidade: anonimizar nomes do candidato/cliente se a Filipa preferir. Não muda
> o teste — a lente do cliente é sobre **critérios**, não sobre identidades.

---

## 4. T0 — Wizard-of-Oz (eu corro o cérebro à mão)

Sem app. Com o material do §3, eu (Claude) produzo **exatamente o que o produto
produziria**, seguindo as regras da spec (3 lentes, rubric, linguagem simples,
evidência citada):

**Entregável A — Briefing (antes da call):**
- **Role Profile** do cliente (o que um "X" deste cliente significa) — `CAMADA-CONHECIMENTO`.
- **Perguntas em 3 lentes**, com a 🟢 **lente do cliente em destaque** + **o PORQUÊ**
  de cada sugestão.
- **Gaps do CV** a investigar.
- **Rubric** (fraco / ok / forte) por requisito.

**Entregável B — Parecer (depois, se houver transcrição):**
- Resumo + capacidade do candidato **mapeada critério-a-critério contra o que o
  cliente pediu**, com **trechos que provam** + o que ficou **não-coberto**.
- Em **linguagem simples** (a Filipa não é técnica).

**A Filipa avalia (guião de perguntas — anotar respostas):**
1. Destas perguntas da **lente do cliente**, quais **tu não terias feito sozinha**? *(quantas?)*
2. Alguma é **óbvia / desnecessária**? *(quantas?)*
3. Alguma está **errada** para este cliente (não é o que ele quer)? *(quantas?)*
4. O **parecer** responderia ao que este cliente queria saber? Faltou algo?
5. **Mostrarias este parecer ao teu cliente como está?** (sim / com edições / não)

---

## 5. T1 — Teste Retrospetivo ⭐ (o que mais de-risca)

O mais honesto, porque o futuro já é conhecido:

1. Eu gero o briefing **às cegas** — **sem ver o veredito do cliente** (§3.4 fica
   escondido).
2. Só depois comparamos: **as perguntas da lente do cliente anteciparam as razões
   reais pelas quais o cliente aprovou/recusou?**

> Exemplo: se o cliente recusou o candidato porque *"nunca liderou equipa"* e o bot,
> às cegas, sugeriu *"o cliente vai querer saber se ele já liderou um time —
> pergunta isso"*, a hipótese **ganha tração forte**. Se o bot foi todo técnico e
> nunca tocou no que o cliente realmente pesou, **falha** — e é melhor saber agora.

---

## 6. Critérios de PASS / PIVOT (não é "vibe", é contagem)

Sobre as sugestões da **lente do cliente** num caso real:

| Métrica | PASS | ZONA CINZENTA | PIVOT |
|---|---|---|---|
| Sugestões úteis que a Filipa **não** faria sozinha | ≥ 1/3 | — | ~0 (tudo óbvio) |
| Sugestões **erradas** para o cliente | ≤ 1 | — | várias |
| (T1) Antecipou a **razão real** do veredito do cliente | sim | parcial | não tocou |
| Filipa mostraria o **parecer** ao cliente | sim / com edições leves | — | "não, não serve" |

- **PASS** → seguimos para T2 (Carril A) e depois o tempo real, com confiança.
- **ZONA CINZENTA** → afinar o Role Profile / prompts e **repetir com 2º caso** antes de construir.
- **PIVOT** → a lente do cliente, como está, não é o diferencial; repensar **antes**
  de gastar o tempo real.

> Fazer com **2–3 casos**, não 1 — um acerto pode ser sorte. Idealmente vagas de
> **clientes diferentes** (a lente do cliente tem de funcionar para vários).

> ⚠️ **Exigir ≥1 caso NÃO-técnico antes do PASS (gap simulação 2026-06-18):** o único
> caso real até agora (`validacao-caso-01`, Mateus → Software Engineer) é **tech** e com o
> **candidato como juiz** (enviesado, como o doc admite). O produto promete servir nichos
> onde a Filipa é **mesmo leiga** (enfermagem, etc.) — é aí que está o teste difícil. **O
> gate só passa com pelo menos um caso de nicho não-técnico** (idealmente uma vaga real da
> IRIS em saúde/staffing), para provar que a Vera estuda o role e gera profundidade onde
> ninguém na agência sabe julgar à partida.

---

## 7. O que eu preciso de ti (Mateus) para arrancar o T0/T1

- [ ] **1–3 casos reais e fechados** da IRIS (vaga + brief do cliente + CV) — §3.
- [ ] Para T1: o **veredito real** do cliente em cada caso (aprovou/recusou + porquê),
      que eu **não** vejo até gerar o briefing.
- [ ] (Bónus) uma **transcrição/notas** de uma entrevista passada → desbloqueia o
      Entregável B (parecer).
- [ ] Combinar **como a Filipa dá o veredito** (chamada de 30 min contigo/ela, ou
      ela responde por escrito ao guião do §4).

> Assim que me deres 1 caso, eu produzo o briefing (e o parecer, se houver
> transcrição) **nesta sessão**, e tu levas à Filipa. Zero código, resultado no mesmo dia.
