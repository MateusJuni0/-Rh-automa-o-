# App Desktop — o overlay ao vivo + a captura de áudio (`apps/desktop`)

> **O que este doc é:** a spec técnica do **único cliente "durante"** do produto — o
> app de secretária que (a) **mostra o overlay** ao vivo da entrevista e (b) **capta o
> áudio local** e o envia para o `realtime`. É o `apps/desktop` da
> [`ARQUITETURA-INTEGRACAO.md §1`](./ARQUITETURA-INTEGRACAO.md).
>
> **O que este doc NÃO é:** não redefine o overlay (isso é a **Tela 6** de
> [`UI-DESIGN.md`](./UI-DESIGN.md)), nem o pipeline de tempo real
> ([`ARQUITETURA-TEMPO-REAL.md`](./ARQUITETURA-TEMPO-REAL.md)), nem a autenticação
> ([`AUTENTICACAO.md`](./AUTENTICACAO.md)). **Referencia** essas decisões; aqui fica
> só a engenharia do cliente desktop.

> **Decisões LOCKED que este doc assume (não reabre):** app desktop = **Electron**
> (Tauri = alternativa mais leve a avaliar, §9); **cliente fino** (só a sessão cifrada
> em disco, estado na VPS); visual **HUD escuro "Apollo"** (`UI-DESIGN.md` fim);
> captura **híbrida** (bot na call online + captura local presencial — caminho C de
> `ARQUITETURA-TEMPO-REAL §5`); **v1 single-tenant** (só IRIS, sem RLS por agência);
> a Filipa **não opera nada técnico** — o **assistente** orquestra
> (`ASSISTENTE-PESSOAL.md §3`).

---

## 0. Porquê um app desktop (e não uma aba de browser)

| Dor | Porque o browser não resolve | O que o desktop dá |
|---|---|---|
| Overlay tem de ficar **por cima** do Zoom/Meet/Teams | Uma aba de browser não fica *always-on-top* sobre outra app nativa | Janela `alwaysOnTop` real do SO |
| Captar o **áudio do sistema** (a voz do candidato sai pelos altifalantes) | Browser só capta a aba/microfone com fricção e sem loopback fiável | WASAPI loopback (Win) / agregado (macOS) via APIs nativas |
| Estar presente sem roubar a tela | Aba ocupa espaço, perde o foco, fecha sem querer | Janela pequena, sem moldura, arrastável, só aparece quando ativo |
| Continuar noutro PC | — (resolvido pelo cliente fino, não pelo formato) | Login → estado vem da VPS (§4) |

> A captura **e** o HUD vivem **na mesma peça** — é o mesmo processo que ouve e que
> mostra (`ARQUITETURA-TEMPO-REAL §2`, Andar 1).

---

## 1. A janela do overlay (sempre por cima, discreta)

A renderização do conteúdo é a **Tela 6** (`UI-DESIGN.md`); aqui fica o **comportamento
da janela** do SO.

| Propriedade | Valor | Notas |
|---|---|---|
| Tipo | `BrowserWindow` frameless (`frame: false`) | sem barra de título do SO; o "chrome" é desenhado por nós (HUD Apollo) |
| Always-on-top | `setAlwaysOnTop(true, 'screen-saver')` | nível alto para ficar acima de janelas de videochamada em fullscreen |
| Tamanho | ~**360px** de largura, altura **dinâmica** ao conteúdo (min ~120, max ~70% do ecrã) | ver "uma sugestão por vez" — a janela cresce/encolhe com a fila |
| Arrastável | região `-webkit-app-region: drag` no topo do HUD | botões/inputs marcados `no-drag` |
| Transparência | `transparent: true` + cantos arredondados desenhados em CSS | base **não preto-puro** (`#0E1116`), sem blur/glow (Apollo flat) |
| Foco | `focusable: false` por defeito (clicar não rouba foco ao Meet) | exceto quando o input de chat ao vivo está aberto → foca temporariamente |
| Taskbar/Dock | `skipTaskbar: true` | é um overlay, não uma app "normal" na barra |
| Click-through (opcional) | modo "fantasma": `setIgnoreMouseEvents(true, {forward:true})` | a Filipa pode pôr o HUD a deixar passar cliques para o Meet por baixo; toggle no HUD |
| Ecrã | aparece no monitor onde está a call; reposicionável; lembra a última posição por `display.id` | multi-monitor abaixo |

