# Resiliência & falhas ao vivo — o que acontece quando a infra parte a meio de 2h

> **Porquê este doc (gap simulação "falha de infra", 2026-06-18):** a entrevista ao vivo
> é o caminho mais longo (até 2h) e o mais frágil — Soniox, LiveKit, rede, o LLM do tick
> e o custo podem partir a qualquer momento. A spec dizia "reconecta/degrada" **sem o
> como**. Este doc fixa a **política concreta** (constantes, retries, fallback, tetos) e
> a **regra-mãe**: *nunca perder a entrevista, nunca trancar a Filipa, nunca fingir.*
>
> Liga-se a: `ARQUITETURA-TEMPO-REAL.md` (§3 disciplina de tokens, §9 o fosso),
> `MODELO-DADOS.md` (§14 `interview_gap` + custo no `interview_tick`), `MODELOS-E-API.md`
> (slots + fallback), `REUSE-MAP.md` (§3 — os circuit-breakers reaproveitados),
> `APP-DESKTOP.md` (§2.3 heartbeat de captura, §8 resgate de estado).

---

## 0. A regra-mãe (degradação graciosa, nunca queda)

A Camada A (transcrição crua — `transcript_chunk`) é a **fonte de verdade** e é **barata**.
Tudo o resto (frame, sugestões, parecer) reconstrói-se a partir dela. Logo, a ordem de
sacrifício sob falha é sempre:

```
1º sacrifica  →  sugestões ao vivo (o "luxo")
2º sacrifica  →  atualização do frame/estado (o "cérebro")
NUNCA sacrifica → a transcrição (Camada A) enquanto entrar áudio
ÚNICO corte total → kill-switch EXPLÍCITO da Filipa
```

> Corolário: **nenhuma falha de Soniox, LLM, rede ou custo encerra a sessão.** Degrada-se
> de "copiloto completo" → "só transcrição" → (no limite) "gravação local + gap marcado".
> A Filipa vê **sempre** o estado real no HUD (`APP-DESKTOP §2.3` — `capturing|degraded|lost`).

---

## 1. Soniox (STT) cai ou degrada — reconexão concreta

**Deteção (heartbeat de stream, não de silêncio):** o `apps/realtime` regista a hora do
**último evento** Soniox (parcial *ou* final). Se entra áudio mas não chega evento há
**`STT_STALE_MS` = 6000ms** → o stream é declarado **morto** (distinto do "ainda aí?" de
silêncio de 8s, que é ausência de *fala*, `ARQUITETURA-TEMPO-REAL §3`).

**Reconexão (backoff com jitter, sem encerrar):**
- Backoff: `0.5s → 1s → 2s → 4s → 8s` (teto), com jitter ±20%.
- `STT_MAX_RETRIES` = **ilimitado durante a entrevista** — a falha de STT **nunca**
  encerra a sessão (ver §6: isto corrige o breaker reaproveitado). Cada nova ligação é um
  **novo `source_stream_id`** (já no schema, `MODELO-DADOS §10`).
- O **frame/estado sobrevive** (é persistido pelo escritor único; não vive na ligação STT).
- O áudio falado **durante** a janela de reconexão **perde-se** → vira um
  **`interview_gap`** (cause=`stt_reconnect`), com `start_ms`/`end_ms` (§4). É a única
  forma honesta: o que não se ouviu, não se inventa.

**Limite de sessão de 2h do Soniox (fecha B7):** não esperar pelo corte. **Reabertura
proativa com overlap** — antes de `STT_PROACTIVE_REOPEN_MS` (margem segura abaixo do
limite real do Soniox; **confirmar o número exato na doc do Soniox antes da Fase 3**),
abre-se um **stream B**, redireciona-se o `push_frame` para B e só então se fecha A. Como
há sobreposição, **gap = 0**. (Se o limite real do Soniox não for confirmado a tempo,
assume-se conservador 30 min e mede-se na simulação de 2h.)

**Degradação parcial (não caiu, mas piora):** `stt_confidence` baixo sustentado
(`MODELO-DADOS §10`) → o frame **não destila prova** desses trechos (`ARQUITETURA-TEMPO-REAL
§9` — "não destilar de trecho incerto") e o HUD mostra "áudio fraco". A transcrição
continua a gravar (marcada como incerta), nunca se descarta.

---

## 2. LiveKit / rede cai — a call ou a net da Filipa

**Bot sai da call (LiveKit):** o `apps/realtime` tenta re-join à room (mesmo backoff do
§1). Enquanto fora, marca `interview_gap` (cause=`network`). Ao re-entrar, retoma o push
para o STT; o estado continua de onde estava (escritor único, persistido).

