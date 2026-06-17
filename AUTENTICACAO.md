# Autenticação — desktop, web e WebSocket (fecha o bloqueador #5)

> **Decisão (LOCKED 2026-06-17):** biometria **facial primeiro**, email+senha como
> alternativa. Reaproveitamos o **engine/código** do `cmtec-face` que a CMTec já tem
> **em produção** (go-live 2026-06-15, painéis CMTec) — mas **CLONADO como instância
> própria deste projeto**, **não** partilhando o serviço do painel. Identidade e
> sessão continuam assentes no **Supabase Auth** — a face é o *fator da porta*, o
> Supabase é o *quem é*.
>
> ⚠️ **Regra do Mateus (não misturar projetos):** quando começarmos a construir,
> **clonamos a biometria para o RH Automação** (própria base, próprio deploy). O
> `cmtec-face` do painel-cmtec serve de **molde provado**, não de dependência
> partilhada. Antes de clonar, o **bug de enroll** (§6 C1) tem de estar resolvido na
> origem.

---

## 1. O molde provado (clonar, não construir do zero — e não partilhar)

`cmtec-face` é um microserviço **FastAPI na VPS** (`:18796`, túnel
`face.cmtecnologia.pt`) que encapsula o engine de biometria facial **Python
standalone** que já desenhámos e operamos. **Reusamos o código/engine clonando-o
numa instância própria do RH** (novo container + novas tabelas no nosso schema +
novo túnel, ex. `face-rh.cmtecnologia.pt`). Não chamamos o serviço do painel.
A tabela abaixo é o que clonamos:

| Peça | Detalhe | Estado |
|---|---|---|
| Deteção de rosto | **YuNet** (OpenCV, ONNX, CPU) | ✅ em produção |
| Reconhecimento 1:1 | **SFace** (match coseno ≥ **0.363**) | ✅ |
| Vivacidade ativa | **liveness FSM** (desafio-resposta) + **flash liveness** (Pearson cor↔reflexo) | ✅ |
| Anti-spoof passivo | **MiniFASNet** (ensemble ONNX) | ⚠️ **DESLIGADO** (false-reject; ver §6) |
| Anti-troca de identidade | coseno vs âncora **durante** a sessão | ✅ |
| Canal S2S serviço↔app | **Ed25519** + **HMAC** (`${ts}.${body}`) + JSON canónico | ✅ |
| Tabelas (migração 017, schema `cmtec`) | `face_templates` (embedding cifrado/email), `trusted_devices` (device-binding), `face_verdicts` (canal efémero **single-use**) | ✅ RLS total |
| Bridge para sessão | `complete` **consome o veredito atomicamente** → cria sessão **Supabase via `generateLink`** | ✅ |
| Fallback | **magic-link** via GoTrue SMTP da VPS (`smtp.gmail.com`, já configurado) | ✅ |

> A consequência prática mais importante: o `cmtec-face` **já termina numa sessão
> Supabase**. Ou seja, qualquer caminho de login (face ou email+senha) acaba num
> **JWT do Supabase** — que é exatamente o que o WebSocket precisa de verificar.

---

## 2. Os três fatores de login da Filipa (por ordem)

```
1º  BIOMETRIA FACIAL (cmtec-face)         ← caminho principal
        │  verify (liveness FSM + SFace 1:1) → veredito single-use
        ▼
    backend consome veredito  →  sessão Supabase (JWT)
        │
2º  EMAIL + SENHA (Supabase Auth)          ← alternativa direta
        │  signInWithPassword → sessão Supabase (JWT)
        ▼
3º  MAGIC-LINK (GoTrue/SMTP)               ← recuperação / 1º device-binding
```

A Filipa **regista a cara 1×** (enroll → `face_templates`). A partir daí, o login
do dia-a-dia é olhar para a câmara. Se a biometria falhar (luz, câmara, etc.), cai
para email+senha sem fricção. Magic-link serve para **estabelecer o dispositivo**
(device-binding) e recuperação.

---

## 3. Fluxo do app desktop (Electron) — o adaptador que falta construir