### Multi-monitor
- A posição/monitor da última sessão é **persistida** (preferência local não sensível —
  `display.id` + coords; não é estado de negócio).
- No **presencial**, padrão recomendado: HUD num **2º monitor / tablet** para não tapar
  o candidato (`UI-DESIGN.md` Tela 6). É escolha da Filipa, não imposição.
- Se o monitor lembrado já não existe (desligou-se), cai para o ecrã primário (sem erro).

### Ciclo de vida da janela
- **Só aparece quando ATIVO** a ouvir/transcrever; **fora da entrevista, fecha-se**
  (`UI-DESIGN.md` Tela 6). Entre entrevistas, o app fica como ícone discreto na
  **tray/menu bar** (não uma janela aberta).
- Tray: estado (a ouvir 🔴 / em espera ⚪), "abrir a web app", "terminar entrevista",
  "sair". Mínimo — não é um painel de controlo (esse é a web).

---

## 2. Captura de áudio (o segundo trabalho do app)

> **Objetivo:** entregar um **stream de áudio** ao `apps/realtime` em **online** e
> **presencial** (caminho C, `ARQUITETURA-TEMPO-REAL §5`). Online o **bot na call** é a
> fonte primária (faixa por participante → diarização perfeita); o desktop **complementa**
> e é a fonte **principal no presencial**.

### 2.1 O que se capta
| Fonte | Para quê | Como (Windows) | Como (macOS) |
|---|---|---|---|
| **Microfone** (Filipa) | a voz dela (e, no presencial, a sala) | `getUserMedia({audio})` (WASAPI) | `getUserMedia({audio})` (CoreAudio) |
| **Áudio do sistema** (candidato/cliente, que sai pelos altifalantes) | a outra ponta da call online sem o bot, e backup do bot | **WASAPI loopback** | **loopback** via dispositivo agregado |

**Windows — áudio do sistema:** Electron expõe `setDisplayMediaRequestHandler` + a flag
de captura de loopback (`audio: 'loopback'` no handler de `getDisplayMedia`), que usa
**WASAPI loopback** por baixo — capta o que sai dos altifalantes **sem** software de
terceiros nem cabo virtual. É o caminho preferido.

**macOS — áudio do sistema:** não há loopback de sistema "grátis" como no Windows.
Caminhos, por ordem de preferência:
1. **ScreenCaptureKit** (macOS 13+) — captura de áudio do sistema com permissão de
   "gravação de ecrã"; é o caminho nativo moderno (avaliar bridge nativo/addon).
2. **Dispositivo agregado** (BlackHole/loopback driver) — robusto mas exige instalar um
   driver de áudio → fricção. **Last resort**, e nunca como instalação silenciosa.
3. **Só microfone** — degradação aceitável: no **online**, o **bot na call** já dá a voz
   do candidato com diarização perfeita; o áudio de sistema do desktop é então **backup**,
   não obrigatório. No **presencial macOS**, o microfone da sala capta ambos os lados
   (diarização do Soniox separa por voz, com `voice_enrollment_path` da Filipa).

> **Decisão de robustez (não varrer):** **online não depende do áudio de sistema do
> desktop** — depende do bot na call. O áudio de sistema do desktop é **reforço/fallback**.
> Isto evita ficar refém do loopback do macOS para o caso de uso mais comum (entrevistas
> online de agência).

