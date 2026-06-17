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

### Toda a entrada da Filipa é TIPADA — alvo + intenção (decisão 2026-06-17)

O bot não adivinha o que fazer com uma mensagem da Filipa. Cada entrada (web, Telegram,
WhatsApp) é resolvida para um **envelope tipado** antes de qualquer ação:

```jsonc
{
  "alvo":      "cliente" | "vaga" | "candidato",   // a QUEM pertence
  "alvo_id":   "uuid | null",                       // resolvido por contexto/seleção
  "intencao":  "setup"          // configurar cliente/vaga de raiz
             | "add_requisito"  // acrescentar critério a uma vaga
             | "corrigir_facto" // emendar algo que o bot percebeu mal
             | "pergunta"       // Q&A (não grava nada durável)
             | "nova_vaga",     // abrir mandato novo
  "conteudo":  "texto | doc | audio_transcrito"
}
```

- **`alvo` resolve-se** por contexto de sessão (ver `TELEGRAM-BOT-SPEC.md §4`) ou
  seleção por botão; nunca por adivinhação silenciosa.
- **`intencao` decide o fluxo:** `pergunta` responde na hora **sem gravar**;
  `setup`/`add_requisito`/`nova_vaga`/`corrigir_facto` são **escritas duráveis** →
  passam **sempre** pela porta de confirmação (human-in-loop) antes de persistir, com
  proveniência.
- **`corrigir_facto`** é especial: ao confirmar, o facto alvo fica etiquetado
  `corrigido_pela_filipa` (campo em `MODELO-DADOS.md`). A correção humana **ganha
  prioridade** sobre a inferência do bot e sobre o mercado — e fica auditável (quem,
  quando, do quê para quê).

### Critérios do cliente capturados no SETUP (anti-ping-pong, base do relatório)

No setup de cada cliente/mandato, o bot **captura explicitamente as perguntas e
critérios que ESTE cliente sempre faz** (*"quero saber sempre se já trabalhou remoto
de verdade"*, *"pergunto sempre a pretensão salarial"*). Isto:

1. Entra como `client_criteria` (ver `MODELO-DADOS.md`) — durável, por cliente.
2. **Vira linha do rubric** → a entrevista garante **prova** para cada critério.
3. **Estrutura o relatório** → este responde critério-a-critério (ver
   `RELATORIO-CLIENTE.md`). É o **primeiro travão ao ping-pong**: o relatório já
   responde de antemão ao que o cliente ia perguntar.

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

## Parte E — o resto do trabalho do recrutador (motivação, logística, venda)

> O julgamento técnico é metade do trabalho. A outra metade — a que faz o cliente
> **fechar** e o candidato **aceitar** — estava a faltar na spec. Decisão 2026-06-17:
> o copiloto cobre o ciclo do recrutador, não só a avaliação.

### E.1 — Motivação / drivers (porque é que esta pessoa muda)
Alvo de captura **na entrevista** (entra no frame como requisito *de colocação*, não
técnico): o que move o candidato (crescimento? dinheiro? estabilidade? remoto? sair de
um chefe?), o que o faria recusar, o que o entusiasma nesta vaga. Sem isto, a Filipa
não sabe **como** vender nem **se** o candidato vai mesmo aceitar.

### E.2 — Logística (o que mata uma colocação no fim)
Captura explícita e durável: **pretensão salarial**, **aviso prévio / disponibilidade**,
**localização / remoto**, e o **risco de contraproposta** (o candidato está a usar-nos
para subir no emprego atual?). Tudo isto vai ao relatório (secção logística) — é o que
evita a colocação morrer na reta final por um detalhe não perguntado.

### E.3 — O bot ajuda a VENDER a vaga ao bom candidato
O fluxo não é só filtrar — quando o candidato **é bom**, a Filipa precisa de o
**convencer**. O bot, sabendo os drivers (E.1) e o que a vaga/cliente oferece, sugere
o **ângulo de venda**: *"ele disse que quer crescer para arquitetura — realça que o
cliente não tem ninguém sénior nessa área, há espaço."* (também alimenta o relatório.)

### E.4 — O RESULTADO da colocação volta para calibração
Quando há decisão final, regista-se o **outcome**: contratado? recusou a oferta
(porquê)? e, mais tarde, **ficou ou saiu dentro da garantia?**. É o sinal de verdade
mais forte do sistema → fecha o loop de calibração (ver
`CAMADA-CONHECIMENTO.md`, `placement_outcome` em `MODELO-DADOS.md`).

---

## RGPD — separar o que é pessoal do que é avaliação (decisão 2026-06-17)

A Camada A guarda **tudo** (inclui conversa pessoal/rapport). Regra dura: factos
**pessoais** (saúde, família, vida privada, conversa de circunstância) são
**etiquetados à parte** e **NUNCA entram na avaliação / no score** — servem só para
*recall* (o bot pode lembrar "ele mencionou que tem dois filhos" se a Filipa
perguntar, mas isso **não** pesa no juízo de adequação). Retenção curta para o
pessoal; transcrição crua com janela de retenção; conhecimento durável + factos
profissionais a longo prazo. Classificação e regimes de retenção em `MODELO-DADOS.md`
(secção RGPD).

---

## O que entra na spec a partir daqui
- **Modelo de dados:** `rubric` (por vaga), `proveniencia` (em cada facto de memória),
  `veredito_cliente` (por candidato/vaga), `client_criteria`, `placement_outcome`,
  etiqueta `corrigido_pela_filipa`, classificação pessoal/profissional. → `MODELO-DADOS.md`.
- **Relatório critério-a-critério** contra os critérios do cliente. → `RELATORIO-CLIENTE.md`.
- **Processos passo-a-passo** do intake e do estudo pré-entrevista. → próxima iteração.
- **Testes de aceitação** das 4 regras da Parte C + dos novos fluxos. → `TESTES-ACEITACAO.md`.
