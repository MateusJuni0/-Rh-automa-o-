# O Assistente Pessoal da Filipa — o "ChatGPT dela", não um bot

> **Correção do Mateus (2026-06-17):** o que eu tinha desenhado (agenda + lacunas +
> Q&A) era **fraco** — um bot limitado. **Não é isso.** É **software personalizado
> para a Filipa**: um assistente de IA **de uso geral** (como o ChatGPT), mas que
> **conhece o mundo dela** (candidatos, clientes, vagas, calendário) e **age** (gera
> planilhas, CVs, documentos, emails…). Tem a **estrutura do Hermes/Lince** —
> agente com ferramentas, memória e que **aprende** com ela. Não é "uma porra de um
> bot simples em Python".

---

## 1. O que é (três coisas ao mesmo tempo)

```
        ┌──────────────────────────────────────────────────────────┐
        │           O ASSISTENTE PESSOAL DA FILIPA                  │
        │                                                          │
        │  ① CONVERSA GERAL        ② CONHECE O MUNDO DELA          │
        │  (como o ChatGPT:        (RAG sobre candidatos,          │
        │   pergunta o que quiser,  clientes, vagas, entrevistas,  │
        │   escreve, traduz,        calendário, memória)           │
        │   pensa, resume)                                         │
        │                                                          │
        │              ③ AGE (ferramentas — faz coisas)           │
        │   planilhas · CVs · pareceres · emails · agenda ·        │
        │   anúncios · shortlists · exportações · pesquisa web     │
        └──────────────────────────────────────────────────────────┘
```

A diferença para o ChatGPT genérico: ela **não tem de sair para outra app**. Precisa de
uma planilha de comparação? De refazer o CV de um candidato no template do cliente? De
um email para o cliente? **Pede aqui** — e o assistente já tem o **contexto dela** e
**faz**. É a vantagem de ser **à medida**, não genérico.

---

## 2. Estrutura agêntica — **um Hermes/Lince por trás** (decisão 2026-06-17)

> **Pergunta do Mateus:** "não seria melhor pôr um Hermes por trás, ou fazemos manual?"
> **Resposta: Hermes por trás.** Não construímos o motor agêntico de raiz — seria
> reinventar o que já está provado no **Lince Brain**. **Instanciamos um Lince/Hermes
> dedicado ao RH** (FastAPI + grafo LangGraph + tool-calling + estado PostgreSQL +
> trilho de auditoria + kill switch). **Regra (igual à biometria): clonar/instanciar,
> NÃO misturar** com o Lince de operações da CMTec — é um agente próprio, com as
> ferramentas do recrutamento, na infra do RH.

É um **agente com ferramentas**, com a arquitetura que já corre no **Lince Brain**:

- **Loop de raciocínio com tool-calling:** o assistente decide que ferramenta usar,
  usa, observa o resultado, continua — até resolver o pedido.
- **Estado + memória persistente** (Postgres): a conversa e o que aprende não se perdem.
- **Trilho de auditoria:** toda ação fica registada (quem pediu, o que fez, quando) —
  defensável, como no Lince.
- **Porta de segurança (human-in-loop):** ações **para fora** (enviar email, marcar no
  calendário, apagar) **pedem confirmação** antes de executar. Ler/gerar rascunho é
  livre; **enviar/alterar o mundo** pede "confirmas?".

> Reuso real: o padrão do `Lince Brain` (grafo de nós + tools + audit + kill switch)
> é o molde. Não construímos um agente do zero — adaptamos o que já corre.

---

## 3. As ferramentas (o que ela pede que ele FAÇA — ela não opera nada)

> **Princípio (Mateus 2026-06-17): a Filipa não precisa de saber mexer nas coisas.**
> Ela **fala** ("vou entrar numa reunião agora", ou cola o link) e o assistente trata
> da parte técnica **por trás** — põe o bot na call, prepara tudo. Ela conversa; ele
> opera. O técnico é problema do assistente, não dela.

