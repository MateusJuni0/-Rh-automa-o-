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

### Desambiguação — o bot NUNCA adivinha o alvo (10 clientes, 50 candidatos)

Com volume, o risco é gravar no sítio errado. Regra dura: **confirma sempre o alvo
antes de qualquer escrita durável.** Como se resolve por canal:

- **Web app:** a Filipa **escolhe cliente → vaga** de uma lista **antes** de enviar. O
  alvo já vem resolvido; não há ambiguidade.
- **Chat / atalho (Telegram):** o bot **propõe** o match a partir do **conteúdo do
  documento** (nome da empresa, cargo) **+ contexto ativo** (a janela de minutos em que
  a Filipa está a trabalhar num cliente). Mas **propõe, não decide** — mostra
  *"Parece ser para **TechCorp · Dev React**. Confirmas?"* `[✅] [outro]`.
- **Nada durável** (gravar facto, criar vaga, alterar requisito) acontece **sem o alvo
  confirmado**. Pergunta (`intencao='pergunta'`) não grava, logo pode responder sem
  confirmação de alvo.

> O "contexto ativo" é uma conveniência (reduz cliques), nunca uma certeza: mesmo com
> contexto, a escrita durável passa pela confirmação. Ver `TELEGRAM-BOT-SPEC.md §4`.

### Critérios do cliente capturados no SETUP (anti-ping-pong, base do relatório)

