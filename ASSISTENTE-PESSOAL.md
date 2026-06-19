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

> **Pergunta do Mateus (2×):** "o agente vai ser o Hermes ou codamos manual?"
> **Resposta decisiva: o MOTOR é o do Hermes; o AGENTE é nosso e limpo.**
>
> - **Reaproveitamos o *core* provado do Lince Brain** — o grafo, o loop de
>   tool-calling, o estado em Postgres, o trilho de auditoria, o kill switch. Isto **não**
>   se recoda do zero (é a parte difícil e já está testada).
> - **NÃO forkamos o bot de operações da CMTec** (o Lince tem tralha interna: Telegram
>   de ops, monitorização de infra). Isso não pode ir num **produto para vender**.
> - **Construímos um agente PRÓPRIO do RH** — código limpo, só com as ferramentas de
>   recrutamento, na infra do RH. O *core* do Hermes entra como **fundação/biblioteca**;
>   as ferramentas e os nós específicos são nossos.
>
> Resultado: **motor provado + produto limpo e vendável.** É a mesma lógica da
> biometria (reusar o engine, instância própria, não misturar projetos).

> **Ao VENDER — instância INDEPENDENTE na VPS dela (Mateus 2026-06-17):** quando
> entregarmos, **montamos um Hermes/agente fresco na VPS do comprador** — **não** um
> fork que "puxa o nosso". O projeto **é dele**, não nosso. Logo a instância dele:
> - **não tem cordão umbilical** connosco (não depende da nossa infra/repo em runtime);
> - **não fica refém da nossa manutenção** (se pararmos de mexer no nosso, o dele continua);
> - **não fica limitado** pelo que fazemos do lado de cá.
>
> O *core* do Hermes que reusamos é **vendorizado dentro do produto** (vai no bundle,
> `INFRA-E-MIGRACAO`), não puxado de um repo nosso. Mais limpo, mais profissional, e
> juridicamente claro: entregámos um produto autónomo, não um aluguer da nossa stack.

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

### 2.1 Anatomia do agente (como o fazemos, em concreto)

**O grafo (loop ReAct, como o Lince Brain):**
```
  pedido da Filipa
       │
   ┌───▼────────┐   entende o pedido + resolve o ALVO (cliente/vaga/candidato)
   │ ROTEADOR   │   (nunca adivinha — desambigua, INTAKE) + recupera contexto/memória (RAG)
   └───┬────────┘
   ┌───▼────────┐   decide a sequência de ferramentas (1 ou várias)
   │ PLANEADOR  │   estima custo; se for caro/loop, pede orientação
   └───┬────────┘
   ┌───▼────────┐   chama a ferramenta → observa → repete até resolver
   │ EXECUTOR   │◄─┐  (cada chamada registada em assistant_action)
   └───┬────────┘  │
       │  precisa de efeito externo? (enviar/marcar/publicar/entrar-na-call)
   ┌───▼────────┐  │  SIM → PORTA DE CONFIRMAÇÃO (a Filipa aprova) → executa
   │ VERIFICADOR│──┘  confere o resultado (deu erro? bate certo?) → re-tenta ou reporta
   └───┬────────┘
   ┌───▼────────┐   responde na língua dela, cita fontes, mostra o que fez
   │ RESPONDEDOR│
   └────────────┘
```

**Registo de ferramentas (tool registry)** — cada ferramenta é declarada com:
`{ nome, descrição, input (schema Zod), efeito, slot_modelo }`. O **efeito** decide a
porta de segurança — e a regra é **não chatear** (decisão Mateus 2026-06-17):

| Efeito | Exemplos | Confirma? |
|---|---|---|
| `leitura` / `rascunho` / `geração` | procurar, ler, **gerar** um documento/CV/parecer/email (sem enviar), comparar | **NÃO** — flui livre |
| `gravar` (durável) | **salvar** um documento, criar/editar **candidato/cliente/vaga**, gravar facto na memória | **SIM** |
| `enviar_fora` (irreversível) | **enviar** email/mensagem, marcar no calendário, publicar, **pôr-se na call** | **SIM** |

