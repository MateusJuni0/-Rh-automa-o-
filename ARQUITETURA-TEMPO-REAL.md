# Arquitetura de tempo real — o copiloto ao vivo é o MVP

> **Decisão do Mateus (2026-06-16):** o produto nasce com o copiloto **ao vivo**.
> O bot fica ativo durante a reunião, **transcreve sozinho em tempo real**, **separa
> quem está a falar** (diarização) e **analisa a entrevista enquanto ela acontece** —
> mesmo que dure 2h. Não começamos por uma versão assíncrona; o tempo real é o coração.

Este documento é o "como" dessa visão. Substitui o faseamento async→live que estava
em `DECISOES-E-MVP.md §2–§3` (mantido lá só como registo do caminho que **não**
seguimos).

---

## 1. O fluxo, de ponta a ponta

```
              ┌─────────────── ANTES (assíncrono) ───────────────┐
Vaga (colar→estruturar) → Triagem de CVs → Briefing (roteiro pronto)
              └───────────────────────────────────────────────────┘
                                   │  o roteiro alimenta o copiloto
                                   ▼
         ┌─────────────── DURANTE (tempo real) ────────────────┐
         │  🎙 áudio da reunião                                  │
         │     → STT streaming + diarização (quem fala)         │
         │     → estado vivo da entrevista (coberto/pendente)   │
         │     → Claude sugere a próxima pergunta               │
         │     → WebSocket empurra para a UI do copiloto        │
         └──────────────────────────────────────────────────────┘
                                   │  ao encerrar
                                   ▼
                 DEPOIS — Relatório (resumo + score + rascunhos)
```

O "antes" e o "depois" continuam assíncronos (request→response). O **"durante"** é
a peça nova e a que define a engenharia.

---

## 2. O pipeline de tempo real (4 andares)

### Andar 1 — Captura de áudio
Dois caminhos (decididos — ver §5), ambos resultando num **stream de áudio** a entrar:
- **Online:** o **bot entra na call** (LiveKit headless) como participante → recebe o
  áudio e, da plataforma, o **falante ativo** (ver Andar 2).
- **Presencial / misturado:** o **app desktop** (`apps/desktop`, Electron/Tauri) capta
  o áudio local (microfone + sistema). É o mesmo app que mostra o overlay — captura e
  HUD na mesma peça (`UI-DESIGN.md` Tela 6).

### Andar 2 — Transcrição + diarização ao vivo
Stream de áudio → **STT em streaming com diarização** (separa Falante A / Falante B…).
Saída: frases parciais e finais, **rotuladas por falante**, com timestamp.

**Multi-idioma (decisão 2026-06-17):** o STT transcreve **PT-PT, PT-BR, inglês e
francês — e misturas** (a Filipa fala inglês; uma entrevista pode alternar idiomas).
A interface e as sugestões saem em **PT** (Regra 4), mesmo quando a fala é noutro
idioma → tradução pelo LLM no tick.

**Como sabemos quem fala (decisão 2026-06-17):**
- **Caminho principal — identidade fiável pela plataforma:** quando o **bot entra na
  call** (Meet/Zoom/Teams), a plataforma diz qual é o **falante ativo** → 1 faixa = 1
  pessoa, identidade certa. **É a razão de pôr o bot na call.**
- **Fallback — diarização por voz** (presencial / áudio misturado): separa por
  características de voz. Para etiquetar a Filipa de forma estável, fazemos
  **enrollment da voz dela 1×** (grava uma amostra → `recruiter.voice_enrollment_path`).