> 🧊 **ALVO v1 (spec freeze, 2026-06-18) — resposta ao risco do ChatGPT:**
> - **v1 = bot-online PRIMÁRIO** (LiveKit entra na call e capta o áudio + diarização por
>   faixa). O **app desktop v1 = o OVERLAY (display always-on-top)** sobre a call.
> - **Captura de áudio LOCAL (mic+sistema) = FAST-FOLLOW** (presencial) — **NÃO está no
>   caminho crítico da v1**. Logo o risco do áudio de sistema macOS (D1) **sai da v1**.
> - Plataforma do app v1: **Windows + macOS** (Electron); o **spike de captura local**
>   faz-se quando o fast-follow presencial arrancar, não antes da UI do overlay.
> Resultado: o que é arriscado (captura local multiplataforma) fica fora do MVP; o
> overlay + bot-online (o comum) entregam valor primeiro.

### 2.2 Formato e transporte para o `realtime`
- **Codificação:** PCM 16-bit, **16 kHz mono** (suficiente para STT; poupa banda). A
  resampling/mono-mix corre no renderer (Web Audio `AudioWorklet`) **antes** de enviar.
- **Transporte:** o desktop entra na **sala LiveKit da entrevista** como participante
  (publica a(s) faixa(s) de áudio local). Reusa o **mesmo transporte** que o bot
  (`cmtec-voice-platform` / LiveKit, `ARQUITETURA-TEMPO-REAL §4`) — não inventamos um
  segundo canal de áudio. O `realtime` recebe a faixa e alimenta o Soniox.
  - *Alternativa avaliada e rejeitada para v1:* WebSocket de áudio próprio
    (`apps/ws` é de **estado**, não de áudio). LiveKit já resolve jitter/reconexão.
- **Faixas separadas quando possível:** publicar microfone e loopback como **duas faixas**
  (rótulos `mic` / `system`) ajuda a diarização (a faixa `mic` é sempre a Filipa). No
  online, isto + a identidade do bot dá redundância de "quem fala".
- **Token de sala:** vem de `POST /api/interviews` (devolve sala/token LiveKit,
  `ARQUITETURA-INTEGRACAO §2.3`) — o desktop **não** gera credenciais LiveKit; pede-as à
  API autenticado pelo JWT.

### 2.3 Heartbeat, níveis e reconexão de áudio
- **Heartbeat:** o desktop publica um ping leve (estado de captura: `capturing|muted|lost`)
  no canal de estado (`apps/ws`) a cada ~5 s → o backend sabe se o áudio "morreu" mesmo
  sem o WS de estado cair.
- **VU meter discreto** no HUD: a Filipa **vê** que está a captar (um traço de nível). É
  confiança visível — *"está a ouvir-me?"* respondido sem perguntar. Sem persistir áudio.
- **Queda de áudio:** se a faixa cai (microfone desligado, device trocado, loopback
  perdido), LiveKit tenta **reconectar** a faixa; o HUD mostra **"a religar áudio…"**
  (não silêncio enganador). Se não recupera em **`RECONNECT_AUDIO_MS` = 3000ms**, marca um
  **`interview_gap`** (cause=`app_crash`/`pc_sleep`, `MODELO-DADOS §14`), alerta visível e
  oferece "escolher microfone". O **estado vivo na VPS persiste** — quando o áudio volta,
  retoma sem perder a entrevista (`ARQUITETURA-TEMPO-REAL §11`: o escritor do estado é o
  `realtime`). Política completa: `RESILIENCIA-E-FALHAS.md §5`.
- **Stream Soniox órfão (PC dormiu/app crashou):** se o heartbeat de captura (acima) deixa
  de chegar, o `realtime` **fecha o stream Soniox** desse desktop (senão fica a "ouvir"
  silêncio e a gastar STT-horas — liga ao teto de custo, `RESILIENCIA §4`) e abre o gap.
- **Troca de dispositivo a quente:** se a Filipa muda de auscultadores a meio, o app
  deteta (`navigator.mediaDevices.ondevicechange`) e re-liga a faixa ao novo device sem
  reiniciar a entrevista.

### 2.4 O que NUNCA acontece com o áudio (segurança — §10)
- O áudio **não é gravado em disco** no PC. Vai **em stream** para o `realtime`; o que
  persiste é a **transcrição** (Camada A, na VPS — `ARQUITETURA-TEMPO-REAL §8`), não o
  WAV.
- Nenhum buffer de áudio é escrito em ficheiro temporário sem cifra; o que existe é o
  buffer **em memória** do `AudioWorklet`, descartado ao fechar a faixa.

