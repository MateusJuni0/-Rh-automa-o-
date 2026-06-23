# Briefing de entrevista — Caso real #1 (T0)

> **Recrutadora:** Filipa · **Candidato:** Mateus Oliveira · **Cliente (empresa):**
> SecureGPT (grupo, plataforma de IA Generativa interna) · **Vaga:** Software
> Engineer confirmado (3–5 anos).
> **Gerado por:** o "cérebro" do copiloto (Claude), à mão, sem app — teste Wizard-of-Oz.
> **Linguagem:** simples (a Filipa não é técnica); cada termo difícil vem traduzido.

---

## Leitura rápida (30 segundos)

O Mateus é **muito forte exatamente no coração desta vaga** — a parte de Inteligência
Artificial (construir assistentes que conversam, que pesquisam, que usam ferramentas
sozinhos). Isto é o que ele faz todos os dias e tem provas reais a funcionar 24h.

Onde a empresa vai **cavar fundo** (e onde tu deves apertar):
1. **Sabe trabalhar DENTRO de uma equipa?** Ele sempre foi **fundador e fez tudo
   sozinho**. Esta vaga é numa equipa distribuída (França/Espanha/Portugal) com
   chefes técnicos. Esta é a **maior pergunta da empresa** — não a técnica.
2. **Azure** (a "nuvem" da Microsoft) — a vaga valoriza muito; ele só tem
   conhecimento **teórico**, nunca usou a sério.
3. **"Confirmado, 3–5 anos"** + um **fundador a candidatar-se a empregado** — a
   empresa vai querer perceber a experiência real e se ele fica.

Veredito de partida: **candidato forte na IA, com 3 pontos a esclarecer**. Se ele
responder bem ao ponto 1, é um ótimo encaixe.

---

## Mapa de cobertura (o que a vaga pede × o que ele tem)

| O que a vaga pede | Estado | Nota em linguagem simples |
|---|---|---|
| **IA: assistentes, RAG, "agentes", integrar modelos** | 🟢 **Forte** | É o ponto alto dele. RAG = o assistente vai buscar informação a documentos antes de responder; "agente" = software que decide e usa ferramentas sozinho. Ele construiu vários, a sério. |
| **Node.js (backend forte)** | 🟢 Bom | Backend = a "cozinha" do software, a parte que o utilizador não vê. Ele tem, mas mistura muito com outra linguagem (Python). Confirmar a profundidade só em Node.js. |
| **Testes (sobretudo "ponta a ponta")** | 🟡 A confirmar | "Ponta a ponta" = testar a app como um utilizador real, do início ao fim. Ele diz ter 262 testes num projeto — confirmar se são deste tipo. |
| **Boas práticas / DevOps** | 🟢 Forte | DevOps = pôr o software a correr de forma fiável e automática. Ele opera 5 sistemas em produção, com vigilância automática. |
| **React / Next.js (frontend)** | 🟢 Forte (sobra) | Frontend = a parte visível, os ecrãs. Era secundário na vaga; ele é mais que suficiente. |
| **Azure (nuvem Microsoft)** | 🔴 **Lacuna** | Só teórico. A vaga valoriza muito. Ponto fraco real. |
| **Inglês mínimo B1** | 🟡 No limite | Ele tem B1 (o mínimo). Equipa internacional fala inglês todos os dias — pode ser apertado. |
| **Trabalhar em equipa distribuída** | 🔴 **Por provar** | Nunca foi empregado numa equipa de engenharia — sempre dono/sozinho. **O grande ponto.** |

---

## As perguntas — por lente

> Para cada uma: **a pergunta** (que podes fazer tal e qual) · **porquê** · **resposta
> forte vs fraca** (para saberes o que ouvir).

### Lente 1 — Técnica (confirmar o que a vaga exige)

**T1. "Conta-me um problema técnico difícil que resolveste sozinho, do início ao
fim — e o que correu mal pelo caminho."**
- *Porquê:* a vaga quer alguém que "assume tudo desde o desenho à entrega". Queremos
  uma história real, não uma lista de tecnologias.
- *Forte:* descreve uma decisão, uma alternativa que rejeitou, um erro e como o
  apanhou. *(O projeto "Lince Brain" — com 262 testes e um "travão de emergência" —
  é um bom exemplo dele.)*
- *Fraco:* fala só de ferramentas ("usei isto e aquilo") sem o raciocínio nem tropeços.

**T2. "Quando construis um destes assistentes de IA, como garantes que ele não
inventa respostas erradas?"**
- *Porquê:* é o problema nº1 de quem trabalha com estes modelos; separa quem brincou
  de quem construiu a sério. (Inventar = o termo técnico é "alucinação".)