- **Suporta 3+ vozes:** o **cliente** também pode estar na call. Capturar isso ao vivo
  permite registar **preferências reveladas do cliente** durante a entrevista (*"para
  nós é essencial que saiba lidar com pressão"*) → alimenta a **memória do cliente**.
- **A Filipa corrige "quem falou" num toque:** se a etiqueta sair trocada, reatribui o
  trecho (overlay) e o estado/factos corrigem-se. Marca como `corrigido_pela_filipa`.

> **Reuso CMTec:** já temos isto em produção no `cmtec-voice-platform`
> (**Soniox** para STT streaming + diarização, **LiveKit** para o transporte de áudio).
> Não construímos do zero — adaptamos (confirmar suporte multi-idioma + 3+ falantes).

### Andar 3 — "Estado vivo" da entrevista (o segredo das 2h)
Não dá para reenviar 2 horas de transcrição ao Claude a cada poucos segundos — seria
lento e caríssimo. A solução é manter um **estado estruturado e compacto** que vai
sendo atualizado:

```jsonc
// ⚠️ estados canónicos = os 4 da máquina de estados do §9 (não-tocado | raso | coberto-com-prova | contradito)
{
  "requisitos": {
    "React":        { "status": "coberto-com-prova", "confianca": "alta", "evidencia": "12:03 descreveu reconciliation" },
    "Inglês":       { "status": "não-tocado" },
    "Testes":       { "status": "raso", "nota": "mencionou mas não detalhou" }
  },
  // o que ESTE cliente quereria saber (extraído dos ficheiros do cliente antes da call)
  "interesses_cliente": [
    { "tema": "liderou time?",      "status": "não-tocado" },
    { "tema": "disponível remoto?", "status": "coberto-com-prova", "evidencia": "12:10" }
  ],
  "afirmacoes_candidato": [
    { "t": "11:58", "diz": "5 anos de React", "conflito_cv": "CV diz 3 anos" }
  ],
  "perguntas_feitas": ["..."],
  "red_flags": [],
  "resumo_corrente": "texto curto destilado dos primeiros 40 min"
}
```

A cada "tick" (numa pausa da fala, ou a cada N falas), enviamos ao Claude **só**:
o roteiro + o estado vivo + a **janela recente** de transcrição (não as 2h). O Claude
devolve o estado atualizado + a **próxima sugestão**, classificada por **lente**:
🔧 técnica/vaga · 🟢 **lente do cliente** (o que o cliente da Filipa quereria perguntar)
· 🔍 gap do CV. De tempos a tempos, destilamos a transcrição antiga para dentro do
`resumo_corrente` (rolling summary) e tiramos o texto cru **da janela de trabalho
viva** — assim o custo por tick é **constante**, não cresce com a duração.

> ⚠️ **Correção importante (2026-06-17):** "tirar da janela de trabalho" **não é
> apagar**. O texto cru sai só do *contexto que vai ao LLM no tick* (economia de
> latência/custo) mas é **persistido inteiro** na **Camada A** (transcrição completa,
> diarizada, com timestamp → chunks + embeddings). **Nada é descartado.** Ver §8.
> O `resumo_corrente` é uma *vista comprimida de trabalho*, não a fonte de verdade.

> Técnica de apoio: **prompt caching** (a vaga, o roteiro e o system prompt ficam em
> cache na API da Anthropic) → corta latência e custo nos ticks repetidos.

### Andar 4 — Empurrar para a UI
O estado + a sugestão vão por **WebSocket** para a tela do copiloto
(`UI-DESIGN.md` Tela 6): pergunta em destaque, semáforo de cobertura, alertas de
inconsistência. A regra de ouro do design manda: **uma sugestão de cada vez, calma,
o humano decide.** A IA não "fala" sozinha sem parar — sugere em mudanças de tópico e
pausas, não a cada palavra.

---

## 3. Orçamento de latência (o que torna isto "ao vivo" e não irritante)
- Não sugerimos a cada palavra → sugerimos quando um tópico fecha ou há pausa.
- Alvo: sugestão aparece **1–3 s** depois do momento relevante. Folgado, porque o
  recrutador também está a processar a resposta.
- O STT é parcial/contínuo; a análise do modelo corre em paralelo ao próximo trecho.

### Disciplina de tokens/custo (regra dura — "não chupar token à toa")
Uma entrevista de 2h não pode custar uma fortuna. Regras de construção:
1. **Nunca reenviar as 2h.** Por tick vai só: `system+vaga+rubric` (em **cache**) +
   **estado vivo comprimido** + **janela recente** de transcrição + `resumo_corrente`.
   O custo por tick é **constante**, não cresce com a duração (§2, andar 3).
2. **Prompt caching** do que é fixo (system, vaga, rubric, Role Profile) → os tokens
   caros entram **uma vez**, não a cada tick.
3. **Camada A é guardada, NÃO reenviada.** A transcrição inteira vive em
   `transcript_chunk` (para Q&A/parecer **depois**), mas **não** entra no contexto de
   cada tick. Recupera-se por **RAG sob procura**, não por força bruta.
4. **Modelo certo por tick:** ticks "banais" (só atualizam estado, sem sugestão rica)
   podem ir ao `EXTRACTOR` (Haiku) em vez do `LIVE` (Sonnet) — decisão por tipo de tick
   (`REVISAO-360` B4). Destilação de factos = sempre `EXTRACTOR`.
5. **Sem chamada sem motivo:** se nada mudou de relevante desde o último tick (silêncio,
   rapport), **não se chama o modelo** — fica em silêncio (a escada já manda isto).
6. **Output estruturado curto** (JSON do estado/sugestão), não prosa — menos tokens de
   saída por tick.
7. **Pesquisa ao vivo** destila com `EXTRACTOR` e guarda **o facto**, não o conteúdo
   cru, no contexto do tick (o cru vai para `source_doc`).
> Medir tokens/entrevista num dashboard (`REVISAO-360` F1) e **provar** a constância
> simulando 2h antes de pôr à frente de um cliente (B6).

### Parâmetros de arranque (valores iniciais — validar na simulação 2h, fecha B6)
Para o construtor não ficar à espera de decisão. **São defaults a afinar**, não dogma:
- **Cadência do tick:** dispara em **pausa / mudança de tópico**, ou no máximo a cada
  **~15s** de fala contínua. Nunca por palavra.
- **Janela recente enviada por tick:** últimos **~8–12 turnos** (≈ 60–90s de conversa).
- **Rolling summary (`resumo_corrente`):** teto **~800–1200 tokens**; destila (Haiku) a
  transcrição antiga para dentro dele quando a janela recente passa **~1500 tokens** ou a
  cada **~5 min** — o que vier primeiro. Assim o contexto por tick fica ~constante.
- **Modelo por tick:** `LIVE` (Sonnet) nos ticks que produzem sugestão; `EXTRACTOR`
  (Haiku) nos ticks "banais" (só atualizar estado, sem sugestão) — corta custo.
- **Embeddings da Camada A:** em batch (não 1 a 1 por chunk), assíncrono fora do caminho
  do tick.
- **Pausa que dispara o tick:** silêncio de **~1500ms** após fala (fim de turno) → tick.
- **Máx. sugestões na fila:** **3** (a regra "≤3 a exigir ação"); acima disso, dropa as
  mais antigas/menos prioritárias.
- **Auto-dismiss da sugestão:** ~30s **ou** quando já perguntada/respondida.
- **Limiar de silêncio "ainda aí?":** **~8s** sem fala de ninguém → sinal de presença
  (distinto de áudio caído, que é deteção de stream, não de silêncio).
- **Confiança mínima p/ `coberto-com-prova`:** `stt_confidence ≥ ~0.6` **e** evidência
  concreta; abaixo disso fica `raso` e re-sonda.
> Tudo isto vai para `packages/core/realtime-config.ts` (constantes v1) **na Fase 3** — é
> o primeiro a calibrar na simulação de 2h. Meta de custo: dominado por Soniox/h + ticks `LIVE`.
>
> ⚠️ **Quando a infra parte a meio** (Soniox/LiveKit/rede caem, LLM do tick dá 429/timeout,
> custo dispara): a política concreta de reconexão, fallback de modelo, **teto de custo POR
> entrevista** e registo dos intervalos não-capturados está em **`RESILIENCIA-E-FALHAS.md`**
> (constantes irmãs destas, mesmo `realtime-config`). Regra-mãe: degrada para "só
> transcrição", **nunca** encerra a entrevista; o que não se ouviu vira `interview_gap`
> (`MODELO-DADOS §14`) e o parecer **assinala-o** (não finge silêncio).

---

## 4. Stack de tempo real (deltas sobre `DECISOES-E-MVP.md §4`)

| Componente | Escolha | Estado |
|---|---|---|
| Transporte de áudio | **LiveKit** (WebRTC) | já em uso no `cmtec-voice-platform` |
| STT streaming + diarização | **Soniox** (PT-BR) | já em uso; confirmar limites de sessão longa (2h) |
| Análise ao vivo | **Claude Sonnet 4.6** (`claude-sonnet-4-6`) | latência manda no tempo real |
| Roteiro (antes) / Relatório (depois) | **Claude Opus 4.8** (`claude-opus-4-8`) | qualidade, sem pressão de tempo |
| Push para UI | **WebSocket** (Next.js + servidor de eventos) | a montar |
| App/backend | **Next.js + Supabase** | a confirmar (ver `DECISOES-E-MVP.md §4`) |

---

## 5. ⬜ Decisão em aberto — como o bot capta o áudio

É a próxima grande decisão. Precisa cobrir **online (Meet/Zoom/Teams) e presencial**,
e separar bem os falantes.

| Caminho | Como | Diarização | Cobre presencial? | Atrito |
|---|---|---|---|---|
| **A) Bot entra na call** | um participante "robô" entra na reunião online e recebe o áudio (idealmente uma faixa por participante) | **Excelente** (1 faixa = 1 pessoa) | ❌ só online | recrutador convida o bot |
| **B) Captura local** | app desktop / aba do navegador capta o áudio do sistema + microfone | Média (1 stream misto → diarização por algoritmo) | ✅ sim | instalar/abrir o app |
| **C) Híbrido** | bot nas calls online; captura local no presencial | Melhor dos dois | ✅ sim | mais para construir |