---

## 3. Renderização do overlay (HUD Apollo, Tela 6)

> **A forma é a Tela 6** (`UI-DESIGN.md`) — sugestão grande, porquê numa frase, fila
> discreta, semáforo dos 4 estados, chat ao vivo, auto-dismiss ~30s. Aqui fica **como o
> desktop a alimenta e a comporta**.

- **Fonte de dados:** o renderer **consome o WebSocket** de `apps/ws`
  (`ARQUITETURA-INTEGRACAO §2.4`): `tick.update`, `suggestion.next`,
  `coverage.update`, `alert`. **Não há lógica de IA no desktop** — ele é um cliente fino
  que pinta o que o `realtime`/`ai` decidiram (`ARQUITETURA-INTEGRACAO §1`).
- **Estética:** dark flat "Apollo" (sem gradiente/blur/glow), acento teal `#5DCAA5`,
  texto `#E6E8EB` sobre `#0E1116`, Inter, sentence case. (Direção LOCKED, `UI-DESIGN.md`.)
- **Glanceable primeiro:** uma sugestão em destaque; a fila e o semáforo discretos. A
  janela **cresce/encolhe** com o conteúdo (não há scroll infinito de transcrição).
- **Auto-dismiss:** a sugestão desaparece após ~30s **ou** quando o tick diz que foi
  perguntada/respondida (`coverage.update` risca o requisito). O desktop **não decide**
  isto — segue o estado.
- **Toques únicos:** "Usei" / "Pular" / "★ marcar momento" → enviados de volta como
  eventos leves pelo WS/API (não recalculam nada localmente; informam o motor).
- **Sem som:** o overlay **nunca** toca som/notificação sonora (atrapalha a call —
  anti-padrão da Tela 6).
- **Indicador 🔴 sempre visível** quando a captar (consentimento/gravação — `ARQUITETURA-
  TEMPO-REAL §6`); é UI **e** confiança.

### Chat ao vivo no overlay
- Há um **campo de pergunta** (*"ele já falou de salário?"* / *"falta algo?"*). Ao focar,
  a janela passa a `focusable` temporariamente (input precisa de teclado). Ao enviar, vai
  por API/WS ao **motor ao vivo** (`apps/realtime`, tem o estado quente — `ARQUITETURA-
  TEMPO-REAL §11` regra 2), **sem parar a captura**. A resposta volta pelo WS.
- Concorrência: o chat **não escreve** o estado da entrevista (só o `realtime` escreve —
  `§11` regra 1); o desktop só **lê** e mostra.

---

## 4. Sessão e autenticação no desktop

> Fluxo completo em [`AUTENTICACAO.md §3`](./AUTENTICACAO.md) (adaptador desktop) e
> [`§8`](./AUTENTICACAO.md) (cliente fino + multi-dispositivo). Aqui fica a parte
> **vivida no app**.

### 4.1 Login
1. **Biometria facial (1º):** o renderer abre a câmara (`getUserMedia`) e corre o
   **verify do clone `cmtec-face`** do RH (liveness FSM via WS + SFace 1:1 → veredito
   single-use). A **tela colorida** do flash liveness é desenhada no renderer.
2. **Email + senha (alternativa):** `signInWithPassword` (Supabase) — sem fricção quando a
   biometria falha (luz/câmara).
3. Em ambos, o backend (`/api/auth/face/complete` ou Supabase direto) devolve
   `{access_token, refresh_token}` → **sessão Supabase (JWT)**.

### 4.2 Onde a sessão é guardada
- **Só a sessão** (tokens) é guardada localmente, no **Electron `safeStorage`** (cifrado
  pela keychain/DPAPI do SO). **Nada de negócio** fica em disco (cliente fino,
  `AUTENTICACAO §8`).
- **`device-id`** gerado no 1º arranque e guardado no `safeStorage`; registado em
  `trusted_devices` no primeiro magic-link (substitui o cookie de dispositivo do painel
  web — `AUTENTICACAO §3`). O **email nunca vem do cliente** — vem do device-binding.

