# Intake automático + Motor de julgamento (a garantia contra achismo)

> Este documento ataca o **maior risco do produto**: se o bot julgar mal um campo
> que ninguém na agência domina, a Filipa recomenda um fraco, o cliente contrata
> mal e **perdemos o cliente**. Aqui desenhamos *como o bot sabe o que é bom* e
> *como provamos que sabe* — nada de "confia em mim".

---

## Parte A — Intake automático (o cliente manda, o bot aprende)

### O cenário
O cliente manda à Filipa, em particular (email/WhatsApp/PDF), a vaga ou uma
característica nova que quer no candidato (*"ah, e tem que saber inglês"*). Hoje isso
fica perdido na cabeça da Filipa. Queremos que ela **reencaminhe ao bot** e a memória
do cliente/vaga **se atualize sozinha.**

### O fluxo (passo a passo, com porta de segurança)
```
1. Filipa reenvia o doc/mensagem  →  (upload na página da Vaga, ou um canal de intake)
2. Bot extrai estruturado         →  requisitos, must/nice, características, contexto
3. Bot DEVOLVE o que entendeu      →  "Entendi: + inglês fluente (must), remoto (nice).
                                        Confere?"   ← porta de segurança (human-in-loop)
4. Filipa confirma / corrige       →  só então grava
5. Memória do cliente + vaga       →  atualizada COM PROVENIÊNCIA (origem, data, trecho)
```

### As regras que tornam isto fiável (não achismo)
- **Confirmação antes de gravar.** O bot nunca grava interpretação crua na memória
  sem a Filipa ver o que ele entendeu. Lixo na entrada não vira "verdade" silenciosa.
- **Proveniência sempre.** Cada facto na memória do cliente guarda *de onde veio*
  (documento, data, trecho). Auditável: dá para perguntar "porque achas que o cliente
  quer X?" e ver a origem.
- **Append, não sobrescrever.** Característica nova entra como nova entrada datada; se
  contradiz uma anterior, marca-se **conflito** e a Filipa decide (mesma disciplina do
  nosso protocolo de memória).

### Canais de intake (a escolher na implementação)
| Canal | Como | Nota |
|---|---|---|
| **Upload na web app** (base) | arrasta o PDF/cola o texto na página da Vaga | sempre disponível, zero infra |
| **Email dedicado** | reencaminha pra `vagas@...` → bot lê | cómodo; precisa parser de email |
| **WhatsApp** | reenvia pro número do bot | máximo conforto; reusa stack Madalena/Evolution |

> Recomendação: **upload na web app no MVP** (simples, fiável). Email/WhatsApp como
> conforto numa iteração seguinte — reusam infra que a CMTec já tem.

---

## Parte B — De onde vem a competência do bot para julgar

**Decisão (Mateus, 2026-06-16):** o bot **vai buscar conhecimento de fora** para saber
o que é "bom". Não estamos a treiná-lo com dados nossos — então a base é o
**conhecimento do mundo** (o que o Claude já sabe sobre cada área) + pesquisa externa
quando faz falta. *No futuro*, se decidirmos, calibramos com os **nossos** dados
(quem o cliente aprovou) — ver Parte D. Mas a fundação inicial é externa.

### Como isso vira julgamento concreto: o RUBRIC
O segredo é **não** pedir ao bot "esta resposta foi boa?" no vácuo. Antes da
entrevista, na fase de estudo, o bot constrói um **rubric** (gabarito) para *aquela*
vaga:

```
Para cada requisito da vaga → o bot gera, com conhecimento de domínio:
  • o que é uma resposta FRACA   (ex.: "React? sei fazer componentes")
  • o que é uma resposta OK      (ex.: cita hooks, estado, props)
  • o que é uma resposta FORTE   (ex.: explica reconciliation, quando memoizar, trade-offs)
  • a pergunta-sonda que separa os três
```

Durante a entrevista, o julgamento é **"a resposta do candidato bate em qual nível do
rubric?"** — uma comparação ancorada, não um palpite. O rubric é gerado por **Claude
Opus** (qualidade) e **mostrado à Filipa** (ela vê o gabarito em linguagem simples).

### Quando buscar fora (pesquisa externa)
- O Claude já cobre 95% (sabe o que é um sénior de React). A pesquisa web entra só
  para **o que muda com o tempo / nichos**: stack nova, expectativa de mercado atual,
  certificação específica que o cliente citou.
- Guardamos a fonte (proveniência) também aqui — o rubric diz "padrão de mercado 2026,
  fonte X".

---

## Parte C — A garantia: como provamos que o julgamento presta (anti-achismo)

Quatro regras duras. Se uma cair, o produto vira adivinhação:

1. **Todo veredito cita evidência.** Nunca "resposta boa". Sempre *"forte — disse
   ‘memoizo listas grandes com useMemo e meço com o profiler’ (12:03), que bate no
   nível FORTE do rubric de performance."* A Filipa vê o **trecho** e o **critério**.
2. **Facto separado de opinião.** No parecer e na UI, o que o candidato **disse**
   (citação, neutra) fica separado do que o bot **conclui** (julgamento). O cliente
   confia nos factos mesmo que pese a opinião de forma diferente.
3. **Incerteza é dita, não escondida.** Se o bot não conseguiu confirmar profundidade,
   diz *"não deu para confirmar — vale cavar"*, não inventa um veredito. Confiança
   baixa é um sinal visível, não silêncio.
4. **Linguagem simples sempre** (regra do `ACESSO-E-CONHECIMENTO.md §5`): o nível do
   rubric é traduzido ("forte" = "consegue resolver sozinho problemas difíceis disto").

> Estas quatro regras são **requisitos de produto**, não enfeite. Entram nos prompts
> do sistema e nos testes de aceitação (ver futura SPEC §testes).

---

## Parte D — A calibração (como deixa de ser achismo COM O TEMPO)

A garantia final não é "o bot é esperto"; é **medirmo-nos**:

- A cada candidato enviado, registamos o **veredito do cliente** (aprovou / recusou /
  porquê). Isto é a Camada 3(a) — vale mesmo no headhunting (1 candidato).
- Periodicamente comparamos: *quando o bot disse "FORTE", o cliente aprovou?* Se há
  desvio (*o bot diz forte mas o cliente recusa por fit cultural*), o rubric e a lente
  do cliente são ajustados — primeiro por **regra explícita** ("este cliente pesa fit
  cultural acima de skill"), depois, se valer a pena, por calibração com dados.
- Resultado: a precisão do julgamento passa a ser **um número que acompanhamos**, não
  uma fé. É isto que nos torna defensáveis (Metaview/BrightHire não vivem neste loop).

---

## O que entra na spec a partir daqui
- **Modelo de dados:** `rubric` (por vaga), `proveniencia` (em cada facto de memória),
  `veredito_cliente` (por candidato/vaga). → próxima iteração.
- **Processos passo-a-passo** do intake e do estudo pré-entrevista. → próxima iteração.
- **Testes de aceitação** das 4 regras da Parte C. → iteração de qualidade.