**A Filipa perde a net (o WS de estado morre):** já coberto — o overlay reconecta e faz
**replay por `seq`/`last_seq`** a partir de `interview_tick`, e re-autentica com
`state.snapshot` (`AGENTE-TOOLS-E-WS §B.6`, `ARQUITETURA-INTEGRACAO §8`). **Nada se
perde** do lado do estado, porque a captura (bot na call) corre na VPS, não no PC dela —
se só a net **dela** cai, o bot continua a ouvir e a gravar. Ela volta e vê tudo.

> Distinção que importa: **captura (VPS) ≠ visualização (PC da Filipa)**. A net dela cair
> afeta o que ela **vê**, não o que é **capturado** (no caminho bot-online). Só no caminho
> de captura local (mic do PC) é que a net/PC dela afeta a própria captura → §5.

---

## 3. O LLM do tick falha (OpenRouter 429 / 5xx / timeout / modelo indisponível)

Este era um buraco: **não havia comportamento definido** para o slot `LIVE` falhar a meio.

**Timeout por tick:** `TICK_TIMEOUT_MS` = **4000ms** (o tick é latência-crítica; resposta
tardia não serve para ajudar ao vivo).

**Escada de degradação (por ordem):**
1. **Falha pontual** (429/5xx/timeout num tick): o tick é **saltado**. A Camada A continua
   a gravar; o estado **não** atualiza nesse tick; o HUD mostra discretamente "a recuperar".
   **Nunca** bloqueia, **nunca** inventa uma sugestão.
2. **`TICK_FAIL_FALLBACK` = 3 falhas seguidas:** cai para o **modelo secundário do mesmo
   slot** (lista ordenada no slot `LIVE` — ver `MODELOS-E-API §5`), ex. `Sonnet → Haiku`,
   e **avisa a Filipa**: *"a correr em modo reduzido"*. (Isto é fallback de **modelo**;
   o fallback de **provider** do próprio OpenRouter já actua por baixo e é transparente.)
3. **`TICK_DEGRADE_MS` = 60s** sem nenhum tick a fechar (nem primário nem secundário):
   degrada para **"só transcrição"** — sugestões pausadas, banner claro, Camada A intacta.
   Quando o slot recupera, **re-sobe** sozinho (e pode fazer um tick de *catch-up* sobre a
   janela perdida, marcando que foi retroativo).

> A entrevista **nunca** cai por causa do LLM. No pior caso vira um gravador honesto com
> transcrição perfeita — e o parecer constrói-se à mesma no fim, a partir da Camada A.

---

## 4. Custo dispara — teto e alerta POR ENTREVISTA