### 4.3 Ligação WebSocket (estado vivo)
- O desktop liga ao `apps/ws` e envia o **`access_token` na 1ª mensagem** (não em
  query-string). O WS **verifica o JWT** (assinatura + `exp`) → `recruiter_id`, e
  **verifica posse da entrevista** (`SELECT 1 FROM interview WHERE id=$1 AND
  recruiter_id=$2`) antes de aceitar (`AUTENTICACAO §4`).

### 4.4 Refresh silencioso
- O JWT expira a meio das 2h → o desktop faz **refresh silencioso** (`refresh_token`) e
  **reata o WS** sem a Filipa notar (`AUTENTICACAO §3` passo 7).
- **Re-autenticação periódica (24h):** limita a janela de abuso de um PC perdido
  (`AUTENTICACAO §8`). Se passou o prazo, pede biometria/login no próximo arranque.

### 4.5 Revogar o dispositivo
- A revogação faz-se na **web** (`trusted_devices`, Tela 12 / `AUTENTICACAO §8`): a sessão
  no desktop **morre** (o WS recusa, o refresh falha) e os **dados continuam na VPS**. O
  desktop, ao apanhar 401, **limpa o `safeStorage`** e volta ao ecrã de login.

---

## 5. Permissões do SO (microfone + áudio de sistema)

> Pedir **o mínimo, no momento certo** — não tudo no 1º arranque.

| Permissão | Quando pedir | Windows | macOS |
|---|---|---|---|
| **Microfone** | quando arranca a 1ª captura (não na instalação) | prompt do SO (Privacidade > Microfone) | `Info.plist` `NSMicrophoneUsageDescription` + prompt TCC |
| **Câmara** | no 1º **enroll/verify** biométrico | prompt do SO | `NSCameraUsageDescription` + TCC |
| **Áudio do sistema / gravação de ecrã** | quando a Filipa ativa "captar o áudio da call" (online sem bot, ou reforço) | implícito no handler `getDisplayMedia` loopback (sem TCC dedicado) | **"Gravação de ecrã"** (ScreenCaptureKit) → prompt TCC; explicar **porquê** antes |
| **Acessibilidade/always-on-top** | nenhuma extra esperada (Electron `alwaysOnTop` não precisa) | — | — |

- **Pré-explicação:** antes do prompt do SO, o app mostra **uma frase** do porquê
  (*"para transcrever a entrevista, preciso de ouvir o áudio da chamada"*). Reduz recusas
  e é honesto (não pedir permissão "às escuras").
- **macOS gravação de ecrã** é a permissão mais "pesada" percebida — deixar claro que **só
  o áudio** é usado (não capturamos imagem do ecrã), e que é **opcional** (cai para
  microfone/bot).
- **Permissão recusada:** o app **não falha em silêncio** — mostra o que falta e como
  reativar (link para as Definições do SO), e degrada (online → conta com o bot; sem
  microfone → não há entrevista, di-lo claramente).

---

## 6. Distribuição, code-signing e auto-update

| Item | Windows | macOS |
|---|---|---|
| Instalador | **NSIS** (`.exe`) via electron-builder | **DMG** + (opcional) `.pkg` |
| Code-signing | **Authenticode** (certificado EV recomendado p/ reputação SmartScreen) | **Developer ID Application** |
| Notarização | — | **obrigatória** (`notarytool`) + **stapling**, senão o Gatekeeper bloqueia |
| Arranque | atalho/menu; **não** auto-start no boot (é um overlay sob pedido) | idem |

### Auto-update
- **electron-updater** (electron-builder) contra um **canal de updates próprio** (feed
  estático: GitHub Releases privado **ou** bucket na VPS/Cloudflare — coerente com a infra
  CMTec, `INFRA-E-MIGRACAO.md`). Updates **assinados**; o updater **verifica a assinatura**.
- **🔒 (R2) Pin da chave + anti-downgrade:** se o feed for comprometido, um update malicioso
  (assinado com chave trocada) ou um **downgrade** para versão vulnerável entra na máquina que
  capta áudio. → **pin da chave pública** de assinatura **embutida no app** (não confiar só na
  cadeia do SO), **versão monotónica** (proibir downgrade), feed **só HTTPS**. (`SEGURANCA §13.i`.)