> Ou seja: ela pede, ele **faz e mostra** (rascunhos, pesquisas, documentos gerados) sem
> interromper; **só pergunta quando vai gravar nos registos** (documentos, dados de
> clientes/candidatos) **ou mandar algo para fora**. Adicionar capacidade = registar uma
> ferramenta nova, **não** mexer no grafo.

**Segurança da confirmação (correção da auditoria 2026-06-18):**
- A confirmação de `enviar_fora` mostra **o conteúdo LITERAL + o destinatário exato**
  (não só "vou enviar um email") — a Filipa vê o que sai antes de sair.
- **Conteúdo da web/CV/mensagens do cliente é não-confiável** → risco de *prompt
  injection* indireta (um CV pode tentar manipular o agente). Regra: o que vem de fontes
  externas entra como **dados a citar**, nunca como **instruções**; o agente não executa
  ordens encontradas em documentos/web.
- `save_memory_fact` com `source='inferred'` não confirma, mas **nunca grava `personal`
  inferido sem revisão** (liga ao default conservador, `MODELO-DADOS §5`).

**Estado (persistido em Postgres, recupera após queda):** conversa + **contexto ativo**
(em que cliente/vaga/candidato ela está) + plano corrente + resultados intermédios.
Tabelas: `assistant_thread` (+`active_context`) + `assistant_message` + `async_job`
(`MODELO-DADOS §12`). Redis = só cache quente. Memória: `recruiter_memory_fact` +
RAG sobre os dados dela.

**Contexto ativo (web, não só Telegram) — gap "dia caótico":** o `active_context` do
`assistant_thread` guarda a(s) **entidade(s) em foco**. Cada turno **atualiza-o** (ela diz
"o Rui" → resolve e foca o Rui) e os pedidos seguintes **herdam-no** até mudar. É o que
evita pedir o alvo a cada frase **e** colar tudo ao primeiro candidato.

**Multi-tarefa (pedido composto) — gap "manhã caótica":** quando ela manda vários numa
rajada (*"compara o João e a Ana, gera o CV do Rui, marca com a Marta, email ao cliente X"*),
o **Roteador decompõe em sub-tarefas**, **resolve o alvo de CADA uma** (não herda cego o
contexto), e cada uma corre o seu fluxo (com a sua porta de confirmação). Mostra o plano
("vou fazer 4 coisas: …") para ela ver/reordenar.

