# Auth Contract — claims, permissões, S2S, validação no WS

> Fecha o gap "auth coerente na intenção mas falta o contrato operacional" (review
> 2026-06-18). Complementa `AUTENTICACAO.md` (que é o *fluxo* de login: biometria/email).
> Aqui ficam os **claims, a validação e a matriz de permissões** que o código usa.
> **v1 single-tenant (só IRIS)** — `agency_id` está nos claims como costura p/ v2, mas
> não isola na v1.

## 1. Identidade & claims (JWT do Supabase)
Todo login (facial ou email) termina numa **sessão Supabase** → JWT com:
```jsonc
{ "sub": "<auth.users.id>", "email": "...",
  "app_metadata": { "recruiter_id": "<uuid>", "agency_id": "<uuid>" } }
```
- `recruiter_id`/`agency_id` injetados no token (hook do GoTrue ou lookup no backend a
  partir de `sub`). É o que liga a sessão à tabela `recruiter`.
- **Device-binding:** o `recruiter_id`/email vêm do **cookie de dispositivo assinado**
  (D7) ou da sessão — **nunca do cliente** (regra herdada do painel).

## 2. Validação por superfície
| Superfície | Como valida |
|---|---|
| **Rotas Next `/api/*`** | middleware obrigatório: `supabase.auth.getUser()` → exige sessão; extrai `recruiter_id`. Sem sessão → 401. |
| **WebSocket** (`apps/ws`) | 1ª frame `{type:"auth", accessToken}` → verifica assinatura Supabase + `exp` → extrai `recruiter_id` → **confirma posse**: `interview.process.recruiter_id == recruiter_id`. Falha → close `4401`(authn)/`4403`(authz). Refresh silencioso antes do `exp`. |
| **Re-auth facial** | a cada **24h** força nova biometria (o refresh do JWT **não** contorna esta janela). |

## 3. Service-to-service (S2S) — entre o Next e os serviços Python
| Canal | Mecanismo |
|---|---|
| **Next ↔ `services/face`** | **Ed25519 + HMAC** (`${ts}.${body}`, JSON canónico) — já no cmtec-face; veredito empurrado S2S, single-use. |
| **Next ↔ `services/agent` / `apps/realtime`** | **token interno S2S** (sops+age, header `Authorization: Bearer <s2s>`), só na rede interna/Docker; nunca exposto ao cliente. ⚠️ **(R2) token DISTINTO por par de serviços** (não um global) + **rotação**; idealmente subir a **Ed25519+HMAC** como o face (reusar `signing.py`/`s2s.py`) — um Bearer estático partilhado, se vazar, dá acesso total entre serviços (o agente tem `enviar_fora`). |
| **service-role do Supabase** | **só em migrações** (não no request path, §7) — **nunca** no cliente/edge/desktop. |

> ⚠️ **(R2) Token LiveKit — TTL curto + revogação:** o token de sala (emitido por
> `/api/interviews`) é **single-use, scoped à `interview_id`+dono** (`SEGURANCA §5`) **e** tem
> **TTL curto + renovação ligada à sessão Supabase** — uma entrevista dura ~2h; um token
> válido horas, se intercetado, deixa ouvir/publicar áudio do candidato toda a janela. A
> room/participante é **revogada** no encerramento e no **kill-switch** (não confiar só em
> `interview.status`).

## 4. Permissões (matriz v1)
- **v1 single-tenant:** a recrutadora autenticada tem **acesso total aos dados da agência**
  (sem RLS). A barreira que importa é a **posse da entrevista** no WS (§2) — impede que
  uma ligação qualquer espreite o overlay privado.
- **Ferramentas do agente** (`AGENTE-TOOLS-E-WS`): a permissão é pelo **`efeito`** —
  `leitura`/`rascunho`/`geração` correm livres; `gravar`/`enviar_fora` exigem
  **confirmação da Filipa** + ficam em `assistant_action` (auditoria). Nenhuma tool
  escreve fora do domínio dela.
- **v2 (multi-agência):** RLS por `agency_id` (políticas em `MODELO-DADOS §RLS`) + as
  permissões passam a filtrar por agência. `agency_id` já está nos claims.

## 5. Renovação & revogação
- **Sessão:** access token curto + refresh token (refresh silencioso, inclui no WS).
- **Perdeu o dispositivo:** revoga em `trusted_devices` → a sessão morre; dados intactos
  na VPS (`AUTENTICACAO §8`).
- **Consentimento:** se `process.consent_status != 'dado'`, o copiloto ao vivo **não
  arranca a captura** (gate de produto — `LEGAL-E-RGPD`).

## 7. Isolamento de tenant como defesa-em-profundidade DESDE A v1 (raiz — loop segurança 2026-06-18)

A v1 é single-tenant **sem RLS**, mas o produto será **clonado para a VPS de cada comprador**
(v2 multi-agência). Adiar **todo** o isolamento para a v2 cria um risco caro: na v2, **uma**
query sem filtro de `agency_id`, ou **um** uso de `service-role` no caminho de request, vira
**fuga de dados entre agências**. Logo, **já na v1** (custo ínfimo, single-tenant):

1. **`agency_id` é predicado OBRIGATÓRIO em TODO o acesso a dados** — o repositório (Drizzle)
   recebe `agencyId` e injeta-o em todas as queries (incl. RAG `*_embedding` **e a query de
   posse do WS** do §2: `... AND agency_id = $3`). Redundante na v1, essencial na v2. **RLS é a
   2ª camada, nunca a única.**
2. **Roles Postgres least-privilege (NÃO `service-role` no request path):** um role por serviço
   (`vera_web`/`vera_agent`/`vera_face`) com grants mínimos e RLS aplicável; o agente Python
   liga **não-superuser** (um SSRF/RCE nele não lê a base inteira). `service-role` = **só
   migrações**.
3. Detalhe e restantes controlos técnicos: **`SEGURANCA.md §1`**.

## 8. Resumo
Supabase Auth = fonte de identidade (JWT com `recruiter_id`/`agency_id`). WS valida JWT +
**posse da entrevista** (+ `agency_id` no predicado, §7). Python ↔ Next por S2S (face=Ed25519/
HMAC; agent/realtime=token interno). **service-role só em migrações**, nunca no request path
(§7); roles least-privilege por serviço. Permissão de tool = pelo `efeito` (confirmação +
auditoria). `agency_id` filtra em **todo** o acesso desde a v1; v2 liga RLS por cima.
Segurança técnica completa: `SEGURANCA.md`.
