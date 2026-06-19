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

### Integração de calendário — **Google Calendar (DECIDIDO 2026-06-17)**
- **Google Calendar (OAuth)** é o caminho — lê os eventos da Filipa automaticamente. O
  Mateus confirmou ("liga sim").
- **Input manual** fica só como **fallback** (a Filipa diz ao bot "tenho entrevista com
  o João amanhã às 15h" ou marca na web app) — para quando um evento não está no Google
  ou a ligação falha.

> Marca de origem em `agenda_event.source` (`google_calendar` por defeito; `manual` =
> fallback). Ver `MODELO-DADOS.md` (`agenda_event`).

---

## 1-bis. Motor proativo (worker + guarda de frescura)

A entidade que materializa cada lembrete/ação agendada é a tabela **`proactive_task`**
(`MODELO-DADOS §16`) — **distinta** de `agenda_event` (que é uma reunião de calendário).
Ex.: o follow-up de garantia a **80 dias** é um `proactive_task`
(`kind='guarantee_followup'`), **não** um `agenda_event`. Os 4 `kind` previstos:
`guarantee_followup` · `comparison_suggest` · `prep_summary` · `noshow_reschedule`.

### Worker/cron determinístico
- Seleciona `status='pending' AND due_at < now` (índice `(status, due_at)`).
- Para **cada** tarefa, executa um **GUARD DE FRESCURA OBRIGATÓRIO**: **re-ler a
  entidade-alvo no momento do disparo** (`target_type`/`target_id`) **ANTES de agir**.
  Se a entidade estiver obsoleta, a tarefa **NÃO dispara**.

### Regras do guard (todas obrigatórias)
- **(a) Candidato apagado/anonimizado** — se `candidate.anonymized_at IS NOT NULL` ou
  `deleted_at` (alvo direto, ou candidato do `process`/`interview` alvo) → `status='cancelled'`
  / suprimir. **Nunca** fazer push a um candidato apagado (RGPD; ver `DATA-RETENTION`).
- **(b) Recrutadora em entrevista `live`** — se a recrutadora tem uma `interview` em curso
  → `status='suppressed'` + **re-enfileirar** para o fim da call (novo `due_at`). Pushes
  autónomos **não interrompem** a entrevista. Isto é distinto da cadência do copiloto
  *durante* a call (`ARQUITETURA-TEMPO-REAL §13`) — aqui falamos de ações do secretário.
- **(c) Estado do processo mudou** — para `noshow_reschedule` e `comparison_suggest`,
  re-ler `process.stage`; se ∈ {`rejected`, `withdrawn`, `placed`} → **cancelar**.
  Adicionalmente, `comparison_suggest` só dispara se re-confirmar **≥2 `process`** em
  `submitted`/`client_iv` **NO MOMENTO** do disparo (a sugestão de comparação perde
  sentido se já só resta um candidato vivo).

### Auditoria
Toda transição de estado de `proactive_task` (`fired`/`cancelled`/`suppressed`, com
`fired_at`) regista em **`assistant_action`** — rasto auditável de o-que-disparou-quando
e do-que-foi-suprimido-porquê.

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
- **Calendário:** ✅ **DECIDIDO — Google Calendar (OAuth)**; manual é fallback.
- **Canal dos lembretes:** push na web app, email, ou Telegram (já temos o bot)? Provável:
  reusar o **Telegram bot** para os lembretes proativos (a Filipa já o usa). `[ABERTO]`
- **Antecedência** do resumo de preparação (1h antes? na véspera? configurável?). `[ABERTO]`