- **Updates opcionais, não forçados:** coerente com *"instância independente do
  comprador"* (`ASSISTENTE-PESSOAL §2`) — o produto entregue é **dele**. O cliente vê
  *"há uma versão nova [ver o que mudou] [atualizar agora] [depois]"*; não empurramos
  silenciosamente nem dependemos do nosso runtime.
- **Compatibilidade de contrato:** o desktop fala com o backend por **contratos de
  `packages/core`** (WS §2.4, API §2.3). Uma versão antiga do desktop tem de continuar a
  funcionar com o backend → mensagens WS **versionadas** / tolerantes a campos novos
  (ignorar o que não conhece). Evita o "atualiza ou parou".
- **Single-tenant v1 (IRIS):** uma só instalação para a Filipa; o canal de updates é
  trivial. A spec do canal por-comprador detalha-se quando houver 2º cliente.

---

## 7. Início conversacional — "vou para uma reunião"

> A Filipa **não opera nada** (`ASSISTENTE-PESSOAL §3`). Ela **diz** *"vou para uma
> reunião"* ou **cola o link** → o **assistente** orquestra. O desktop é o **executor do
> cliente**, não o cérebro.

```
Filipa (web/assistente/Telegram): "vou para uma reunião" / cola link Meet
        │
   services/agent (PORTA de confirmação: efeito "enviar_fora"/"pôr-se na call")
        │  POST /api/interviews/join  (ARQUITETURA-INTEGRACAO §2.3)
        ▼
   realtime: cria/garante a sala LiveKit + (online) põe o BOT na call
        │
        ▼
   desktop: recebe "interview.active {interviewId, sala/token}"  ──► overlay APARECE +
            arranca a captura local (microfone + loopback se aplicável)
```

- **Como o desktop é avisado:** ele mantém uma ligação leve ao backend (o mesmo
  `apps/ws`, autenticado pelo JWT) e recebe um evento `interview.active` quando a
  entrevista dela arranca → **mostra-se e começa a captar**. Não é a Filipa que "abre o
  app e configura" — ele reage.
- **Presencial:** o assistente sinaliza "presencial" → o desktop **não** espera um bot;
  capta pelo **microfone** da sala (diarização por voz + `voice_enrollment_path`).
- **Arranque manual de recurso:** se o assistente não estiver disponível, há um caminho
  mínimo no tray ("entrar na entrevista X") — rede de segurança, **não** o caminho normal.
- **Confirmação:** "pôr o bot na call" é `enviar_fora` → passa pela **porta de
  confirmação** do assistente (`ASSISTENTE-PESSOAL §2.1`); o desktop só age depois do
  `interview.active`.

---

## 8. Robustez — quedas, offline e encerramento

### Reconexão (rede e WS de estado)
- **WS de estado cai:** o desktop **reconecta com backoff** e reenvia o JWT na 1ª
  mensagem; ao voltar, **re-sincroniza** o estado corrente (o `realtime` é o dono — o
  desktop pede um `state.snapshot` ao religar, não tenta reconstruir nada). O HUD mostra
  *"a religar…"*, nunca dados velhos como se fossem novos (sem falha silenciosa).
- **Áudio cai:** ver §2.3 (LiveKit reconecta a faixa; HUD avisa).
- **Isolamento:** se o **assistente** (`services/agent`) cair, a **entrevista continua**
  (o vivo é processo separado, `ARQUITETURA-TEMPO-REAL §11` regra 4); o desktop só perde o
  chat "pesado", não a captura nem o overlay.

### Offline / sem rede
- Sem rede **não há entrevista ao vivo** (o juízo vive na VPS) — o desktop **di-lo
  claramente** (*"sem ligação — não consigo transcrever; volto a ligar sozinho"*), em vez
  de fingir que funciona. **Não** há "modo offline" que processe localmente (cliente
  fino).