✅ **DECIDIDO (2026-06-16): caminho C (híbrido)** — cobre online **e** presencial.
Ordem de construção dentro do MVP (não muda o destino, só o que sai primeiro):
1. **Online (bot na call)** primeiro — separação de falantes perfeita (faixa por
   pessoa) e é onde está o volume das entrevistas de agência.
2. **Presencial (captura local por microfone)** logo a seguir, no mesmo MVP.

> Nota de construção: o "bot que entra na call" pode ser próprio (LiveKit + headless)
> ou via serviço dedicado de meeting-bots — decido na implementação. No presencial,
> um stream misto → diarização do Soniox separa os falantes.

---

## 6. Consentimento + privacidade das sugestões (decidido 2026-06-17)
- **Consentimento é manual da Filipa, ANTES da reunião** (não in-app). Ela trata do
  aceite do candidato/cliente fora do produto. Não travamos o produto nisto.
- **O bot é VISÍVEL como transcritor** na call (a presença dele *é* o aviso de
  gravação). O indicador 🔴 reforça.
- **As SUGESTÕES e a avaliação são PRIVADAS** — vivem só no overlay desktop da Filipa.
  **O candidato e o cliente nunca as veem.** O que é público é apenas "há um transcritor
  na sala"; o juízo é dela.
- Reutilização de factos do candidato entre clientes é **permitida** — a Filipa é
  responsável por pedir autorização ao candidato e ao cliente (RGPD do lado dela). Ver
  `INTAKE-E-JULGAMENTO.md` §RGPD e `MODELO-DADOS.md`.

---

## 8. As duas camadas de memória (decisão 2026-06-17 — mata os "gatilhos")

> **O que muda:** abandonámos a ideia de filtrar a memória por **palavras-chave /
> gatilhos** ("se ouvir 'React', grava"). Casar palavras perde significado e perde
> tudo o que não tem jargão. A partir de agora há **duas camadas paralelas**, com
> papéis distintos — uma guarda *tudo*, a outra *interpreta tudo*.

```
            ┌──────────────────────────────────────────────────────────┐
  áudio ──► │ CAMADA A — CAPTURA SEM PERDAS (a fonte de verdade)        │
            │   transcrição completa · diarizada · timestamp por turno  │
            │   inclui conversa pessoal/rapport · NADA é descartado     │
            │   → chunks + embeddings (pgvector)                        │
            └───────────────┬──────────────────────────────────────────┘
                            │ alimenta (em paralelo, não em série)
            ┌───────────────▼──────────────────────────────────────────┐
  estado ◄─ │ CAMADA B — COMPREENSÃO SEMÂNTICA (o juízo)                │
  vivo      │   o LLM INTERPRETA o significado a cada turno             │
            │   infere competência/senioridade/ownership SEM jargão     │
            │   mantém o "frame de avaliação" (estado por requisito)    │
            └──────────────────────────────────────────────────────────┘
```

