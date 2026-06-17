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
  **enrollment da voz dela 1×** (grava uma amostra → `recruiter.voice_enrollment`).
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
{
  "requisitos": {
    "React":        { "status": "coberto",   "evidencia": "12:03 candidato descreveu reconciliation" },
    "Inglês":       { "status": "pendente" },
    "Testes":       { "status": "investigar", "nota": "mencionou mas não detalhou" }
  },
  // o que ESTE cliente quereria saber (extraído dos ficheiros do cliente antes da call)
  "interesses_cliente": [
    { "tema": "liderou time?",      "status": "pendente" },
    { "tema": "disponível remoto?", "status": "coberto", "evidencia": "12:10" }
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
- O STT é parcial/contínuo; a análise do Claude corre em paralelo ao próximo trecho.

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

---

## 10. Resumo

O coração continua a ser o **andar 3** (estado vivo + janela recente + rolling
summary): permite analisar 2h em tempo real a **custo constante**. O que 2026-06-17
acrescenta: **duas camadas** — a **A** guarda *tudo* sem perdas (fonte de verdade +
Q&A + conhecimento); a **B** *interpreta* significado (não palavras-chave) e mantém o
**frame de avaliação** que decide, por uma **escada de prioridade**, a única sugestão
que sobe — com rede de segurança no fim e respeito pelo ritmo da conversa. Captura
(andar 1) está decidida (caminho C / LiveKit próprio); transcrição (andar 2) e UI
(andar 4) reusam peças que a CMTec já tem.
