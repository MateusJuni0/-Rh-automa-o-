# Um dia na pele do recrutador — o que é chato e o que dá pra automatizar

> Exercício: eu sou o recrutador da agência. Listo o que realmente consome meu dia,
> marco o que é **massante** e classifico o que dá pra tirar das minhas costas.
> Isso define as features do produto por **ordem de dor**, não por ordem do que é "legal".

---

## O dia real de um recrutador de agência

Manhã:
1. Abro o e-mail e o WhatsApp: empresa-cliente mandou uma vaga nova, mal descrita
   ("preciso de um dev frontend sênior, urgente"). Tenho que ligar/escrever pra
   extrair os requisitos de verdade.
2. Abro o LinkedIn e nosso banco de candidatos pra garimpar gente que encaixe.
3. Recebo 40 currículos de uma vaga antiga. Leio um por um pra ver quem presta.
4. Fico no vai-e-vem de e-mail tentando achar horário que sirva pro candidato **e**
   pra mim (às vezes pra empresa também).

Tarde:
5. Antes de cada entrevista, estudo a vaga e a tecnologia pra não passar vergonha
   ("o que é mesmo um 'state manager'? que pergunta eu faço?").
6. Entro na call (Meet/Zoom/Teams) ou recebo presencial. Tento **ouvir, avaliar e
   anotar ao mesmo tempo** — e sempre esqueço de perguntar alguma coisa.
7. Depois da entrevista, escrevo um resumo pra mandar pra empresa-cliente. Demora,
   porque tento lembrar o que foi dito.
8. Atualizo a planilha/ATS. Mando feedback pra alguns candidatos (e me sinto mal
   pelos que ficaram sem resposta).

Fim do dia: repito follow-ups ("e aí, decidiram?", "ainda tem interesse?").

---

## Ranking da dor (o que automatizar primeiro)

Critério: **quão chato + quão repetitivo + quanto tempo come + quão automatizável**.

| # | Tarefa | Dor | Automatizável? | Prioridade |
|---|--------|-----|----------------|------------|
| 1 | **Triagem de currículos** (ler 40 CVs e ranquear vs vaga) | 🔥🔥🔥 | Muito | **Alta** |
| 2 | **Tomar nota + lembrar de perguntar tudo** na entrevista | 🔥🔥🔥 | Muito | **Alta** |
| 3 | **Resumo/relatório pós-entrevista** pra empresa | 🔥🔥 | Muito | **Alta** |
| 4 | **Estudar a vaga/tecnologia** antes (gerar roteiro) | 🔥🔥 | Muito | **Alta** |
| 5 | **Agendamento** (vai-e-vem de horário) | 🔥🔥 | Médio | Média |
| 6 | **Transformar pedido vago do cliente em requisitos** | 🔥🔥 | Médio | Média |
| 7 | **Feedback ao candidato** (escrever, personalizar) | 🔥 | Muito | Média |
| 8 | **Atualizar ATS/planilha** (digitar de novo o que já existe) | 🔥 | Muito | Média |
| 9 | **Comparar candidatos** entre si pra montar shortlist | 🔥 | Muito | Baixa* |
| 10 | **Follow-up** com candidato e cliente | 🔥 | Médio | Baixa |
| 11 | **Sourcing** (garimpar candidato no LinkedIn) | 🔥🔥 | Difícil/legal | Fora do MVP |

\* baixa só porque depende de já ter os outros itens; o valor é alto.

---

## O insight central

As dores #2, #3 e #4 são **a mesma jornada** (preparar → conduzir → relatar uma
entrevista). Se a gente atacar essa jornada de ponta a ponta, entrega o "uau" e
reaproveita o mesmo cérebro de IA. É o coração do produto.

A dor #1 (triagem) é a porta de entrada natural: é onde o recrutador sente alívio
imediato e onde a gente já conhece vaga + candidato — os mesmos dados que alimentam
a entrevista. Por isso faz sentido o MVP cobrir **triagem → entrevista → relatório**.

---

## O que a gente "livra" do recrutador, em uma frase cada

- **Triagem:** "Não leia 40 CVs; o sistema te entrega os 5 melhores já explicados."
- **Antes da entrevista:** "Não estude a vaga; receba o roteiro pronto com o que
  perguntar e como reconhecer boa resposta."
- **Durante:** "Não divida sua atenção; o copiloto ouve, marca o que já foi coberto
  e te cutuca com a próxima pergunta. Você só conversa."
- **Depois:** "Não escreva relatório; ele já vem pronto, com score vs requisitos,
  pra você revisar e mandar pro cliente."
- **Feedback:** "Não trave no 'o que escrever'; rascunho pronto e humano pra cada
  candidato, é só ajustar e enviar."

---

## Sobre as plataformas (Meet / Zoom / Teams / presencial)

Você disse "o que der" — então o design tem que ser **agnóstico de plataforma**.
A captura de áudio muda conforme o caso, e a complexidade também:

| Cenário | Como capturar o áudio | Dificuldade |
|---|---|---|
| **Presencial** | App no celular/notebook ouve o ambiente (1 microfone) | Mais simples de começar |
| **Meet/Zoom/Teams (online)** | Bot entra na call **ou** capturamos o áudio do sistema | Média/Alta |
| **Qualquer uma** | Gravar e processar **depois** (não tempo real) | Mais simples |

**Conclusão de design:** não amarrar o produto a uma plataforma. A "janela do
copiloto" é uma tela independente (web/app) que recebe a transcrição venha ela de
onde vier. Começamos com o caminho mais simples de captura e evoluímos.

---

## Próxima decisão

Confirmada a visão, o MVP recomendado é a jornada **Triagem → Entrevista → Relatório**,
com o **copiloto ao vivo** como estrela. Detalhes de tela no `UI-DESIGN.md`.