Faltava um teto no **caminho ao vivo** (o `LINCE_DAILY_BUDGET_USD` herdado "não é imposto
no código" — `REUSE-MAP §2`; e era diário/global, não por entrevista).

**Como se mede:** custo de uma entrevista = `Σ interview_tick.cost_usd` (novo campo, §14
do `MODELO-DADOS`) **+** estimativa de STT-horas. É a **fonte do dashboard** F1/F2
(`REVISAO-360`) — que antes não tinha destino no schema.

**Tetos (configuráveis por deployment — `realtime-config`):**
- **Alerta a 70% e 90%** de `INTERVIEW_COST_CAP_USD`: avisa a Filipa (não muda nada).
- **Cap *soft* (90%):** **degrada a cadência** — tick menos frequente, ticks banais forçados
  ao `EXTRACTOR` (Haiku), janela recente mais curta. Corta custo sem cortar a transcrição.
- **Cap *hard* (100%):** **pausa as sugestões** e mantém **só a transcrição** (é barata e é
  a fonte de verdade) + banner *"limite de custo atingido — a transcrever apenas"*. A
  Filipa pode **levantar o teto** num clique se quiser continuar com copiloto.
- **Anti-loop de retries:** os retries do §1/§3 contam para o custo e têm o seu próprio teto
  (backoff + cap de tentativas por janela) — um storm de 5xx não pode multiplicar a fatura.

> Nunca se corta a **transcrição** por custo (cortá-la = perder a entrevista, o oposto do
> objetivo). Corta-se o "luxo" (sugestões), nunca a fonte.

---

## 5. App desktop crasha / PC adormece (captura local)

Vale sobretudo no caminho **captura local (mic do PC)**; no caminho **bot-online** a
captura vive na VPS e sobrevive ao PC dela (§2).

- **Heartbeat de captura** (`APP-DESKTOP §2.3`, ~5s): se o `apps/realtime` **deixa de
  receber áudio** do desktop (PC dormiu, app crashou) → (a) marca `interview_gap`
  (cause=`pc_sleep`/`app_crash`); (b) **fecha o stream Soniox órfão** (senão fica a "ouvir"
  silêncio e a gastar STT-horas à toa — liga ao teto de custo do §4).
- **Áudio local em buffer** no instante do crash que ainda não subiu: **perde-se** e entra
  no gap (honesto, não se reconstrói).
- **Ao reabrir o desktop:** `state.snapshot` **retoma o juízo** (já coberto, `APP-DESKTOP
  §8`); o gap fica registado; a Filipa vê *"captura interrompida 22:10–24:30"*.
- `RECONNECT_AUDIO_MS` (o "~Ns" que estava por fixar em `APP-DESKTOP §2.3`) = **3000ms** de
  tolerância antes de declarar a captura local perdida e marcar gap.

---

## 6. Correção crítica: os circuit-breakers reaproveitados são de um BOT DE VOZ

`REUSE-MAP §3` mandava reusar, do orquestrador legado da **Inês** (agente **conversacional
de turnos**): `STT_FAILURE_THRESHOLD=2`, `MAX_TURNS_PER_SESSION=200`,
`MAX_TOOL_ITERATIONS_PER_TURN=6`. Aplicados **tal-qual** a uma **transcrição passiva de
2h**, introduzem uma falha em vez de a resolver:

| Breaker legado (voz) | O que faria na Vera | Redefinição (modo passivo) |
|---|---|---|
| `STT_FAILURE_THRESHOLD=2` | **encerra a sessão** ao 2.º soluço transitório de Soniox | **NÃO encerra** — reconecta (§1) + marca `interview_gap`, sem limite durante a entrevista |
| `MAX_TURNS_PER_SESSION=200` | corta uma sessão "longa" de turnos | **não se aplica** (não há turnos do bot; é passivo) → **remover** |
| `MAX_TOOL_ITERATIONS_PER_TURN=6` | limita o tool-loop por turno | **só vale para o AGENTE** (assistente, que faz tool-loop), **não** para o copiloto ao vivo (que não faz tool-loop por tick) |

> Regra: o **copiloto ao vivo** só tem **um** "corte total" — o **kill-switch explícito**
> da Filipa (parar a entrevista). Tudo o resto é degradação graciosa (§0). Os breakers de
> turno/tool-loop migram para o **runtime do agente** (`services/agent`), onde fazem sentido.
> **Ação Fase 3:** ao vendorizar o tempo-real, **não** copiar estes três valores para o
> copiloto; reimplementar a política deste doc.

---

## 7. O parecer é honesto sobre o que se perdeu

A promessa "`ARQUITETURA-TEMPO-REAL §9`: *entre 22:10 e 24:30 não houve captura*" agora tem
**suporte no schema**: a tabela `interview_gap` (§14 do `MODELO-DADOS`). Ao gerar o parecer:

- Cada `interview_gap` vira uma linha **"⬜ não-capturado HH:MM–HH:MM (causa)"** na secção
  de fiabilidade do parecer (`RELATORIO-CLIENTE §3`).
- Um `client_criteria` que só seria coberto **dentro** de um gap fica `não-confirmado` (não
  se finge que foi coberto) — é a **Regra 3 anti-achismo** aplicada à falha de infra.
- O parecer distingue **"não perguntado"** de **"perguntado mas não-capturado"** (o gap
  prova a diferença) — defensável, sem caixa-preta.

> Sem a `interview_gap`, a ausência de transcrição era indistinguível de silêncio/rapport,
> e o parecer ou inventava continuidade ou calava o buraco. Agora **mostra-o**.

---

## 8. Constantes (resumo — `realtime-config`, calibrar na simulação de 2h)

| Constante | Default | Onde actua |
|---|---|---|
| `STT_STALE_MS` | 6000 | stream Soniox declarado morto |
| `STT_BACKOFF` | 0.5→1→2→4→8s (±20% jitter) | reconexão STT |
| `STT_MAX_RETRIES` | ∞ na entrevista | nunca encerra por STT |
| `STT_PROACTIVE_REOPEN_MS` | < limite real Soniox (confirmar; assumir 30min) | reabertura com overlap (B7) |
| `TICK_TIMEOUT_MS` | 4000 | timeout do tick LIVE |
| `TICK_FAIL_FALLBACK` | 3 | nº de falhas → modelo secundário |
| `TICK_DEGRADE_MS` | 60000 | → "só transcrição" |
| `INTERVIEW_COST_CAP_USD` | configurável/deployment | teto por entrevista (alerta 70/90%, soft 90%, hard 100%) |
| `RECONNECT_AUDIO_MS` | 3000 | tolerância de captura local antes de marcar gap |

> ⚠️ **Portas que continuam [ABERTAS] até à Fase 3 (no caminho crítico):** **B6** "provar
> custo constante em 2h" e **B7** "limite real de stream do Soniox". Ambos se fecham na
> **mesma simulação de 2h** que calibra estas constantes — correr **cedo** no carril
> tempo-real (define teto de custo, gap-threshold e o pivô de reabertura de uma só vez).