- *Forte:* fala em ir buscar a fonte real antes de responder (RAG), em verificar a
  resposta, em mostrar de onde veio a informação. Ele faz isto na "Madalena".
- *Fraco:* "confio no modelo" / não tem resposta clara.

**T3. "Os 262 testes que mencionas — testam a app como um utilizador real a usa, de
ponta a ponta?"**
- *Porquê:* a vaga exige testes "ponta a ponta" e dá-lhe ownership da estratégia de
  testes. O CV diz "262 testes" mas não diz o tipo.
- *Forte:* distingue os tipos de teste e diz o que faz para os mais realistas.
- *Fraco:* não sabe a diferença / são só testes pequenos de funções isoladas.

### 🟢 Lente 2 — O que a SecureGPT vai querer MESMO saber (as que decidem a contratação)

**C1. ⭐ "Sempre trabalhaste como fundador, a decidir tudo. Aqui vais ter chefes
técnicos, revisões do teu código pelos colegas e uma equipa em três países. Como é
que isso é para ti?"**
- *Porquê:* **é a pergunta mais importante de todas.** O maior risco que a empresa vê
  num fundador é: "será que ele sabe trabalhar DENTRO da nossa estrutura, aceitar
  feedback e seguir o nosso processo, em vez de fazer tudo à maneira dele?" Um
  entrevistador técnico distraído só pergunta sobre código — esta é a que muda a
  decisão.
- *Forte:* mostra que valoriza revisão de código, dá um exemplo de aceitar uma
  decisão que não era a dele, fala com humildade sobre aprender com uma equipa.
- *Fraco:* "trabalho melhor sozinho" / desvaloriza processo e revisões.

**C2. ⭐ "Estás a candidatar-te a um lugar de empregado tendo a tua própria empresa a
funcionar. O que te faz querer isto, e o CMTecnologia continua a andar em paralelo?"**
- *Porquê:* a empresa vai pensar "ele vai-se embora daqui a 6 meses para o projeto
  dele?". É um medo real de quem contrata um fundador. Melhor pôr na mesa do que
  deixá-los a adivinhar.
- *Forte:* uma razão honesta e estável (aprender com uma equipa grande, foco, etc.) e
  clareza sobre o tempo/dedicação.
- *Fraco:* vago, ou dá a entender que isto é "enquanto não arranca o meu".

**C3. "Muito do teu trabalho foi criado com ferramentas de IA que geram código (o CV
fala em 7.559 páginas com a Vercel v0). Onde é que tu fizeste a engenharia mesmo a
sério, à mão, e onde é que a ferramenta fez por ti?"**
- *Porquê:* a empresa contrata um **engenheiro**, não um operador de ferramentas. Vão
  querer ter a certeza de que ele percebe o que está por baixo, não só gera. É um
  receio legítimo num CV cheio de "gerado com IA".
- *Forte:* separa com clareza — "as landing pages foram geradas, mas o Lince Brain,
  os pagamentos do Cronos, a encriptação, isso construí e percebo linha a linha".
- *Fraco:* não consegue separar / fica defensivo.

**C4. "A vaga valoriza muito experiência com a nuvem da Microsoft (Azure). Tu tens
isso só na teoria. Como encaras essa lacuna?"**
- *Porquê:* a empresa **sabe** que ele não tem Azure (está no CV). O que ela quer ver
  é a **atitude**: ignora, ou tem plano para aprender depressa?
- *Forte:* reconhece sem rodeios, mostra que aprende rápido (deu provas: passou de
  frontend para IA sozinho) e diz como ramparia.
- *Fraco:* finge que sabe, ou despreza a lacuna.

### Lente 3 — Esclarecer o CV (gaps e inconsistências)

**G1. "O teu inglês está como B1 — o mínimo da vaga, e a equipa fala inglês todos os
dias. Consegues acompanhar uma reunião técnica difícil em inglês?"**
- *Porquê:* é o limite exato do que a vaga pede; numa equipa de 3 países é uso diário.
  Melhor saber agora do que o cliente descobrir na 2ª entrevista.
- *Forte:* honesto sobre o nível e como compensa (lê/escreve bem, está a melhorar).
- *Fraco:* evita o tema.

**G2. "Pelo CV, a parte de engenharia mais forte é de 2024 para cá (cerca de 2
anos), e antes foi frontend. A vaga pede 3–5 anos confirmados. Como contas a tua
experiência?"**
- *Porquê:* há um possível desencontro entre o "3–5 anos confirmados" da vaga e a
  linha do tempo dele. Dá-lhe a hipótese de enquadrar (profundidade real vs anos).