O `cmtec-face` foi feito para o **painel web** (Next.js + cookie de dispositivo
assinado + middleware). O **desktop** é uma superfície de cliente diferente, logo
precisa de um **adaptador fino** — mas reusa o backend e o serviço tal e qual.

```
[App desktop / Electron]
   │ 1. renderer abre a câmara (getUserMedia) e corre o verify do cmtec-face
   │    (BrowserWindow dedicada apontando à página de verify, ou o próprio renderer)
   ▼
[biometria RH (clone, ex. face-rh.cmtecnologia.pt)]
   │ 2. liveness FSM (WS) + VerifyFlow (guardas em AND) → grava veredito single-use
   ▼
[backend RH (apps/web Route Handler)]
   │ 3. /auth/face/complete  → consome veredito (atómico) → cria sessão Supabase
   │    (generateLink) → devolve {access_token, refresh_token}
   ▼
[App desktop]
   │ 4. guarda a sessão no Electron safeStorage (cifrado pelo SO)
   │ 5. liga o WebSocket enviando o access_token (JWT)
   ▼
[servidor WS]
     6. valida o JWT (segredo Supabase) → extrai user_id (= recrutador)
     7. confirma que esse recrutador é DONO da interview_id pedida → aceita ligação
        token expira → refresh silencioso (refresh_token)
```

**Identidade de dispositivo no desktop:** o painel web usa cookie de dispositivo
assinado; o Electron não tem esse cookie. Substituto: um **device-id gerado e
guardado no safeStorage** no 1º arranque, registado em `trusted_devices` no
primeiro magic-link (mesmo padrão D7, outra superfície). O email **nunca vem do
cliente** — vem sempre do device-binding (regra de segurança herdada do painel).

---

## 4. Auth do WebSocket (o requisito E1, agora fechado)

Igual nos dois caminhos de login porque ambos terminam num JWT do Supabase:

1. O desktop liga e envia o **`access_token`** (primeira mensagem do WS, **não** em
   query-string — não fica em logs/URLs).
2. O servidor WS **verifica o JWT** com o segredo do Supabase (assinatura + `exp`).
3. Extrai `sub` → `recruiter_id`.
4. **Verifica posse:** `SELECT 1 FROM interview WHERE id=$1 AND recruiter_id=$2`.
   Sem posse → recusa (não basta saber o `interview_id`).
5. JWT expira a meio das 2h → o desktop faz **refresh silencioso** e reata o WS sem
   a Filipa notar.

> **v1 single-tenant** (só IRIS) tira o risco cross-tenant, mas a verificação de
> **posse da entrevista** mantém-se — é o que impede que uma ligação qualquer
> espreite as sugestões privadas do overlay.

---

## 5. Web app — sem mudança

A web app (a "casa" da Filipa: pastas, parecer, chat-RAG) já usa **Supabase Auth**
(`@supabase/ssr`). Ganha o mesmo botão de **login facial** (já existe no painel
CMTec) além do email+senha. Mesma sessão, mesmo JWT.

---

## 6. Caveats reais (não varrer para baixo do tapete)

| # | Caveat | Impacto | O que fazer antes de confiar |
|---|---|---|---|
| C1 | **Bug de enroll suspeito** no `cmtec-face`: enroll parece cadastrar **rápido demais, sem mostrar a tela colorida (flash liveness)** — foi o que aconteceu da 1ª vez. (Henrique diz que funciona; estado incerto. Também houve a 06-15 um enroll que "recusava com movimentos certos".) | Se o flash liveness não corre, o enroll perde uma camada de vivacidade — e o **clone herda o bug**. | **Resolver OUTRO DIA na origem (painel-cmtec), ANTES de clonar.** Não nesta sessão. Anotado em memória `project_cmtec_face_enroll_bug_2026_06_17`. Gate de qualidade, não de spec. |
| C2 | **Anti-spoof passivo (MiniFASNet) DESLIGADO** por false-reject. Sobram liveness FSM ativo + device-binding + anti-troca. | Defesa anti-foto/vídeo mais fraca do que o desenho completo. | Aceitável para 1 utilizadora de confiança (Filipa) na v1; reativar/afinar antes de abrir a mais gente (v2). |
| C3 | O molde foi construído para o **painel web** (cookie/middleware Next.js). O desktop precisa do **adaptador da §3** (device-id no safeStorage + rota `complete` para o backend RH). | Pequena peça nova a construir. | Faz parte do `apps/desktop` + uma rota em `apps/web`. Não é serviço novo. |
| C4 | Clonar = **novo schema/role/deploy** próprios do RH (não tocar no `cmtec` do painel). Provisionamento do role Postgres teve atrito no painel (syntax de password no `docker exec`). | Setup, não runtime. | Aplicar a migração de face num schema próprio do RH; DSN/role dedicados. |