- A **captura não persiste localmente** à espera de rede (decisão de segurança §10): o
  que se perde durante a queda perde-se da análise ao vivo, mas a entrevista **retoma**
  quando a rede volta (a transcrição até ali já está segura na Camada A da VPS).

### Encerramento
- A Filipa sinaliza "terminar" (HUD ou tray) **ou** o assistente deteta o fim → o desktop
  **para a captura**, fecha a faixa LiveKit, **fecha a janela do overlay**, descarta o
  buffer de áudio em memória, e dispara (via API) o `POST /api/interviews/:id/report`
  (`ARQUITETURA-INTEGRACAO §2.3`) — o **relatório** é gerado no backend, não no desktop.
- **Crash do app a meio:** como o **estado vive na VPS** e o **escritor é o `realtime`**,
  reabrir o desktop e voltar à entrevista **retoma** (pede `state.snapshot`); nada do
  juízo se perde por o cliente ter morrido.

---

## 9. Multiplataforma — Electron (Win + macOS), Tauri como alternativa

- **v1: Electron** (decisão LOCKED). Razões: `safeStorage` cifrado pronto, `BrowserWindow`
  com `alwaysOnTop`/`frame:false`/`transparent`, `setDisplayMediaRequestHandler` com
  loopback de áudio, `electron-updater` maduro, mesma stack web (React) do renderer →
  reuso do HUD com `apps/web`. **Win + macOS** no MVP (Linux fora do v1).
- **Tauri (alternativa a avaliar, não agora):**

| Critério | Electron (escolhido) | Tauri (alternativa) |
|---|---|---|
| Peso do bundle / RAM | maior (Chromium embutido) | **muito menor** (webview do SO) |
| Captura de áudio de sistema | madura (Chromium loopback no Win; ScreenCaptureKit via addon no mac) | precisa de **plugin/Rust nativo** por plataforma → mais a construir |
| `safeStorage` equivalente | nativo | `stronghold`/keyring (mapeável, mais trabalho) |
| Maturidade do ecossistema overlay/updater | alta | crescente |
| Risco para o MVP | **baixo** (caminho conhecido) | maior (mais código nativo) |

> **Trade-off:** Tauri ganha em peso/RAM (relevante para um overlay sempre presente), mas
> a **captura de áudio de sistema** — o ponto técnico mais sensível — é mais trabalhosa em
> Tauri. Para o MVP, Electron tira esse risco. **Reavaliar Tauri** depois de o produto
> estabilizar, sobretudo se o consumo de RAM do overlay incomodar.

---

## 10. Segurança do cliente desktop

- **Em disco, só a sessão cifrada** (`safeStorage`) + `device-id`. **Zero** dados de
  negócio (candidatos, transcrições, pareceres) no PC — tudo na VPS (`AUTENTICACAO §8`).
- **Áudio não persiste localmente** (§2.4): stream → `realtime`; a transcrição vive na
  Camada A da VPS, não um WAV no portátil.
- **WS autenticado** (JWT na 1ª mensagem + posse da entrevista, §4.3) — uma ligação que
  saiba o `interview_id` **não** chega para espreitar as sugestões privadas.
- **Sugestões/avaliação são privadas da Filipa** — vivem só no overlay dela; nunca são
  partilhadas na call (`ARQUITETURA-TEMPO-REAL §6`). O desktop **não** expõe o HUD por
  screen-share por acidente: orientar a Filipa a partilhar **a janela do Meet**, não o
  ecrã todo (nota de UX), e o overlay é uma janela separada (não dentro do Meet).
- **Sem segredos no bundle:** o desktop **não embute** chaves LiveKit/Supabase service-role
  — pede tokens à API autenticado (§2.2, §4). Só `SUPABASE_URL`/`ANON_KEY` (públicos) e
  `NEXT_PUBLIC_WS_URL` podem ir no cliente (`ARQUITETURA-INTEGRACAO §3`).
- **Code-signing + notarização** (§6) — a Filipa não corre binário não assinado;
  protege contra um instalador adulterado.