### Camada A — captura sem perdas
- **Tudo** o que é dito entra: respostas técnicas, divagações, conversa pessoal,
  silêncios anotados. Guardado **inteiro**, partido em chunks com `falante` +
  `timestamp` + `interview_id`, com embedding (pgvector). Ver `MODELO-DADOS.md`
  (`transcript_chunk`).
- É o que sustenta **dois** usos posteriores: o **Q&A da Filipa** (*"o João falou de
  testes?"* → trecho exato, mesmo que o bot não tenha "marcado" testes ao vivo) e a
  **construção do conhecimento do cliente/candidato** (factos destilados a partir do
  texto real, não de um resumo já lossy).
- A retenção segue o regime de RGPD do §RGPD em `MODELO-DADOS.md`: factos pessoais
  etiquetados à parte, transcrição crua com janela de retenção.

### Camada B — compreensão semântica
- O LLM **lê o significado**, não casa tokens. *"Refiz a forma como a equipa
  entregava software"* → infere **DevOps / ownership / iniciativa**, mesmo sem a
  palavra "CI/CD". *"Quando o site começou a engasgar, fui ver o que estava a pesar"*
  → infere **consciência de performance**, sem "memoization".
- O produto desta camada é o **estado vivo** (frame de avaliação) — ver §9 — e é
  **rastreável**: cada inferência aponta para o(s) chunk(s) da Camada A que a
  fundamentam (proveniência), para o relatório e o Q&A poderem citar.

> **Por que paralelas e não em série:** se a compreensão (B) falhar, errar uma
> inferência ou o requisito mudar depois, a **fonte (A) continua intacta** e
> reinterpretável. Nunca dependemos de uma destilação feita no calor do momento.

---

## 9. Como a Camada B decide o que dizer ao vivo (o frame de avaliação)

A Camada B mantém um **frame de avaliação**: para cada **requisito** (da vaga + da
lente do cliente + gaps do CV), guarda um **estado** que evolui durante a entrevista.

### Máquina de estados por requisito
```
não-tocado  ──►  raso  ──►  coberto-com-prova
     │            │              ▲
     │            └──────────────┘  (pediu exemplo/números e obteve)
     └──────────────────────────►  contradito   (bate com CV ou outra resposta)
```
- **não-tocado:** ainda não surgiu na conversa.
- **raso:** mencionado, mas sem prova (*"sim, sei React"* e nada mais).
- **coberto-com-prova:** há evidência concreta (exemplo, número, caso real) → cita
  o chunk.
- **contradito:** entra em conflito com o CV ou com algo dito antes → vermelho.

Este estado é o que pinta o semáforo da UI (✅/🟡/⬜/⚠) e o que o relatório usa para
saber o que está provado e o que ficou por confirmar.

**Confiança por requisito (2026-06-17):** além do estado, cada requisito carrega uma
**confiança** (`alta`/`média`/`baixa`) — quão forte é a evidência. Um `coberto-com-prova`
com um caso concreto + número = `alta`; uma única menção de passagem = `baixa`. A
confiança é **dita** (Regra 3 anti-achismo), nunca escondida: o parecer escreve *"forte,
confiança alta"* ou *"aparenta forte, mas confiança baixa — só uma menção"*. Apanha o
candidato que **infla** (H2) sem o acusar. Persiste em `candidate_memory_fact` e no
estado vivo.

**A qualidade do STT entra na confiança (robustez de input):** um trecho que o STT
marcou como **incerto** (ruído, vozes sobrepostas, fala cortada) **não** pode, por si
só, levar um requisito a `coberto-com-prova` — fica `raso`/confiança baixa e o motor
**re-sonda** ("podes repetir isso do…?") em vez de assumir. Nunca se destila um facto
firme de transcrição duvidosa (`REVISAO-360` B2). Os mecanismos de *reconexão* de
áudio/stream (B1/B5) são da **embalagem**; esta regra de **juízo** é do cérebro.

**Caso terminal — perdeu-se mesmo um bloco (a entrevista não se repete):** se houver um
**gap de transcrição acima de um limiar** (queda longa, candidato em túnel), a Camada B
**marca o intervalo como `não-capturado`** (com os timestamps) e o **parecer assinala-o
explicitamente** — *"entre 22:10 e 24:30 não houve captura; o que se passou aqui não
está coberto."*. **Nunca** se infere continuidade por cima de um buraco (é a Regra 3 no
pior sítio: um parecer que *parece* completo mas perdeu 2 min é pior que um buraco
assinalado). A Filipa decide se reconfirma esse ponto com o candidato.