---

## 7. Resumo da decisão (para o log)

- **Identidade/sessão:** Supabase Auth (JWT) — fonte única. *(já era D-stack)*
- **Fator 1 (porta):** biometria facial — **clone próprio** do engine `cmtec-face` (não o serviço do painel).
- **Fator 2:** email+senha (Supabase) — alternativa direta.
- **Fator 3:** magic-link (GoTrue/SMTP VPS) — device-binding + recuperação.
- **WS:** JWT na 1ª mensagem → verifica assinatura + **posse da entrevista**.
- **A construir:** clone da biometria (instância RH própria) + adaptador desktop
  (device-id safeStorage + rota `/auth/face/complete` no backend RH).
- **A resolver ANTES de clonar (outro dia, na origem):** bug de enroll/flash liveness
  do `cmtec-face` (C1).

> Bloqueador #5 (REVISAO-360) passa de 🟠 a ✅ **RESOLVIDO** — desenho fechado e
> assente em peça já em produção. Sobra só o bloqueador #6 (validar a "lente do
> cliente" com a Filipa).

---

## 8. Distribuição, multi-dispositivo e segurança (a pergunta do Mateus, 2026-06-17)

> *"como passa pro PC dela? baixa o app e tem acesso a tudo? se quiser outro PC, loga na
> conta web, baixa o app, continua de onde estava com a memória toda porque está na VPS,
> certo?"* — **Certo. É exatamente esse o desenho.**

### Cliente fino + estado no servidor (a razão de "continuar de onde estava")
**Todo o estado e memória vivem na VPS** (Postgres + Storage). O **app desktop** e a
**web app** são **clientes finos** — não guardam nada crítico localmente.

| Superfície | O que faz | O que guarda localmente |
|---|---|---|
| **Web app** (a casa) | tudo: pastas, parecer, chat, comparação, definições | nada (sessão no browser) |
| **App desktop** (overlay) | login + **captura de áudio** + overlay ao vivo | **só a sessão** (token), no `safeStorage` cifrado do SO |

### Multi-dispositivo (PC novo) — o teu cenário, confirmado
```
PC novo → baixa o app → login (biometria facial ou email/senha)
        → a sessão Supabase valida contra a VPS
        → TUDO aparece (candidatos, clientes, memória, conversas) — está na VPS
        → continua exatamente de onde estava.
```
Nada se perde ao trocar de máquina, porque **nada de importante estava na máquina.**

### Segurança nas duas superfícies
- **Login:** biometria facial (1º) ou email/senha — igual na web e no desktop (§2–§5).
- **Transporte:** HTTPS/túnel Cloudflare; o WS valida JWT + posse da entrevista (§4).
- **Dados na VPS:** controlo de acesso (RLS por agência na v2), encriptação em repouso,
  segredos em sops+age, trilho de auditoria (quem viu/fez o quê).
- **Desktop:** só guarda a **sessão cifrada**; device-binding em `trusted_devices`.
- **Perdeu/roubaram o PC?** ela **revoga o dispositivo** na web (`trusted_devices`) → a
  sessão morre; **os dados continuam intactos na VPS**. Re-autenticação facial periódica
  (24h) limita a janela de abuso.

> É o mesmo princípio do `cmtec-face`/painéis CMTec: a máquina é descartável, a verdade
> está no servidor. Bom para ela (troca de PC sem dor) **e** para segurança (nada
> sensível fica no portátil).