| Categoria | Exemplos do que faz |
|---|---|
| **Operar a entrevista** ⭐ | ela diz *"vou para uma reunião"* / cola o **link do Meet/Zoom** → o assistente **põe o bot na call** (ou prepara a captura local), cria a sala/sessão, arranca o copiloto. **Fecha o A2 do lado dela** — ela não mexe em LiveKit nem em nada. |
| **Documentos** | **planilhas** (comparação, pipeline, shortlist), **CVs** (reformatar no template do cliente, ou melhorar), **pareceres**, **propostas**, **anúncios de vaga**, cartas |
| **Comunicação** | rascunhar (e, com confirmação, **enviar**) emails a clientes/candidatos; WhatsApp/Telegram; follow-ups |
| **Agenda** | ler/criar/reagendar eventos (Google Calendar); convites |
| **Dados dela** | procurar/filtrar candidatos no talent pool, shortlist, **exportar** (CSV/Excel/PDF) |
| **Web & sourcing** ⭐ | pesquisar (Exa/Brave, **APIs pagas que ela já tem**); e, **se ela der acesso**, **navegar e ir ao LinkedIn buscar candidatos** (ou o que ela pedir) — sourcing assistido |
| **Recrutamento** | puxar um parecer, **comparar candidatos** (`ASSISTENTE-CONVERSA` Modo C), gerar o briefing, rascunho de **feedback ao candidato** (fecha A5) |

- **Acesso é dela, concedido a ele:** browsing/LinkedIn/sourcing correm com o **acesso
  que a Filipa concede** (login dela, dentro dos termos das plataformas). Ações com
  efeito (enviar, marcar, publicar, pôr-se numa call) passam pela **porta de
  confirmação** (§2).
- As ferramentas de **documentos Office** (xlsx/docx/pdf) são reais — reaproveitam as
  skills de geração de ficheiros da CMTec. A planilha de comparação é um **artefacto
  gerado** que ela baixa e edita, não um ecrã rígido.

> **A2 (entrar na call) — reclassificado:** parte é **embalagem** (a mecânica LiveKit/
> captura), mas o **gatilho e a orquestração são do assistente** — ela nunca configura
> nada à mão. Ver `ARQUITETURA-TEMPO-REAL §5`.

---

## 4. APRENDE com ela (o "vai aprendendo" do Hermes)

A memória **cresce** e **personaliza** — é o que o torna *dela*, não genérico:

- **Estilo dela:** como escreve aos clientes (tom, formato, assinatura) → os rascunhos
  saem **na voz dela**, não num inglês de robô.
- **Preferências:** que template de CV usa para cada cliente, que critérios costuma
  pesar, como gosta dos pareceres → o assistente antecipa.
- **Padrões do trabalho:** clientes recorrentes, vagas que se repetem, horários.
- **Correções = treino:** quando ela edita um rascunho ou rejeita uma sugestão, isso
  fica e **afina** o próximo (mesma disciplina da calibração — `INTAKE` Parte D).

Modelo: factos de preferência/estilo em memória (reusa `client_memory_fact` /
`candidate_memory_fact` + uma **memória do recrutador** — ver §7). Anti-achismo: o
assistente **mostra o que aprendeu** e pode ser corrigido; não decide em segredo.

---

## 5. Conversa geral (a parte "ChatGPT") — com escape para fora do recrutamento

Ela pode pedir **qualquer coisa**, mesmo fora do recrutamento (escrever um texto,
explicar algo, traduzir, fazer contas). O assistente responde como um LLM topo de
gama — **mas com o contexto dela disponível** se for útil. Não a prende ao domínio.

> Regra de ancoragem (herdada de `ASSISTENTE-CONVERSA`): quando a resposta depende de
> **dados dela** (um candidato, um cliente), **cita a fonte** e nunca inventa. Em
> conversa geral (conhecimento do mundo), comporta-se como um LLM normal.

---

## 6. Onde vive + que modelo usa

- **Web app** é a casa do assistente (chat + artefactos gerados para baixar). No
  **"durante"** a faceta ao vivo está no overlay (`ARQUITETURA-TEMPO-REAL §9` chat ao vivo).
- **Modelos por slot** (`MODELOS-E-API`): geração de qualidade (parecer, CV, proposta)
  → `ARCHITECT`; tarefas simples → `EXTRACTOR`; ao vivo → `LIVE`. Agnóstico/OpenRouter,
  a Filipa troca na app.

---

## 7. Relação com os outros docs (uma mente, várias facetas)

Há **um** assistente; estes docs são facetas dele:
- **Este doc** = o todo: uso geral + ferramentas + aprendizagem + estrutura agêntica.
- `ASSISTENTE-CONVERSA.md` = a faceta de **Q&A/comparação** sobre candidatos/clientes.
- `ASSISTENTE-PROATIVO.md` = a faceta **proativa** (agenda, lacunas).
- `ARQUITETURA-TEMPO-REAL.md §9` = a faceta **ao vivo** (durante a entrevista).

> Nova memória a acrescentar ao modelo de dados: **`recruiter_memory_fact`** (estilo,
> preferências, padrões da Filipa) — o que torna o assistente *dela*. Ver `MODELO-DADOS`.