**Progresso de cobertura — "riscar até fechar tudo" (2026-06-17):** o bot tem **todos os
requisitos da vaga na memória** (`rubric` ← `job.requirements` + `client_criteria`) e
trata a entrevista como uma **checklist viva**: cada requisito que passa a
`coberto-com-prova` fica **riscado**; a UI mostra o **progresso** (ex.: *"8/12 cobertos
· faltam: liderança, inglês, Azure, salário"*). A Filipa vê, num relance, **o que já
está garantido e o que falta** — ataca diretamente a dor dela ("esqueço-me sempre de
perguntar alguma coisa").

**Cada requisito é um TÓPICO de aprofundamento (a ideia do Mateus, afinada):** se a vaga
pede 12 coisas, são **12 tópicos** — e cada um **não se fecha com uma pergunta**, fecha-se
com o **aprofundamento reativo** (a escada de prova acima) até haver evidência real
*daquela* coisa que **este cliente** pede. "React?" não é riscado por um "sim" — é
riscado quando o candidato **prova** (caso/número/exemplo). Pensando como a Filipa:

- **Peso manda no esforço:** vai **fundo nos `must`**, leve nos `nice` — não gasta a
  entrevista a esmiuçar um desejável (compensação holística, `INTAKE` Parte F).
- **Conversa lidera, não a lista:** risca os tópicos **conforme o candidato os traz**
  naturalmente; só **puxa** um por cobrir quando há deixa ou o tempo aperta (a escada
  de prioridade já faz isto). Nada de interrogatório por ordem.
- **Pode ficar a meio:** um tópico `raso` fica marcado para **voltar atrás** quando
  surgir abertura — não força tudo de uma vez (respeita ritmo/rapport).
- **Há tópicos que se PROVAM sozinhos:** ex. o **inglês** — se a entrevista decorre em
  inglês, o nível **demonstra-se ao vivo** (a Camada B infere da própria fala) sem uma
  pergunta forçada; o bot risca-o por observação e di-lo no parecer.

**Atribuição FORA DE ORDEM (o ponto do Mateus) — o tópico não é a "pergunta atual":**
a conversa não segue a lista. Se o bot está no tópico 1 e o candidato, a responder,
**toca no tópico 5** (*"…aliás, isso foi quando liderei a equipa de 4 pessoas"*), a
Camada B **reconhece a que requisito aquilo pertence** e **risca o tópico 5**, não o 1 —
em **tempo real**. Como funciona, ligado às duas camadas (§8):
- **Camada A** transcreve e guarda **tudo, na hora** (`transcript_chunk` + embedding),
  independentemente do tópico — nada se perde por ter vindo "fora de sítio".
- **Camada B** roteia o **significado** de cada fala para **o(s) requisito(s) que ela
  realmente responde** (pode tocar mais do que um), atualiza o estado desse(s)
  requisito(s) e o `candidate_memory_fact` correspondente — **não** assume que a
  resposta é do tópico em foco.
- Assim, um candidato que "salta à frente" **adianta** a checklist em vez de a baralhar;
  o bot só **volta a puxar** o que ficou por riscar, na altura certa.

O objetivo do motor é **fechar a lista inteira**; a **rede de segurança** abaixo garante
que nenhum `must` fica por riscar no fim.

### Escada de prioridade — qual sugestão sobe (1 de cada vez)
Quando há pausa/mudança de tópico e o limiar de silêncio permite, a Camada B escolhe
**uma** sugestão, por esta ordem (a primeira que dispara ganha):

1. **Contradição** — algo dito bate com o CV ou com resposta anterior. *(o mais
   valioso: protege a Filipa de recomendar com base em informação falsa.)*
2. **Must-have por cobrir + a deixa é natural agora** — requisito obrigatório ainda
   `não-tocado`/`raso` e o fio da conversa abre para ele sem forçar.
3. **Afirmação rasa num must-have** — está `raso` num obrigatório → pedir
   **exemplo concreto / números** para subir a `coberto-com-prova`.
4. **Preferência REVELADA do cliente não explorada** — algo que *este* cliente
   valoriza (do RAG do cliente) e que ainda não foi tocado.
5. **Candidato a sub-vender algo que o cliente valoriza** — demonstrou algo forte de
   passagem; vale puxar para dar prova (ajuda a Filipa a *vender* o candidato).

Se nada disto dispara → **silêncio** (a UI fica calma: *"no caminho — segue a
conversa"*). Não se inventa pergunta para preencher.

### ⭐ Aprofundamento reativo — O FOSSO (gerar follow-ups DA resposta, ao vivo)

> **Validado a 2026-06-17** (`validacao-caso-01-mateus-securegpt.md`): a *pergunta de
> topo* não é o diferencial — uma recrutadora com ChatGPT já lá chega. **O fosso é a
> profundidade reativa:** o bot ouve o que foi **mesmo dito** e, na hora, decompõe-no
> em **perguntas de prova** específicas. É isto que uma pessoa a ouvir+avaliar+anotar
> não consegue, e que uma lista de perguntas pré-gerada também não faz.
>
> As perguntas seguem a **`FILOSOFIA-DAS-PERGUNTAS.md`**: profundidade (como/porquê/caso
> real/o que correu mal), **nunca checklist de tecnologias** — o tópico prova-se pelo
> raciocínio, e isso a Filipa (não-técnica) consegue conduzir e julgar.

**Mecanismo (corre em cada tick, sobre a janela recente):** para cada **afirmação com
peso** que surge, a Camada B pergunta-se *"o que PROVARIA ou QUEBRARIA isto?"* e gera
2–4 follow-ups concretos, **ancorados nas palavras do candidato** — depois sobe **o
mais afiado** (sempre 1 de cada vez, respeitando o ritmo abaixo).

**Exemplo (real, da entrevista do Mateus):** a recrutadora toca em *"7.559 landing
pages"*. O bot **não** fica pela pergunta genérica — gera, ao vivo:
- *"Quais fizeste à mão e quais foram geradas pela ferramenta?"*
- *"Leste o código antes de publicar, ou aprovaste e seguiste?"*
- *"Que problema concreto tiveste numa delas — e como o resolveste?"*
- *"Dá a última vez que rejeitaste o que a IA gerou e refizeste à mão."*

Cada follow-up nasce do que foi dito **agora**, não de um guião. O briefing pré-call
(`VISAO-FILIPA`/roteiro) **semeia as aberturas**; este motor gera a **profundidade**.

**Ligação à máquina de estados:** uma afirmação `raso` em algo que o cliente valoriza
**não fica `raso`** — o motor encadeia follow-ups até **`coberto-com-prova`** (deu
exemplo/número/caso real) **ou** até se revelar **inflacionado** (não consegue
provar → sinal honesto no parecer, não um vago "tem experiência"). É a alínea 3 da
escada, mas **perseguida em profundidade**, não uma pergunta única.

**Guarda-corpos (herdam o ritmo):** continua **1 sugestão de cada vez**; não vira
interrogatório — só fura quando a afirmação é relevante (must-have ou preferência do
cliente) e há deixa natural; respeita o limiar de silêncio/rapport abaixo.

### ⭐ Pesquisa ao vivo (link / projeto / repo que o candidato dá)

> **Decisão 2026-06-17:** quando o candidato **menciona, mostra ou dá o link** de um
> projeto/repo/site/empresa, o bot **pesquisa na hora** e analisa o que encontra —
> e os follow-ups e o veredito passam a basear-se **no que ele viu de facto**, não só
> no que foi dito. É o que torna a profundidade **personalizada**, não genérica.

**Mecanismo (em SEGUNDO PLANO, não trava a call):**
1. O motor deteta uma referência verificável (URL, nome de repo/produto/empresa).
2. Dispara a pesquisa **em segundo plano**: **web search (Exa principal + Brave
   fallback — a D1, agora usada AO VIVO)** + busca do próprio link, para perceber **pelo
   menos a ESTRUTURA do projeto** (ler o README/árvore de ficheiros/código de um repo
   GitHub, abrir o site e ver como está feito). Não precisa de auditar tudo — basta o
   suficiente para gerar perguntas personalizadas ("vi que usas X para Y — porquê?").
3. Quando o resultado chega (pode atrasar alguns segundos — tudo bem), gera probes
   **ancorados no que viu** e cruza com o que o candidato afirmou.

> 🔒 **SSRF — o URL vem de um TERCEIRO (loop segurança 2026-06-18):** o link é dado pelo
> candidato/cliente → é **conteúdo não-confiável**. O fetch (web search + abrir o link/repo)
> **TEM de passar pelo cliente HTTP guardado** (bloqueia IPs internos: `169.254.169.254`,
> `127.0.0.1:8000` Supabase, `:18794` Lince, etc.) e o conteúdo lido entra como **dados,
> nunca instruções** (não pode originar ações `enviar_fora`). Contrato: `SEGURANCA.md §2/§9`.

**Exemplo (Mateus):** dá o repo do *Lince Brain* → o bot lê, vê o grafo de 11 nós e os
262 testes → pergunta específico: *"vi que separaste X e Y em nós distintos — porquê?"*
e **verifica** a afirmação contra o código real (afirmou 262 testes "ponta a ponta"?
o repo confirma o tipo?).

**Por que importa agora:** enquanto **não temos o contexto da empresa-cliente** (caso
do SecureGPT — temos a vaga, não a empresa), a pesquisa ao vivo é o que **compensa** e
dá personalização real. Quando tivermos o RAG do cliente, soma-se (não substitui).

**Guarda-corpos:** nunca bloquear o fluxo à espera da pesquisa; se falhar, degrada em
silêncio; **marcar incerteza** quando a fonte é fraca (regra anti-achismo "incerteza é
dita"); o que vier da web é **indício**, não veredito — a prova final é o que o
candidato explica. Ver `CAMADA-CONHECIMENTO.md` (web search / Role Profile).

> ⚠️ **A pesquisa ao vivo é um BÓNUS condicional, não o core do fosso (gap simulação
> 2026-06-18):** depende de o candidato ter um **artefacto digital** (repo/portfólio/site).
> Um dev tem; um **enfermeiro, comercial, advogado NÃO têm**. Em nichos não-digitais o
> fosso assenta **100% no aprofundamento verbal** (a escada acima) — que é nicho-agnóstico.
> Não inflar a perceção da pesquisa ao vivo: ela otimiza o caso tech, o aprofundamento
> verbal é que serve todos.

### ⭐ Veredito de resposta ao vivo (boa / fraca, para a Filipa)

> **Decisão 2026-06-17:** quando o candidato **responde** a uma pergunta relevante, o
> bot mostra à Filipa, **quase em tempo real**, se a resposta foi **forte, rasa ou
> bandeira vermelha** — para ela saber na hora se já está provado ou se vale insistir.

**O que é:** é o **surfacing ao vivo** da máquina de estados + rubric (não uma camada
nova de juízo). Assim que a resposta fecha, o bot classifica-a contra o requisito e
emite um sinal curto, em **linguagem simples** (a Filipa não é técnica):
- ✅ **Forte** — *"deu um caso concreto com número → fica provado."*
- 🟡 **Rasa** — *"respondeu por alto, sem prova → vale pedir um exemplo."*
- ⚠️ **Atenção** — *"bate com o que está no CV / com o que disse antes."*

**Regras (anti-achismo, sempre):** o veredito **cita a evidência** (o trecho/segundo),
**separa facto de opinião** e **diz a incerteza** — nunca um "bom/mau" pelado. O juízo
**continua a ser da Filipa**; o bot só lhe dá o sinal e o porquê.

**Tratamento visual (criatividade — detalhar na embalagem):** pode ser um **pulso de
cor** na sugestão respondida, um **semáforo** que muda, ou uma **animação curta** ao
fechar a resposta. *A forma fica para `UI-DESIGN.md` Tela 6;* aqui fixa-se só o
**comportamento** (a Parte 1 / o cérebro). Continua **glanceable** — um relance, não
um painel a piscar.

### Rede de segurança no fim
Antes de a entrevista encerrar (a Filipa sinaliza "a fechar", ou pelo tempo), a
Camada B faz uma **última varredura**: se há **must-have** ainda `não-tocado`/`raso`,
levanta um aviso — *"Antes de terminar: ainda não confirmaste **inglês** nem
**liderança de equipa** (ambos obrigatórios do cliente)."* É o seguro contra o
"esqueci-me de perguntar".

### Limiar de silêncio + ritmo / rapport
- **Não interromper em momento sensível:** se o candidato está a meio de uma resposta
  longa, ou num momento de rapport/emoção (motivação para sair do emprego atual, por
  ex.), a sugestão **espera**. Conversa > checklist.
- **Cadência humana:** alvo de ~1 sugestão por mudança de tópico, não por turno.
- **Cada sugestão traz o PORQUÊ numa frase** (*"o cliente recusou 2 perfis sem
  liderança — vale confirmar"*). A Filipa percebe o motivo num relance e decide.

> A motivação/drivers do candidato e a logística (salário, aviso prévio,
> disponibilidade, risco de contraproposta) também são **alvos de captura ao vivo**
> — entram no frame como requisitos "de colocação", não técnicos, e alimentam o
> relatório e o ângulo de venda. Ver `INTAKE-E-JULGAMENTO.md` Parte E.

---

### Chat ao vivo com o bot (durante a entrevista)
Além de empurrar sugestões, o overlay tem uma **caixa de pergunta**: a Filipa escreve
*"ele já falou de salário?"* e o bot responde do **estado vivo + transcrição corrente**
(Camada A/B) **sem parar a captura**. É o Q&A (Tela 8 / `CAMADA-CONHECIMENTO.md`)
disponível *durante* a call, não só depois.

**O "falta algo?" — pelo popup (decisão Mateus 2026-06-17):** perto do fim, a Filipa
pergunta no overlay *"falta algo?"* e o bot responde **a partir da checklist de
cobertura** (*"faltam 2 must: confirmar **inglês** e **salário**"*) — é a rede de
segurança servida sob pedido, não só automática. Tudo pelo **popup/overlay** (o HUD ao
vivo, estilo Apollo, que vamos criar — o visual fica para `UI-DESIGN.md`); aqui fixa-se
o comportamento.

---

## 10. Resumo

O coração continua a ser o **andar 3** (estado vivo + janela recente + rolling
summary): permite analisar 2h em tempo real a **custo constante**. O que 2026-06-17
acrescenta: **duas camadas** — a **A** guarda *tudo* sem perdas (fonte de verdade +
Q&A + conhecimento); a **B** *interpreta* significado (não palavras-chave) e mantém o
**frame de avaliação** que decide, por uma **escada de prioridade**, a única sugestão
que sobe — com rede de segurança no fim e respeito pelo ritmo da conversa. **O fosso
do produto (validado 2026-06-17) é o §9 "aprofundamento reativo":** gerar perguntas
de prova A PARTIR do que foi dito, ao vivo — não a pergunta de topo (essa qualquer um
gera), mas a profundidade que fura atrás de evidência. Captura (andar 1) está decidida
(caminho C / LiveKit próprio); transcrição (andar 2) e UI (andar 4) reusam peças que a
CMTec já tem.

---

## 12. Arranque a frio + contexto AO VIVO (o mundo real bagunçado) — Mateus 2026-06-18

> Cenário real: a Filipa **já está na reunião e esqueceu de ativar**, ou o candidato/
> cliente apareceu e a Vera **não tem contexto nenhum** (sem vaga/CV/briefing criados). O
> produto **não pode partir** — tem de degradar com graça. Princípio: **capturar primeiro,
> contexto ao vivo, ligar por nome, estruturar depois.**

**1. Capturar primeiro (nunca perder a entrevista).** Assim que ativa — mesmo a meio —
a **Camada A começa a gravar** tudo (transcrição diarizada). O que aconteceu **antes** de
ativar fica marcado `não-capturado` (honesto, §9), mas dali para a frente nada se perde.
A Vera funciona **mesmo sem vaga/rubric** — só não sugere com profundidade até ter contexto.

**2. Contexto AO VIVO (a Filipa alimenta sem sair da call):**
- **Arrastar o CV** do candidato (PDF) para o overlay **em tempo real** → a Vera extrai o
  perfil na hora e começa a ligar o que ouve ao CV.
- **Escrever/ditar contexto:** *"é para a vaga de dev da TechCorp"* / *"o cliente quer
  alguém que já liderou"* → a Vera incorpora no estado vivo e afia as sugestões a partir daí.
- Sem contexto nenhum, a Vera **pergunta o mínimo** (*"para que vaga é? tens o CV?"*) — uma
  vez, sem insistir — e entretanto **só transcreve + estrutura factos** para a Filipa
  completar depois.

**3. Ligar por NOME + dados (resolução de entidade):** a Vera liga sempre o que capta a um
**candidato/cliente por nome + dados** — se já existe no talent pool, **anexa** (re-entrevista,
`ASSISTENTE-CONVERSA §4.1`); se não, **cria** com o que tiver e completa depois. Se um dia
ficar "perdida", a âncora é o **nome + dados** (não um id que ela não digitou). Desambigua
sempre (`INTAKE`): *"é o João Silva que já entrevistaste, ou um novo?"*.

**4. Estruturar DEPOIS:** no fim, a Vera apresenta o que capturou + o que falta
(*"gravei a entrevista; faltou dizer-me a vaga e o salário — queres ligar a uma vaga e
preencher?"*) → a Filipa fecha em 2 cliques, e o parecer/memória ficam completos
retroativamente. A entrevista crua **nunca se perde** por falta de setup prévio.

> UX (overlay): um estado **"sem contexto — a só transcrever"** (calmo, distinto do "a
> ouvir" com vaga) + zona de **arrastar CV** + campo de **contexto rápido**. Ver `UI-DESIGN`.

## 11. Concorrência — o copiloto ao vivo E o agente ao mesmo tempo (spec, 2026-06-17)

Durante a entrevista correm **duas coisas ao mesmo tempo**: o **copiloto ao vivo**
(STT→frame→sugestões) e o **agente pessoal** (ela pode escrever no overlay, perguntar
"falta algo?", ou pedir algo). Têm de coexistir **sem se atrapalharem**.

**Princípio: processos separados, prioridades separadas.**

| | Copiloto ao vivo (`apps/realtime`) | Agente pessoal (serviço próprio) |
|---|---|---|
| Natureza | latência-crítica (tick a cada pausa) | pedido a pedido (chat/tarefas) |
| Prioridade | **máxima** — nunca pode esperar pelo agente | corre no seu processo, sem bloquear o vivo |
| Escreve estado da entrevista? | **SIM — escritor único** (frame, ticks, transcript) | **NÃO** — só **lê** durante a call |

**Regras:**
1. **Escritor único do estado vivo:** só o `apps/realtime` escreve `interview_tick` /
   `transcript_chunk` / checklist. Elimina corridas — o agente nunca corrompe o frame.
2. **Q&A ao vivo ("falta algo?", "ele falou de salário?")** é servido **pelo motor ao
   vivo** (tem o estado quente em memória → resposta rápida, slot `LIVE`). Não passa
   pelo agente pesado.
3. **Tarefas do agente durante a call** (gerar um documento, marcar a próxima, sourcing)
   correm **no serviço do agente, assíncronas** — **não competem** com o caminho
   latência-crítico do tick. Resultado chega quando estiver pronto.
4. **Isolamento de falha:** se o agente cai, o copiloto continua a entrevista; se o
   copiloto cai, o agente continua a responder. Não há processo que derrube o outro.
5. **Comunicam pela DB** (o estado vivo é a fronteira): o agente lê o que o copiloto
   escreveu; não há partilha de memória de processo nem chamadas síncronas no tick.

> Em resumo: **o vivo tem sempre prioridade**; o agente vive ao lado, lê o estado e faz
> o trabalho pesado em segundo plano. A Filipa sente os dois como **um só** assistente,
> mas por baixo são duas peças que não se pisam.

## 13. Cliente na call + cenário adversarial (gaps simulação 2026-06-18)

**Cliente presente na call (3+ vozes):**
- A diarização rotula o **cliente** como falante próprio (`speaker='client'`, `MODELO §13`)
  — não cai em `'other'`. As **preferências que ele revela ao vivo** ("para nós é essencial
  aguentar pressão") são captadas → `client_memory_fact` (`source='live_reveal'`, pendente
  de confirmação no pós-call) e alimentam o **degrau 4** da escada (preferência revelada).
- **Modo "cliente a conduzir":** quando o cliente toma a palavra/faz as perguntas dele, a
  Vera **baixa a cadência / silencia sugestões** (a Filipa não tem o turno nem consegue
  olhar o overlay) e **credita as perguntas do cliente** no auto-dismiss (uma pergunta
  feita pelo cliente também risca a sugestão).
- **Privacidade no PRESENCIAL com terceiros:** se cliente/candidato estão na mesma sala
  física, o overlay a marcar "⚠ contradito / bandeira vermelha" fica a um relance de ombro.
  Regra: no presencial com terceiros → **modo discreto** (esconde vereditos/red-flags, só
  mostra a próxima pergunta) **ou** exige 2º dispositivo só-Filipa. (`UI-DESIGN`)

**Candidato que mente/infla (sem difamar):**
- **`nao_sustentado`** (`MODELO §13`) ≠ `raso`: afirmou forte e **não provou** sob
  aprofundamento (distinto de "não sabe"). O parecer di-lo com a afirmação inicial + a
  falha + timestamps.
- **Inconsistência interna** (10min vs 40min) é **persistida** em `contradiction` (os dois
  `transcript_chunk`) — citável dos dois lados, mesmo depois de a janela de trabalho
  comprimir. (Antes vivia só num JSONB descartável.)
- **NUNCA acusar:** a Vera assinala factos + prova; **imputar intenção/desonestidade é
  proibido** (5ª regra anti-achismo, `INTAKE Parte C`). A Filipa interpreta; a Vera mostra.