**Fila de confirmações:** as ações `gravar`/`enviar_fora` pendentes ficam em
`assistant_action (status='pending_confirm', thread_id, expires_at)` → a UI mostra-as
**agrupadas por pedido**, ordenadas, com expiração; ela aprova/rejeita cada uma (a #1 pode
ficar pendente enquanto aprova a #3). Sem isto, rajadas deixam confirmações órfãs.

**Salvaguardas (do Lince Brain):**
- **Kill switch** — corta o agente se descarrilar.
- **Auditoria** — toda ação em `assistant_action` (quem, o quê, quando, resultado).
- **Orçamento por pedido** — limite de passos/tokens por tarefa (não entra em loop caro;
  liga à disciplina de tokens, `ARQUITETURA-TEMPO-REAL §3`).
- **Escopo/RGPD** — só toca nos dados a que tem direito; pessoal fora do juízo.

**Ferramentas longas (ex.: sourcing no LinkedIn)** correm **assíncronas**, com progresso
(*"a procurar… 3 perfis encontrados"*), sem bloquear o chat; se a plataforma bloquear ou
uma API cair, **degrada e avisa** (não finge sucesso).

**Modelos por nó (slots de `MODELOS-E-API`):** PLANEADOR/RESPONDEDOR/geração de
qualidade = `ARCHITECT`; tarefas simples/extração = `EXTRACTOR`; faceta ao vivo = `LIVE`.

**Empacotamento/deploy:** FastAPI + grafo (LangGraph) num container próprio do RH (o
"Lince clonado"), estado no Postgres do RH, parte do bundle de migração
(`INFRA-E-MIGRACAO.md`).

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
| **Web & sourcing** ⭐ | pesquisar (Exa/Brave); e **sourcing de candidatos via Apify** (actor de LinkedIn) — reaproveita as skills **`lead-scraper-apify` + `lead-enricher`** que a CMTec **já tem** no Hermes (5 tokens Apify + token broker) |
| **Recrutamento** | puxar um parecer, **comparar candidatos** (`ASSISTENTE-CONVERSA` Modo C), gerar o briefing, rascunho de **feedback ao candidato** (fecha A5) |

- **Sourcing via Apify (não browser arriscado) — decisão Mateus 2026-06-17:** em vez de
  automatizar o login dela no LinkedIn (território cinzento de ToS + deteção), o
  sourcing usa **Apify** (actors de scraping geridos) — **reaproveitando o que já temos
  no Hermes**: as skills `lead-scraper-apify` (busca) + `lead-enricher` (enriquece), com
  os **5 tokens Apify** + o **token broker** já em produção. Mais limpo, mais robusto,
  menos risco. Mais tarde dá para outras fontes/actors. *(Resolve o risco de ToS que
  estava sinalizado.)*
- **Acesso é dela, concedido a ele:** ações com efeito (enviar, marcar, publicar,
  pôr-se numa call, gravar dados) passam pela **porta de confirmação** (§2.1).
- As ferramentas de **documentos Office** (xlsx/docx/pdf) são reais — reaproveitam as
  skills de geração de ficheiros da CMTec. A planilha de comparação é um **artefacto
  gerado** que ela baixa e edita, não um ecrã rígido.
- **Vários CVs por candidato (decisão Mateus 2026-06-18):** a Vera adiciona/gere **N CVs**
  por candidato (versões ao longo do tempo — o de hoje e o de há 1 ano). Pode **gerar um
  CV novo** (reformatar no template do cliente, ou melhorar) — fica guardado como
  `source='generated'`, **sem destruir os originais** (`MODELO-DADOS §9`).
- **Relatórios em PDF:** o parecer e outros documentos exportam para **PDF** prontos a
  enviar. Tudo personalizado (template/estilo do cliente), **nada genérico** — é o ponto:
  a Filipa **não vai a uma IA do Google**; a Vera tem o LLM, as ferramentas e o contexto
  dela, e faz aqui.

> **A2 (entrar na call) — reclassificado:** parte é **embalagem** (a mecânica LiveKit/
> captura), mas o **gatilho e a orquestração são do assistente** — ela nunca configura
> nada à mão. Ver `ARQUITETURA-TEMPO-REAL §5`.

---

## 4. APRENDE com ela — memória que se escreve sozinha e NÃO degrada (long-term)

> **Porquê isto importa (a 360°, não só código):** o valor deste produto **compõe-se
> com o tempo** — quanto mais o assistente conhece a Filipa e os clientes dela, melhor
> serve e mais difícil é largá-lo. **Se a memória degrada ou trava, morre o
> diferencial.** Por isso a robustez de memória a longo prazo **é o produto**, não um
> detalhe técnico.

O assistente **escreve a sua própria memória** enquanto fala com ela — aprende contínuo:

> **Regra dura (Mateus, 2026-06-18): salva-se SOZINHO, sempre.** As mensagens/factos são
> **persistidos automaticamente e em contínuo** — a Filipa **nunca** tem de dizer "guarda
> isto" e a memória **nunca fica desatualizada**. (Pedir para salvar à mão é exatamente o
> anti-padrão que queremos evitar.) E porque o uso vai **crescer muito** (transcrições de 2h,
> destilação, pasta curada — expansão futura), o desenho assume **muitos dados** desde já:
> consolidação que limita o crescimento (§"crescimento limitado") + health-check que alerta se
> a destilação parar (a dor do claude-mem) — **nunca perder informação**. Detalhe em `DATA-RETENTION.md`.

- **Estilo dela:** tom, formato, assinatura → os rascunhos saem **na voz dela**.
- **Preferências:** template de CV por cliente, critérios que pesa, como gosta dos
  pareceres → antecipa.
- **Padrões:** clientes recorrentes, vagas que repetem, horários.
- **Correções = treino:** ela edita um rascunho/rejeita uma sugestão → fica e **afina** o
  próximo (mesma disciplina da calibração, `INTAKE` Parte D).

### Duas camadas (como o sistema de memória que já usamos)
- **Captura granular:** cada interação/correção entra como facto (`recruiter_memory_fact`
  + embedding), com proveniência.
- **Camada curada/destilada:** consolidação periódica resume e organiza o que se
  acumulou (os padrões estáveis sobem; o ruído cai).