- *Forte:* assume a linha do tempo e compensa com profundidade ("em 2 anos pus 5
  sistemas em produção a sério").
- *Fraco:* estica os anos de forma pouco credível.

---

## Rede de segurança — não sair da call sem isto

- [ ] **C1 (trabalhar em equipa)** — se só houver tempo para 1 pergunta, é esta.
- [ ] **C2 (fundador → empregado)** — o medo silencioso da empresa.
- [ ] **Logística:** ele é de Lisboa, a vaga é híbrida 2 dias no escritório → confirmar
      que está OK (parece estar). Disponibilidade/data de início. Expectativa salarial.
- [ ] **Azure (C4)** — não como eliminatório, mas a atitude perante a lacuna.

---

## O que isto seria, ao vivo (lembrete do produto)

Hoje fiz isto à mão e tu lês de um documento. No produto, estas mesmas perguntas
apareceriam **uma de cada vez** no overlay durante a call, à medida que o Mateus
falasse — a 🟢 da lente do cliente em destaque — e no fim sairia o parecer.

---

## RESULTADO DO TESTE (2026-06-17) + v2 das perguntas

**Veredito do Mateus (candidato neste caso):** as perguntas 🟢 **acertaram** — eram
quase as que a Filipa (provavelmente também gerou com IA) lhe fez na entrevista real.
**A C2 (fundador→empregado) ela NÃO fez** → o bot encontrou uma pergunta que a
recrutadora real falhou = valor acrescentado provado.

**MAS — a crítica que reorienta o produto:** se as perguntas de topo são as mesmas
que uma recrutadora + ChatGPT já geram, **a pergunta não é o fosso.** O fosso é a
**PROFUNDIDADE**: ouvir a resposta e furar atrás de prova ("como exatamente? leste o
código ou só aprovaste o que a IA gerou? dá um caso concreto"). É isso que uma
pessoa a ouvir+avaliar+anotar não consegue, e que uma lista de perguntas de IA também
não faz.

> **Hipótese refinada:** o diferencial não é *gerar a boa pergunta* — é a **escada de
> aprofundamento ao vivo, guiada pela resposta**, que extrai evidência e apanha o
> vago/inflacionado. Implica o spec: o "frame de avaliação ao vivo"
> (`ARQUITETURA-TEMPO-REAL §9`) tem de **conduzir os follow-ups de prova**, não só
> propor a 1ª pergunta.

### v2 — as 🟢 com escada de aprofundamento (o que a app faz que o ChatGPT não fez)

**C1 ⭐ Trabalhar em equipa** — abertura igual, depois FURA:
- "Dá-me a **última vez** que alguém reviu o teu código e disse que estava mal. O que
  era? Concordaste?"
- "Aqui um Tech Lead pode dizer *'não, faz à nossa maneira'* mesmo que a tua seja
  melhor. **Conta uma vez** em que seguiste uma decisão técnica que não era a tua."
- *Prova vs vago:* um caso concreto = forte. "Eu adapto-me bem" sem exemplo = fraco
  (e ele tem pouco histórico de equipa → furar até dar exemplo real OU admitir a lacuna).

**C2 ⭐ Fundador → empregado** (a que a Filipa falhou) — depois FURA:
- "Daqui a 6 meses o CMTec arranca a sério. **O que acontece a este emprego?**"
- "O que é que um emprego te dá que a tua empresa não te dá?" *(testa motivação real)*

**C3 ⭐ Engenharia a sério vs gerado por IA** (a mais afiada, dado o CV) — FURA fundo:
- "Das 7.559 páginas com a v0 — quando a ferramenta te deu uma página, **leste o
  código antes de publicar, ou aprovaste e seguiste?**"
- "Dá-me a **última vez** que a IA te gerou código e tu disseste *'não, isto está
  errado'* e reescreveste. O que estava errado?"
- "Os 262 testes do Lince Brain — escreveste à mão? **Qual foi o último bug que um
  teste apanhou** que tu não tinhas visto?"
- "Se eu te tirasse o Claude e a v0 amanhã, **que parte dos teus sistemas não
  conseguirias manter?**"
- *Prova vs vago:* uma rejeição concreta + um bug específico + linha clara entre
  gerado e construído = forte. Não consegue separar = o receio da empresa confirma-se.

**C4 Azure** — depois FURA:
- "**Quanto tempo** achas que levavas a estar produtivo em Azure, e **como** lá
  chegavas?"
- "Já aprendeste algo difícil sozinho sob pressão — passaste de frontend para IA.
  **Quanto tempo** levou?"

> A diferença entre v1 e v2 **é o produto**. v1 (a pergunta) qualquer um gera. v2 (a
> escada de prova, ao vivo, conforme a resposta) é o que vendemos.
