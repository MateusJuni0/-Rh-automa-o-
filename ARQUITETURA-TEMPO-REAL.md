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
O bot precisa de ouvir a reunião. Esta é a **decisão em aberto** (ver §5). Seja qual
for o caminho, o resultado é um **stream de áudio** a entrar no sistema.

### Andar 2 — Transcrição + diarização ao vivo
Stream de áudio → **STT em streaming com diarização** (separa Falante A / Falante B…)
em PT-BR. Saída: frases parciais e finais, **rotuladas por falante**, com timestamp.

> **Reuso CMTec:** já temos isto em produção no `cmtec-voice-platform`
> (**Soniox** para STT streaming + diarização, **LiveKit** para o transporte de áudio).
> Não construímos do zero — adaptamos.

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
`resumo_corrente` (rolling summary) e descartamos o texto cru — assim o custo por
tick é **constante**, não cresce com a duração.

> **Memória persistente por candidato (RAG):** o que é destilado não é só um buffer
> da sessão — é gravado como **memória do candidato**, partida em factos com
> timestamp/falante e indexada por competência/requisito (ver `VISAO-FILIPA.md`).
> Alimenta o relatório com evidência e fica reutilizável em vagas futuras.

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

## 6. Consentimento — tratado, não é bloqueador
Decisão do Mateus: **não travamos o produto nisto.** O aceite vem no onboarding —
termo no contrato com a empresa-cliente + aviso/aceite do candidato no início da call.
O indicador 🔴 de gravação na UI (já previsto no `UI-DESIGN.md`) serve as duas coisas:
cumpre o aviso **e** transmite confiança. Seguimos em frente.

---

## 7. Resumo
O coração é o **andar 3** (estado vivo + janela recente + rolling summary): é o que
permite analisar uma entrevista de 2h em tempo real a custo constante. A captura
(andar 1) é a próxima decisão; transcrição (andar 2) e UI (andar 4) reusam peças que
a CMTec já tem.