- **A avaliação avançada do candidato destila para a memória:** a "leitura detalhada"
  (afirmação-a-afirmação, prova graduada, contradições, confiança; ver
  `ARQUITETURA-TEMPO-REAL §9`) é **destilada e guardada na memória** com proveniência dura
  (`candidate_memory_fact.source_chunk_id`, `MODELO-DADOS §16`) — automática e contínua (a
  Filipa nunca pede "guarda"), nunca um resumo leve descartável. É isto que torna o recall e
  o parecer defensáveis e que faz a memória do candidato compor-se com o tempo.

### ⚠️ Lição do claude-mem — NUNCA "travar 6 meses depois" (a dor do Mateus)
O claude-mem do Mateus **parou de destilar em silêncio (abr→jun/2026)** e ninguém
soube. Este assistente **não pode** repetir isso. Regras duras:
- **Health check da memória:** a consolidação corre em schedule **e é monitorizada** —
  se **parar**, **alerta** (não falha calado). É a regra nº1 que aprendemos com a saga
  do claude-mem. ⚠️ **(família H) Vigia também a destilação POR ENTREVISTA**, não só a
  consolidação periódica: o `async_job kind='distill_final'` (`MODELO §16.H`) `failed` ou
  pendente há > N → alerta. Um crash a meio dos INSERTs de factos **não** pode ficar
  silencioso (senão perdem-se factos de uma entrevista e o áudio é purgado sem fonte). **Destino do alerta = configurável por deployment** (o Telegram/email
  **do comprador**, não o nosso — senão na VPS independente dele o alerta não chega a
  ninguém e repete-se a saga). A instância traz um **painel de saúde mínimo** (memória,
  backups, custo, STT) — vale para todos os falhos silenciosos em produção.
- **Crescimento limitado:** factos antigos são **consolidados/resumidos** para a memória
  não **inchar e abrandar** com os meses (o "6 meses depois trava"). Recall mantém-se
  rápido independentemente do volume.
- **Sem ponto único de falha silenciosa:** o recall tem fallback (busca direta na DB) se
  uma camada falhar; nada depende de um worker que possa morrer sem aviso.
- **Recall fiável > recall esperto:** preferimos FTS/vetorial estáveis a soluções
  instáveis (a lição: o vetorial instável foi desligado no claude-mem; aqui escolhemos o
  que aguenta produção).

### Segurança da memória (parte do 360°)
- A memória da Filipa é **dela**: isolada por recrutador/agência (RLS na v2), encriptada
  em repouso, auditável (quem escreveu o quê, quando).
- **RGPD:** factos pessoais etiquetados, **fora do juízo** (`MODELO-DADOS §5`); ela pode
  ver, corrigir e **mandar apagar** (soft-delete com `purge_after`).
- **Anti-achismo:** o assistente **mostra o que aprendeu** e deixa-se corrigir — nunca
  decide com base em memória que ela não pode inspecionar.

### Memória ENTRE SESSÕES — separa, aprende, recupera (verificável) — Mateus 2026-06-18
A memória **não vive numa sessão** — vive na **DB (VPS)**, por isso **persiste entre
sessões** (fecha a app hoje, abre amanhã, ela está toda lá — mesmo princípio do cliente
fino). Três coisas que **têm de funcionar de verdade** (e ser testadas, não assumidas):
1. **Separa** — memória por entidade isolada: do **recrutador** (estilo/preferências) ·
   do **candidato** · do **cliente**. Pessoal etiquetado à parte (fora do score). Nunca
   se misturam num saco só.
2. **Aprende** — cada correção/edição/veredito atualiza a camada certa (consolidação
   periódica, monitorizada — §4 health check).
3. **Recupera bem** — recall por **RAG (pgvector) + busca direta** como fallback; o
   assistente **cita a fonte** do que recupera. Se a busca falhar, degrada para a busca
   direta — **nunca "não sei" por o recall ter partido** (a lição do claude-mem).
> **Critério de aceitação (TESTES):** numa sessão nova, perguntar algo dito numa sessão
> anterior → recupera com a fonte; um facto do candidato A **não** aparece no candidato
> B; uma preferência corrigida pela Filipa **prevalece** sobre a inferida.