- **🔒 (R2 — BLOQUEADOR) Hardening do processo Electron (contrato, não escolha):** o renderer
  carrega o HUD e abre `getUserMedia`/`getDisplayMedia` — um XSS ou navegação induzida no
  renderer **sem** isto vira **RCE no PC da Filipa** (acesso ao mic + `safeStorage`). Logo o
  `BrowserWindow` é **obrigatoriamente**: `sandbox:true` + `contextIsolation:true` +
  `nodeIntegration:false`, **preload com `contextBridge` mínimo** (só as APIs necessárias),
  `setWindowOpenHandler(() => ({action:'deny'}))`, `will-navigate` com **allowlist** (só o
  backend Vera), e **CSP estrita** no renderer. (`SEGURANCA §13.a`.)
- **PC perdido/roubado:** revogar dispositivo na web mata a sessão; re-auth 24h limita a
  janela; os dados ficam intactos na VPS (`AUTENTICACAO §8`).
- **Atualizações assinadas e verificadas** (§6) — o canal de update não pode ser vetor de
  injeção de código.

---

## 11. Estado / abertos (para decidir na implementação)

| # | Em aberto | Notas |
|---|---|---|
| D1 | **macOS áudio de sistema:** ScreenCaptureKit (addon nativo) vs. driver agregado vs. só-microfone+bot | inclinação: ScreenCaptureKit; confirmar custo do addon nativo vs. aceitar "só-microfone+bot" no online |
| D2 | **Desktop publica áudio direto na sala LiveKit** vs. encaminha para o `realtime` que republica | §2.2 propõe publicar na sala (reuso do transporte); confirmar com o dono de `apps/realtime` |
| D3 | **Nível de `alwaysOnTop`** que vence o **fullscreen** do Zoom/Meet em cada SO | testar empiricamente Win + macOS (Meet em fullscreen é o caso difícil) |
| D4 | **Canal de auto-update:** GitHub Releases privado vs. bucket VPS/Cloudflare | decidir com a infra; coerente com "instância do comprador" (§6) |
| D5 | **Click-through ("fantasma") por defeito** ligado ou desligado | UX: começar desligado (visível e clicável), com toggle |
| D6 | **Certificado de code-signing** (EV para Windows? conta Apple Developer da IRIS ou da CMTec?) | logística/legal — relevante para "produto do comprador" |
| D7 | **Reuso do renderer com `apps/web`** (mesmo design system Apollo) vs. bundle próprio mais leve | inclinação: partilhar componentes do HUD para não duplicar a Tela 6 |
| D8 | **Arranque mínimo manual** (tray) — quanto expor sem o assistente | §7: rede de segurança, manter mínimo |

> Nada aqui reabre decisões LOCKED — são escolhas de implementação dentro delas.

---

## 12. Resumo

O `apps/desktop` é um **cliente fino Electron** com **dois trabalhos**: (1) **mostrar o
overlay** ao vivo (Tela 6, HUD Apollo) consumindo o WebSocket de estado, e (2) **captar o
áudio local** (microfone + áudio do sistema via WASAPI loopback no Windows /
ScreenCaptureKit no macOS) e publicá-lo na **sala LiveKit** da entrevista, reusando o
transporte que a CMTec já opera. A janela é **frameless, always-on-top, ~360px,
arrastável, multi-monitor, só aparece quando ativo**. A sessão (e só a sessão) vive
cifrada no `safeStorage`; **todo o estado/memória está na VPS** → troca de PC continua de
onde estava. Login por **biometria facial** (clone `cmtec-face`) ou email/senha → JWT
Supabase; o WS valida JWT + **posse da entrevista**. A Filipa **não opera nada**: diz *"vou
para uma reunião"*/cola o link → o **assistente** orquestra e o desktop **reage**
(`interview.active`). Robustez sem falhas silenciosas (reconexão de áudio e de estado,
offline declarado, encerramento limpo); distribuição **assinada + notarizada** com
**auto-update opcional** (coerente com "instância independente do comprador"). **Tauri**
fica anotado como alternativa mais leve a reavaliar depois do MVP — o risco do MVP é a
captura de áudio de sistema, onde Electron é o caminho seguro.
