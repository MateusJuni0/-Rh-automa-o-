# Assistente proativo — o bot também é secretário (decisão 2026-06-17)

> Até aqui o bot era **reativo**: respondia, sugeria durante a call, gerava o parecer.
> Esta capacidade torna-o **proativo** — ele antecipa-se, lembra, e puxa pela Filipa
> quando falta algo. É o "secretário" ao lado da "copiloto de entrevista".

Esta capacidade é **além do RAG** (que responde quando perguntado). Aqui o bot **inicia**.

---

## 1. Consciência da AGENDA

- O bot conhece as **reuniões/entrevistas marcadas** e, **antes de cada uma**, manda à
  Filipa um **resumo de preparação**: quem é o **candidato** (perfil, gaps do CV), qual
  a **vaga/cliente**, o **briefing** (roteiro 3 lentes) e o que **falta confirmar**.
- Objetivo: a Filipa chega a cada call já preparada, sem ter de ir buscar nada.
- Também avisa de **conflitos / buracos** na agenda se detetar (duas calls coladas, por
  ex.) — mas o núcleo é o **resumo de preparação atempado**.

### Integração de calendário — `[A CONFIRMAR NA CONSTRUÇÃO]`
Duas vias possíveis (decidir na implementação):
- **Google Calendar** (OAuth) — lê os eventos da Filipa automaticamente.
- **Input manual** — a Filipa diz ao bot ("tenho entrevista com o João amanhã às 15h")
  ou marca na web app (Tela de agenda).

> v1 pode arrancar com **input manual** (zero dependências) e ligar o Google Calendar
> como melhoria. Marca de tipo: ver `MODELO-DADOS.md` (`agenda_event`).

---

## 2. Deteção de LACUNAS no mandato

Quando a Filipa recebe/cria um mandato (vaga) e **falta detalhe**, o bot **não fica
calado** — ele:
1. **Deteta o que falta** comparando o que o cliente deu com o que é preciso para
   construir um bom Role Profile + rubric (ex.: nível não claro, stack vaga, sem
   indicação de salário, sem critério de senioridade).
2. **Puxa pela Filipa** ou **prepara a pergunta para o cliente** — gera o texto pronto a
   reenviar (*"falta saber: é pleno ou sénior? remoto ou híbrido? há budget definido?"*).
3. **Gera material a pesquisar** quando o gap é de conhecimento (ex.: stack nova que o
   bot não domina → dispara web search do Role Profile, ver `CAMADA-CONHECIMENTO.md`).

> É o mesmo princípio do **anti-achismo**: em vez de adivinhar o que o cliente quis, o
> bot **nomeia a lacuna** e ajuda a fechá-la, com confirmação humana antes de gravar
> (input tipado, ver `INTAKE-E-JULGAMENTO.md`).

---

## 3. Onde isto encaixa nos outros docs
- **Memória/conhecimento:** as lacunas detetadas alimentam-se de `client_criteria` e do
  Role Profile (`CAMADA-CONHECIMENTO.md`).
- **Intake:** as perguntas geradas para o cliente passam pelo fluxo tipado + confirmação
  (`INTAKE-E-JULGAMENTO.md`).
- **UI:** o resumo de preparação e os alertas de lacuna aparecem na **web app** (agenda /
  dashboard), não no overlay desktop (que é só o "durante"). Ver `UI-DESIGN.md`.
- **Modelo de dados:** `agenda_event` (+ origem: google/manual) e os pedidos de lacuna
  como `intake`/notificações. Ver `MODELO-DADOS.md`.

---

## 4. Perguntas em aberto
- **Calendário:** Google Calendar OAuth na v1 ou só input manual primeiro? `[ABERTO]`
- **Canal dos lembretes:** push na web app, email, ou Telegram (já temos o bot)? Provável:
  reusar o **Telegram bot** para os lembretes proativos (a Filipa já o usa). `[ABERTO]`
- **Antecedência** do resumo de preparação (1h antes? na véspera? configurável?). `[ABERTO]`