> Modelo: `recruiter_memory_fact` (+embedding) + `client_memory_fact` /
> `candidate_memory_fact` (§7, `MODELO-DADOS §8`). A consolidação + o health check são
> um **cron/serviço monitorizado** (entra no `INFRA-E-MIGRACAO` como serviço a recriar
> em cada salto).

### 4.1 Onboarding — arranque a frio com uma LISTA (decisão Mateus 2026-06-17)

No 1º uso o assistente não a conhece. Em vez de aprender só aos poucos, faz um
**onboarding ativo**: apresenta-lhe **uma lista de perguntas** para ela responder de
uma vez (*"para te servir bem, responde quando puderes a estas"*). O Mateus avisa-a de
que há uma lista — **e quanto mais pessoal ela responder, melhor** (mais personalizado
fica). Tudo o que ela diz vira `recruiter_memory_fact` (origem `explicit`).

**Blocos da lista (exemplos — o agente adapta):**
- **Estilo & comunicação:** como assinas os emails? tom (formal/próximo)? PT-PT/PT-BR?
  frases que usas sempre? o que detestas num email?
- **Clientes:** quem são os recorrentes? o que cada um valoriza/recusa? quem é exigente?
- **Como trabalhas:** que critérios pesas sempre? que templates de CV/parecer preferes?
  horários, dias de entrevistas, antecedência dos lembretes?
- **Pessoal (quanto mais, melhor):** como gostas que te tratem? nível de detalhe que
  preferes nas respostas? o que te irrita num assistente? até gostos/contexto que
  ajudem o tom.

**Regras:** é **conversa, não formulário rígido** (ela responde à vontade, salta o que
quiser, completa depois); cada resposta é **editável/apagável** (é dela, RGPD); o
assistente **mostra o que guardou** ("anotei que assinas 'Abraço, Filipa'"). Daí em
diante a aprendizagem contínua (§4) afina o que o onboarding semeou. **Fecha o
cold-start** sem ser chato — uma lista de uma vez, não 100 perguntas pingadas.

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

---

## 8. Packs de ferramentas/skills + auto-melhoria (a Vera é "como o Claude Code") — Mateus 2026-06-18

> **Visão do Mateus:** *"ela tecnicamente vai ser como você — pode até se arrumar. Podemos
> fazer packs de ferramentas e skills e tudo o que precisa para quando migrar para a VPS
> dela."* Ou seja: a Vera não é um chatbot fixo — é um **agente extensível**, como o
> setup Claude Code/Hermes da CMTec, **e o que ela sabe fazer viaja com ela**.

### Packs de ferramentas/skills (deployáveis, versionados)
As capacidades da Vera estão organizadas em **packs** — não soltas no código:
- **Recrutamento** (briefing, comparar, parecer, calibração) · **Documentos** (planilhas,
  CVs, PDFs) · **Comunicação** (email, mensagens) · **Agenda** (Google Calendar) ·
  **Sourcing** (Apify) · **Pesquisa** (Exa/Brave).
- Cada pack = um conjunto de **skills/ferramentas** com o seu descritor (`AGENTE-TOOLS-E-WS`).
  **Adicionar capacidade = adicionar uma skill ao pack**, não reescrever o agente.
- **Os packs viajam no bundle de migração** (`INFRA-E-MIGRACAO`) → "tudo o que ela precisa"
  vai junto quando o produto vai para a VPS do comprador. Nada fica preso connosco.

### Auto-melhoria ("pode se arrumar") — com guardrails
Como o **self-improve** do Hermes (logging de melhorias): a Vera **aprende e afina-se** —
das correções da Filipa, dos vereditos do cliente e dos outcomes de colocação, **propõe
ajustes** às suas próprias prompts/skills (ex.: "o teu cliente X pesa fit cultural → vou
sondar isso mais"). **NÃO é autonomia selvagem:**
- Tudo **auditado** (`assistant_action`) e **inspecionável** pela Filipa.
- **Sem auto-deploy não-supervisionado** — mudanças à sua própria configuração ficam como
  **proposta** até alguém (Filipa/CMTec) aprovar; ações de efeito passam pela porta de
  confirmação (§2.1).
- O kill switch (§2.1) está sempre presente.
> É "como eu" no sentido de **agente com skills + memória que aprende + se afina** — mas
> com a humana no controlo, não um agente solto.