No setup de cada cliente/mandato, o bot **captura explicitamente as perguntas e
critérios que ESTE cliente sempre faz** (*"quero saber sempre se já trabalhou remoto
de verdade"*, *"pergunto sempre a pretensão salarial"*). Isto:

1. Entra como `client_criteria` (ver `MODELO-DADOS.md`) — durável, por cliente.
2. **Vira linha do rubric** → a entrevista garante **prova** para cada critério.
3. **Estrutura o relatório** → este responde critério-a-critério (ver
   `RELATORIO-CLIENTE.md`). É o **primeiro travão ao ping-pong**: o relatório já
   responde de antemão ao que o cliente ia perguntar.

### Entrada de um candidato "caçado" → cria o `process` (fecha o gap A1)

A Filipa faz **headhunting**: encontra a pessoa no LinkedIn e traz **um** candidato
para uma vaga. Faltava o fluxo de **como ele entra no sistema** (a `REVISAO-360` A1).

```
Filipa traz o candidato  (encaminha o CV  OU  cola o link/URL do LinkedIn)
        │  + diz "é para a vaga X"  (alvo=candidato, intencao='novo_candidato')
        ▼
1. O bot resolve se é candidato NOVO ou JÁ EXISTENTE (talent pool global):
     - procura por nome/linkedin_url → se existe, REUSA (não duplica)
     - se não, extrai o perfil do CV (Haiku) e cria `candidate`
2. Cria o `process` (candidate × job) no estado 'sourced'/'screening'
        ▼
3. Porta de segurança: "Vou ligar o **João** à vaga **Dev React/TechCorp**. Confirmas?"
        ▼
4. Confirmado → candidato + process prontos; o briefing pode ser gerado.
```

- Acrescenta-se `intencao='novo_candidato'` ao envelope tipado (alvo=`candidato`).
- **Dedup obrigatório:** candidato é **global**; nunca criar duplicado — liga ao
  existente e abre só um `process` novo (reusa a memória que já temos dele — re-entrevista,
  `ASSISTENTE-CONVERSA §4.1`).

> **Mecânica de resolução de entidade (gap "dia caótico" 2026-06-18):**
> - **Chaves de match:** `linkedin_url` (forte) · `email`/`phone` (forte) ·
>   `name_normalized` (sem acentos/maiúsculas — fraca, só com 2ª chave). (`MODELO-DADOS §12`)
> - **2 "Joães" no pool:** o bot **NUNCA escolhe em silêncio** — mostra a desambiguação
>   com **dados discriminantes** (*"João Silva (TechCorp, 2024) ou João Costa (Finap)?"*),
>   ou "criar novo".
> - **Dedup UNIVERSAL — em TODOS os pontos de criação**, não só no headhunting: upload web,
>   **arrastar CV ao vivo** (`ARQUITETURA-TEMPO-REAL §12`) e Telegram correm o mesmo match
>   antes de criar. Senão a re-entrevista parte (nasce um id duplicado e a memória antiga
>   não se anexa).
> - 🔒 **Anti-envenenamento de identidade (R2, `SEGURANCA §13.e`):** as chaves de match
>   (`email`/`linkedin_url`) são **extraídas de conteúdo NÃO-confiável** (o CV). Um CV hostil
>   que copie o email/LinkedIn de outra pessoa faria o sistema **anexar ao perfil errado** →
>   memória, factos e `placement_outcome` colam-se a outro candidato (fuga de PII + identidade
>   trocada). Logo: as chaves extraídas são **indício, não prova de identidade** — **anexar a um
>   perfil existente exige confirmação humana explícita** com dados discriminantes (a
>   desambiguação acima passa a **obrigatória no merge**; **nunca** auto-anexar só por
>   email/linkedin). O "arrastar ao vivo" (pressão de tempo) é o pior caso — não há atalho.
- Sem CV (só LinkedIn): o bot pode **pesquisar o perfil público** (ciclo de pesquisa,
  `source_doc`, marcado indício) para arrancar o briefing — confirma-se na entrevista.

> **Agendar a call + o bot entrar nela** (A2) — quem cria a sala LiveKit e como o
> candidato é convidado — é **mecânica de captura/transporte = embalagem**
> (`ARQUITETURA-TEMPO-REAL §5`), não cérebro. Fica anotado para a Parte 2.

### Canais de intake (a escolher na implementação)
| Canal | Como | Nota |
|---|---|---|
| **Upload na web app** (base) | arrasta o PDF/cola o texto na página da Vaga | sempre disponível, zero infra |
| **Email dedicado** | reencaminha pra `vagas@...` → bot lê | cómodo; precisa parser de email |
| **WhatsApp** | reenvia pro número do bot | máximo conforto; reusa stack Madalena/Evolution |

> Recomendação: **upload na web app no MVP** (simples, fiável). Email/WhatsApp como
> conforto numa iteração seguinte — reusam infra que a CMTec já tem.

> 🔒 **Segurança do upload (loop segurança 2026-06-18):** o CV é um **vetor de ataque**
> (parser PDF/docx, XXE, malware, zip-bomb, path traversal) e entra por **vários** canais
> (web, Telegram, **arrastar ao vivo**). **Todos** passam por **um único validador**
> (cap de tamanho + MIME por **conteúdo**/magic-bytes + entidades XML off + `storage_path`
> gerado pelo servidor + scan ClamAV), fail-closed. Contrato em **`SEGURANCA.md §3`**.

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
5. **NUNCA imputar intenção/caráter — assinalar factos, não acusar (regra anti-difamação,
   2026-06-18).** Mesmo num candidato que mente/infla, a Vera diz *"disse 5 anos (11:58);
   o CV diz 3 (CV) — vale reconfirmar"* ou *"afirmou X mas não sustentou sob aprofundamento
   (40:12)"* — **NUNCA** *"mentiu / é desonesto / inflou de propósito"*. O `contradito` e o
   `nao_sustentado` (`MODELO-DADOS §13`) reportam-se com **os dois lados + timestamps**, e
   a **Filipa interpreta a intenção**, não a Vera. É um produto **assistivo**: imputar
   desonestidade seria difamação (e o output textual é gerado por nós, não por ela —
   `LEGAL-E-RGPD`).

> Estas regras são **requisitos de produto**, não enfeite. Entram nos prompts do sistema
> e nos testes de aceitação (`TESTES-ACEITACAO.md`) — incl. um teste de que o output
> **nunca** usa vocabulário de intenção/caráter.

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
- **O override da Filipa também calibra (2026-06-17):** quando ela **discorda** do bot
  (*"o bot disse 'forte', mas para mim é 'ok' — explicou bem mas não tem prática real"*),
  esse override é registado e entra na calibração tal como o veredito do cliente. A
  experiência da recrutadora é sinal de treino, não ruído. (Modelo: campo de override
  no juízo — ver `MODELO-DADOS.md`.)
- **Arranque a frio:** no início a lente do cliente é fraca (sem histórico). Até a
  calibração ganhar massa, o bot apoia-se no **Role Profile** + nos **critérios
  declarados** do cliente (`client_criteria`) — julga com o que está escrito e com o
  conhecimento externo, e diz quando a confiança é baixa (Regra 3).

### D.1 — A métrica concreta (o "número que acompanhamos")

Cada entrevista deixa um par **(o que o bot previu, o que aconteceu)**. Dois sinais,
do mais fraco ao mais forte:

```
bot_predicted (strong/ok/weak)   ──►  vs  client_verdict (approved/rejected)   ← sinal médio
bot_predicted                    ──►  vs  placement_outcome (stayed/left)      ← ground-truth
```

- **Precisão** = % de vezes em que o bot acertou a direção: previu `strong` → cliente
  **aprovou** (e a pessoa **ficou** na garantia); previu `weak` → cliente recusou.
  Calculada por **cliente** e por **role_type** (não só global — um cliente pode pesar
  fit cultural que o mercado não pesa).
- **Sinal de erro acionável:** quando o bot diz `strong` mas o desfecho é negativo,
  regista-se o **`reason_type`** do `client_verdict` (skill_gap / cultural_fit /
  salary / other). Se um `reason_type` se repete (ex.: `cultural_fit`), é um **buraco do
  rubric/lente** → cria-se uma **regra explícita** para esse cliente (*"pesa fit
  cultural acima de skill"*) antes de tentar calibração estatística.
- **Cadência:** revisão a cada **N vereditos** (ex.: 10) por cliente/role; não há número
  mágico de arranque — começa qualitativo (ler os erros) e só vira estatística com massa.
- **Liga à migração web→interno** (`CAMADA-CONHECIMENTO` sub-camada ③): quando a precisão
  interna de um role_type supera consistentemente o Role Profile de mercado, o peso
  desloca-se para os **nossos** dados. O `placement_outcome` (ficou/saiu) é o que mais
  pesa — vale mais que qualquer auto-avaliação do bot.
- **Honestidade:** a precisão é **mostrada à Filipa** ("neste cliente acertámos 8/10");
  baixa confiança nunca é escondida (Regra 3). É isto que nos torna defensáveis — os
  concorrentes (Metaview/BrightHire) não fecham este loop até ao outcome real.

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

## Parte F — Pesos e compensação (avaliação HOLÍSTICA, decisão 2026-06-17)

Cada requisito (e cada `client_criteria`) tem **peso**: **obrigatório (`must`)** vs
**desejável (`nice`)**. Mas a avaliação **não é uma checklist eliminatória**:

- **Nunca eliminar por um desejável.** Se o candidato falha o **inglês** e o inglês é
  **desejável** (o cliente disse "não é mandatório"), isso **não** o reprova.
- **O bot mostra o trade-off, a Filipa decide.** Em vez de um "reprovado", o bot diz:
  > *"Falha **inglês** [desejável] — mas compensa em **X** e **Y** (must-have, ambos
  > coberto-com-prova). O cliente disse que inglês **não é mandatório**. **Recomendo
  > avançar.**"*
- **Holístico, não somatório cego.** Um must-have falhado pesa muito mais que três
  desejáveis falhados; um desejável forte pode compensar uma fraqueza não-crítica. O
  bot raciocina sobre o conjunto e **explica o raciocínio** — não devolve só um número.

> Implementação: o `peso` vive em `client_criteria.peso` e no critério do `rubric`
> (`must`/`normal`/`nice`) — ver `MODELO-DADOS.md`. O parecer
> (`RELATORIO-CLIENTE.md`) mostra o trade-off explicitamente, não esconde a fraqueza
> nem elimina por ela.

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

### Decisões RGPD fechadas (2026-06-17)
- **Reutilização de factos do candidato ENTRE clientes = PERMITIDA.** A Filipa pode
  reaproveitar o que sabe de um candidato noutro processo/cliente. **O consentimento é
  responsabilidade da Filipa** (pede autorização ao candidato e ao cliente, fora do
  produto). Isto **remove** o bloqueador de "limitação de finalidade" da `REVISAO-360`.
- **Consentimento de gravação = manual da Filipa, antes da reunião** (não in-app). O
  bot é visível como transcritor na call (ver `ARQUITETURA-TEMPO-REAL.md §6`).
- **Apagamento por ordem da Filipa:** ela diz ao bot *"apaga tudo deste cliente/
  candidato"* → **soft-delete com janela de recuperação** (dá para voltar atrás antes
  do purge definitivo). Ver `MODELO-DADOS.md` (`deleted_at` + `purge_after`).
- **Single-tenant (só IRIS) na v1:** acesso interno total — o recrutador vê todos os
  clientes/candidatos. Sem multi-tenant/RLS por agência nesta versão.

---

## O que entra na spec a partir daqui
- **Modelo de dados:** `rubric` (por vaga), `proveniencia` (em cada facto de memória),
  `veredito_cliente` (por candidato/vaga), `client_criteria`, `placement_outcome`,
  etiqueta `corrigido_pela_filipa`, classificação pessoal/profissional. → `MODELO-DADOS.md`.
- **Relatório critério-a-critério** contra os critérios do cliente. → `RELATORIO-CLIENTE.md`.
- **Processos passo-a-passo** do intake e do estudo pré-entrevista. → próxima iteração.
- **Testes de aceitação** das 4 regras da Parte C + dos novos fluxos. → `TESTES-ACEITACAO.md`.
