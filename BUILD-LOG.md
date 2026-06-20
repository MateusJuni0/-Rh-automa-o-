# BUILD-LOG — Fase 3 (Vera)

> Diário do loop de construção. Cada iteração regista: **o que fez · o que passou (build/testes/review)
> · o que falta · bloqueios/spikes para o Mateus**. O Mateus lê isto de manhã. Mais recente no topo.

**Estado inicial (pré-build):** spec 100% provada (13 famílias A–M, 35 tabelas). Nada de código ainda.
Próximo: branch `phase3/build` → scaffold monorepo → `packages/db` (schema das 35 tabelas) com TDD.
Método e regras: `PROMPT-FASE-3-LOOP.md` + `FASE-3-ARRANQUE.md`.

---

# ═══ FASE Ω — TORNAR REAL (em curso) ═══
> Adaptadores/serviços REAIS atrás das interfaces, ativados por env (config-not-code); mock = fallback sem chave. NUNCA chamadas pagas no dev (rede mockada nos testes), NUNCA segredos, NUNCA VPS.

## [2026-06-20 ~18:30] Ω-2 Bloco C — entrevista AO VIVO: adapters reais (Soniox/LiveKit) + captura desktop + compositor (inertes sem chave)
- **Recuperação:** a sessão paralela escreveu o Bloco C mas o processo do Claude Code saiu antes de committar. Verifiquei tudo (typecheck/build/**396 testes**/Biome), corri uma **revisão adversarial dedicada** (workflow 3 lentes — segredos/chamadas-pagas · correção/protocolo · fail-loud/qualidade — + verificação cética de cada constatação) e fechei.
- **`apps/realtime/src/soniox.ts` (NOVO):** adapter STT REAL — WebSocket Soniox (config inicial `api_key`+modelo+diarização; parse de tokens → `TranscriptChunk[]`). Transporte `SonioxSocketFactory` INJETADO (testes sem rede). Inerte sem `SONIOX_API_KEY`.
- **`apps/realtime/src/livekit.ts` (NOVO):** transporte de áudio REAL — o bot entra na sala, recebe frames dos participantes e encaminha (`pipeToSoniox`). `Room`+token INJETADOS. Inerte sem `LIVEKIT_*`.
- **`apps/realtime/src/wiring.ts` (NOVO):** `chooseTranscriptMode()` → `"live"` SÓ se Soniox **E** LiveKit configurados; senão `"mock"` (nunca corre meia-ligação em silêncio).
- **`apps/realtime/src/live-source.ts` (NOVO):** `buildLiveTranscriptSource` COMPÕE LiveKit→Soniox numa única `TranscriptSource` (idêntica à do mock → o resto do pipeline `TickEngine.attach`→frames WS→overlay NÃO muda). Teste prova a composição **ponta-a-ponta** (áudio da sala → STT → chunk).
- **`apps/desktop/.../audioCapture.ts` (NOVO):** captura no renderer flag-gated (`getUserMedia`/`desktopCapturer`), fallback no mock feed; sem permissão → degrada para inativo (sem rebentar, sem fingir sucesso).
- **Fixes da revisão (sem CRITICAL/HIGH; todos os MEDIUM/LOW confirmados resolvidos):**
  - **[MEDIUM] diarização correta:** uma troca de falante a meio de uma mensagem Soniox já NÃO mistura falas nem as atribui todas ao 1.º — `sonioxTokensToChunks` agrupa por **falante contíguo** → chunks separados (candidato vs recrutador). Atribuição errada corromperia o gating do tick + o texto dado à IA.
  - **[MEDIUM] fail-loud:** `soniox` `error`/`close` e `livekit` `disconnected` deixaram de ser silenciosos → `onError` (default stderr via `log.ts`). Antes, uma chave inválida (auth reject) ou queda da call → HUD mudo indistinguível de "ainda sem fala" (violava a regra LOCKED "sem falhas silenciosas").
  - **[LOW] `as Uint8Array` cego** no livekit → narrowing por `instanceof` (o guard volta a ter backstop do compilador).
  - **[LOW] seed:** removido `UPDATE` redundante depois do `onConflictDoUpdate` (escrita dupla na mesma linha); `eq` importado morto removido.
- **Verde:** typecheck ✅ · realtime **2→28** · desktop **44→50** · **396 testes** (web 139) · `next build` ✅ · Biome ✅ (312 ficheiros). Sem rede (transportes fake) · sem segredos.
- ⚠️ **HANDOVER (Mateus) — o RUNTIME ao vivo NÃO está wired:** ligar `chooseTranscriptMode`→`buildLiveTranscriptSource`→`TickEngine`→broadcast WS→overlay, e a `audioCapture` ao bootstrap do renderer, é a **última milha** que só se valida com as chaves (LiveKit/Soniox) + servidor LiveKit + hardware (microfone). É a **entrevista ao vivo deferida** ("fazemos quando tivermos oportunidade"). Os adapters + compositor estão **prontos, testados e inertes** — o mock feed continua a ser o caminho demonstrável.

## [2026-06-20 ~17:00] Ω-2 Bloco B — Supabase LOCAL a correr + login email/senha validado ponta-a-ponta
- **Stack `--profile supabase` SOBE no Windows** (auth GoTrue + rest PostgREST + storage + kong gateway :8000). Validado a correr de facto, não só `compose config`.
- **2 passos de bootstrap que faltavam (DB)** — sem eles o GoTrue/PostgREST não arrancam; agora documentados:
  1. **Roles Supabase** na `vera_dev`: `CREATE ROLE anon/authenticated/service_role` (+ `GRANT ... TO postgres`). O PostgREST exige a role `anon`; o GoTrue/storage as outras.
  2. **Schema `auth`**: `CREATE SCHEMA auth AUTHORIZATION postgres` (o GoTrue v2.158 NÃO o cria sozinho — falhava com `SQLSTATE 3F000 no schema has been selected`). Depois `docker restart vera-auth-1` → **52 migrações aplicadas** ✅.
- **JWTs de dev** (anon/service_role) assinados com o `SUPABASE_JWT_SECRET` default (HS256, claim `role`+`iss:supabase`). Gerados com node+crypto (NÃO são segredos — secret de dev público no compose; NUNCA em produção).
- **Seed:** `scripts/seed-supabase-auth.ts` criou **Filipa+Inês no GoTrue** e ligou `recruiter.user_id`. Confirmado na DB (user_id do GoTrue → recruiter da agência IRIS) → `resolveSessionByUserId` resolve.
- **Login email/senha ponta-a-ponta LOCAL ✅:** `POST /auth/v1/token?grant_type=password` via kong:8000 → password certa devolve **access_token JWT** (sub=user da Filipa); password errada → **HTTP 400**. É exatamente o que o `signInWithPassword` faz; com `SUPABASE_URL`+`SUPABASE_ANON_KEY` locais a app entra em `AUTH_ENABLED` e usa o real.
- **PAGOS ficam inertes (confirmado):** `AI_ENABLED`=`Boolean(OPENROUTER_API_KEY)`, `EMBEDDER_ENABLED`=`Boolean(EMBEDDER_API_KEY)` — sem chave caem no mock (€0). Prontos p/ as chaves do Mateus (KEYS-TODO).
- **Nada committado de código** (Bloco B é infra/validação) — só docs (BUILD-LOG/KEYS-TODO com o passo-a-passo de subida).

## [2026-06-20 ~16:35] Ω-2 Bloco A4 — invariantes de boot + cookies (FECHA Bloco A)
- **`lib/auth-config.ts` (NOVO):** `assertAuthConfig()` (fail-fast) — `SUPABASE_URL` sem `SUPABASE_ANON_KEY` (ou vice-versa) → LANÇA (config meia-feita cairia em modo mock sem avisar); produção sem auth E sem `ALLOW_DEV_SESSION` → LANÇA. `devSessionAllowed()` = flag EXPLÍCITA `ALLOW_DEV_SESSION=1`.
- **`instrumentation.ts` (NOVO):** `register()` do Next chama `assertAuthConfig()` no arranque (só `NEXT_RUNTIME=nodejs`) → o processo não sobe com config perigosa.
- **`lib/session.ts`:** o fallback DEV de identidade (Filipa) passa a exigir `devSessionAllowed()` — **NÃO** se infere de `NODE_ENV` (deploy mal-configurado em `development` deixava de ganhar sessão fantasma). Sem a flag → erro ruidoso.
- **`lib/request-ip.ts`:** `isHttps(req)` (de `x-forwarded-proto` ou do protocolo do URL). **Login cookies:** `sameSite: "strict"` (CSRF) + `secure: isHttps(req)` (não de `NODE_ENV` — HTTPS real é sempre secure; HTTP dev não, senão o cookie não persistia).
- **`.env.example`:** documentado o invariante URL+ANON juntos + `ALLOW_DEV_SESSION`; removida a secção morta da biometria (FACE_*).
- **TDD (+14):** `assertAuthConfig` (6: completa/vazia/meia-feita×2/prod-sem-flag/prod-com-flag, via `vi.stubEnv`) · `request-ip` (7: clientIp×3 + isHttps×4) · login cookie attrs (+1: httpOnly+strict+secure por HTTP/HTTPS).
- **Verde:** typecheck ✅ · web **125→139** · `next build` ✅ (instrumentation não rebenta o build estático) · Biome ✅.
- **✅ BLOCO A FECHADO** (A1 rate-limit · A2 storage agency-scoped · A3 argsSchema+allowlist · A4 boot+cookies). Os 5 endurecimentos da revisão Ω resolvidos (a biometria saiu do projeto).

## [2026-06-20 ~16:05] Ω-2 Bloco A3 — argsSchema por tool (anti prompt-injection)
- **`lib/assistant/tools.ts`:** cada `ToolDef` ganha `argsSchema: z.ZodType`. Leitura/rascunho = schema tolerante (`z.record`, aceita extras). `enviar_email` = `to` validado por `recipientSchema` (email + **`EMAIL_DOMAIN_ALLOWLIST`** server-side, hoje `["iris.tech"]`) — `to` opcional (o planner mock não o extrai) MAS se presente TEM de estar na allowlist. `save_memory_fact`/`marcar_agenda`/`por_bot_na_call` validam formato dos campos se presentes (tamanho/UUID). `isAllowedRecipient()` + `validateToolArgs()` exportados.
- **`lib/assistant/gate.ts`:** `executeToolCall` valida `argsSchema` **antes de executar** (leitura imediata OU confirmado) → novo outcome `invalid_args`. A porta de confirmação mantém precedência (sem confirm → `needs_confirm`, não chega a validar/executar).
- **`lib/assistant/run.ts`:** ao PLANEAR descarta tool-calls com args inválidos (o LLM/injeção no CV não consegue pôr `enviar_email` para fora da allowlist em pendente); na CONFIRMAÇÃO re-valida os args persistidos antes do executor (defesa-em-profundidade; substitui o `TODO(FASE Ω)`). `invalid_args` → ação marcada `failed`.
- **Anti-exfiltração:** um `to: ataque@evil.com` (vindo do LLM ou de um prompt-injection num CV) é rejeitado server-side; só domínios da allowlist passam. ⚠️ nota no código + KEYS-TODO: o adapter REAL de email tem de validar também cc/bcc.
- **TDD (+9):** `isAllowedRecipient`; `validateToolArgs` (fora/dentro da allowlist; tool desconhecida→null; leitura tolerante; por_bot_na_call UUID); `executeToolCall` confirmado (envenenado→`invalid_args`; allowlist→`done`; sem confirm→`needs_confirm`). Testes existentes do gate migrados p/ destinatário na allowlist.
- **Verde:** typecheck ✅ · web **116→125** · `next build` ✅ · Biome ✅. Sem rede · sem segredos.

## [2026-06-20 ~15:35] Ω-2 Bloco A2 — storage agency-scoped (anti-IDOR cross-agency)
- **`lib/upload.ts`:** `validateUpload` ganha `agencyId` (OBRIGATÓRIO, da SESSÃO). Valida-o contra `UUID_RE` (recusa prefixo forjado / injeção de caminho via agencyId → "agência inválida"). A `storageKey` passa de `${uuid}.ext` para **`${agencyId}/${uuid}.ext`** → todos os CVs/PII ficam particionados por agência no bucket privado.
- **`lib/storage.ts`:** `createAgencyScopedStorage(provider, agencyId)` (NOVO) — wrapper que EXIGE `key.startsWith(${agencyId}/)` E rejeita `..` (traversal). Key sem o prefixo / de outra agência / com traversal → Promise REJEITADA (métodos `async` → rejeição, não exceção síncrona) ANTES de tocar no storage real. É a barreira anti-IDOR para assinar download/upload de PII.
- **`lib/storage-config.ts`:** `getAgencyStorage(agencyId)` (NOVO) — `createAgencyScopedStorage(getStorage(), agencyId)`. É o que as ROTAS devem usar (agencyId vem de `getSession`, nunca do cliente); combina com a `storageKey` já prefixada por `validateUpload`.
- **TDD (+5):** `validateUpload` com prefixo de agência + agencyId não-UUID rejeitado + traversal no nome ainda dá exatamente 1 `/`; `createAgencyScopedStorage` (delega com prefixo certo; OUTRA agência→lança; sem prefixo→lança; traversal→lança). Testes existentes de upload migrados p/ a nova assinatura (mudança legítima, comportamento idêntico).
- **`vitest.config.ts`:** `testTimeout`/`hookTimeout` 20s (imports cold @rh/db/@supabase/ssr são lentos no Windows → evita flakes de timeout na suite completa).
- **Verde:** typecheck ✅ · web **111→116** · `next build` ✅ · Biome ✅. Sem rede (mock storage) · sem segredos.

## [2026-06-20 ~15:10] Ω-2 Bloco A1 — rate-limit no login (anti brute-force)
- **`lib/rate-limit.ts` (NOVO, lib pura):** `createLoginRateLimiter({maxAttempts,windowMs,lockoutMs}, now)` — janela deslizante de falhas por chave + lockout temporário. Relógio injetável (testes deterministas). Defaults: 5 falhas / 5 min de janela → 15 min de lockout. `check`/`recordFailure`/`recordSuccess` (sucesso limpa a chave). Interface `RateLimiter` pronta a trocar por Redis em prod (nota no topo: in-memory por-processo, não partilhado entre réplicas).
- **`lib/request-ip.ts` (NOVO):** `clientIp(req)` — 1.º IP do `x-forwarded-for`, fallback `x-real-ip`, senão `"unknown"` (fail-safe conservador). NOTA atacante: XFF é forjável pelo cliente; em prod atrás de proxy de confiança (Vercel) é controlado — defesa válida no v1 single-tenant.
- **`/api/auth/login`:** rate-limiter singleton de módulo. **Duas chaves** — `ip:<ip>` (varredura de contas) + `ip+email:<ip>|<email>` (brute-force de 1 conta). Pré-check por-IP ANTES de ler o body (trava scripts que nem mandam JSON; o malformado conta como falha por-IP). 401/inválido → `recordFailure`; sucesso → `recordSuccess`. **429 + `Retry-After`** (envelope inline `rate_limited` — NÃO inventei código no enum congelado de `@rh/core`, espelha o 401 inline do middleware).
- **`vitest.config.ts`:** alias `@ → ./` (espelha o `paths` do tsconfig) p/ os testes de route que importam por `@/lib/...`.
- **TDD (+10):** `rate-limit.test.ts` (+6: limite N+1; isolamento de chaves; sucesso limpa; lockout expira; janela deslizante; Retry-After decrescente) · `login-route.test.ts` (+4: 200 mock; 429 após 5 falhas mesmo com credenciais válidas; IPs distintos não partilham lockout; malformado 400 conta por-IP).
- **Verde:** typecheck ✅ · web **101→111** · `next build` ✅ · Biome ✅. Sem segredos · zero rede.

## [2026-06-20 ~14:10] Ω-4b — REMOVIDA a biometria facial (decisão IRIS: email/senha)
- Decisão do Mateus: a IRIS corre **só com email/senha** (Supabase real). A biometria (que a revisão de segurança reprovou e estava desligada) sai do projeto por completo, em vez de ficar como scaffolding morto.
- **Removidos:** `services/face/` (serviço Python inteiro), `apps/web/app/api/auth/face/` (rotas), `apps/web/lib/{face,face-capture,face-config}.ts`, `apps/web/test/{face,face-capture}.test.ts`.
- **Login limpo:** `app/login/page.tsx` reescrito — só email/senha (sem câmara/FacePanel/botão de rosto). `middleware.ts`: tira as rotas faciais da allowlist pública. `app/definicoes`: tira o cartão "Biometria". KEYS-TODO: biometria marcada REMOVIDA (reintroduzir = fast-follow com modelo real).
- **Verde:** typecheck ✅ · `next build` ✅ · **326 testes** (web 101) · Biome ✅.

## [2026-06-20 ~13:35] Ω-4 — Motor facial (services/face) + login por rosto (flash liveness)
- **`services/face` (FastAPI + numpy):** motor LEVE (sem dlib/mediapipe pesados — instalável) — `embedding` (descritor facial), `engine` (enroll/verify por distância), `liveness` (flash: a cor medida na pele tem de seguir o challenge), `challenge` (sequência de cores + token), `routes` (POST /enroll, /verify). **23 testes pytest verdes** (Python 3.14, numpy 2.4).
- **Web:** `app/api/auth/face/challenge` (emite sequência+token) + `app/api/auth/face` (verifica) + `lib/{face,face-capture,face-config}.ts` + `app/login` com captura REAL de câmara (getUserMedia + `<canvas>`, pisca as cores, mede a cor dominante) → **fallback gracioso para senha** sem câmara/serviço.
- **Config-not-code:** sem o serviço de rosto ligado → login facial cai no fallback de senha; ativa quando ligado (KEYS-TODO).
- **Verde:** typecheck ✅ · `next build` ✅ (+2 rotas face) · web **108 testes** · `services/face` **23 pytest** · Biome ✅.
- ⚠️ Fatia escrita pela sessão paralela mas NÃO committada (o processo do Claude Code saiu a meio). Eu verifiquei tudo (typecheck/build/**333 JS**+**23 py**/Biome) e committei. **Revisão de SEGURANÇA dedicada da biometria + auth a seguir** (anti-spoof/replay/threshold).

## [2026-06-20 ~13:05] Ω-3c — Auth REAL (@supabase/ssr) + FIM de Ω-3
- **`lib/supabase/server.ts` (NOVO):** `createSupabaseServerClient` (`@supabase/ssr`, ligado aos cookies do Next, try/catch no set p/ RSC read-only) + `AUTH_ENABLED` (`SUPABASE_URL`+`SUPABASE_ANON_KEY`).
- **`lib/supabase/middleware.ts` (NOVO):** `getSupabaseUserForMiddleware` (edge — valida o JWT via `getUser()`, propaga a rotação de cookies para a `NextResponse`).
- **`lib/recruiter-resolve.ts` (NOVO):** `resolveSessionByUserId(db, userId)` — `user.id` (auth.users) → recruiter+agência (`recruiter.userId`); sem vínculo → `null` (fail-closed).
- **`getSession` (config-not-code):** `AUTH_ENABLED` → `getUser()` + resolve via DB (user sem sessão/recruiter → erro ruidoso); sem env → shim de cookie atual.
- **Login route:** `AUTH_ENABLED` → `signInWithPassword` REAL (cookies de sessão pelo SSR); senão → mock. **401 uniforme** (nunca leak do erro Supabase).
- **Middleware:** agora `async`; `resolveSession` usa Supabase (import dinâmico só quando `AUTH_ENABLED`) ou shim; devolve a `response` com cookies rodados.
- **`scripts/seed-supabase-auth.ts` (NOVO, idempotente):** cria Filipa+Inês no GoTrue (admin API, `email_confirm`) e liga `recruiter.userId`; reaproveita user existente; password via `SEED_PASSWORD`. NUNCA produção.
- **Segurança:** `getUser()` (valida JWT no servidor) não `getSession()`; login usa anon key (service-role só no seed/storage); sem segredos hardcoded.
- **TDD (+2 integração DB):** `resolveSessionByUserId` (user ligado→sessão; sem vínculo→null). Sem env = comportamento atual (testes intactos).
- **Verde:** typecheck ✅ · web **95→101** · `next build` ✅ (middleware inclui @supabase/ssr só quando ligado) · Biome ✅.
- **Nota handover:** a dica "Demo: filipa@iris.tech (qualquer palavra-passe)" no `app/login` mantém-se (inócua em dev); remover no handover de chaves (já no KEYS-TODO).
- **✅ Ω-3 FECHADA** (3a compose Supabase · 3b Storage real · 3c Auth real). Tudo config-not-code, fallback mock sem env.

## [2026-06-20 ~12:45] Ω-3b — Storage REAL (Supabase Storage)
- **`lib/storage.ts`:** interface `StorageProvider` passou a **async** (`Promise<SignedUrl>` — o provider real faz I/O). `createMockStorage` adaptado (resolve de imediato, mesma forma de URL). **`createSupabaseStorage`** (NOVO): implementa `StorageProvider` sobre o `client.storage.from(bucket)` — `createSignedUploadUrl`/`createSignedUrl(ttl)`; erro do serviço → **lança** (sem silêncio); `expiresAt` calculado por `now`+ttl (injetável). Interface mínima `SupabaseStorageApi`/`BucketApi` injetável (testes sem rede).
- **`lib/storage-config.ts` (NOVO, server-only):** `getStorage()` config-not-code — `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY` → Supabase real (bucket `SUPABASE_STORAGE_BUCKET`|`vera-private`); sem env → `createMockStorage`. `STORAGE_ENABLED`. Service-role key NUNCA ao cliente; sem segredos hardcoded.
- **Deps:** `@supabase/supabase-js` + `@supabase/ssr` (este p/ Ω-3c) no `apps/web`.
- **TDD (client mockado, sem rede, +4):** upload→signed URL do serviço + `expiresAt`; download→`createSignedUrl(ttl)`; erro→lança; TTL default 300s. **Testes existentes do `createMockStorage`/upload atualizados p/ `await`** (mudança de assinatura legítima, comportamento idêntico).
- **Verde:** typecheck ✅ · web storage/upload **16** · `next build` ✅ · Biome ✅.

## [2026-06-20 ~12:30] Ω-3a — Supabase local no docker-compose (Auth+Storage)
- **`docker-compose.dev.yml`:** profile **`supabase`** (opcional — dev normal não precisa) com `auth` (GoTrue v2.158.1, email/senha), `rest` (PostgREST v12.2.3), `storage` (storage-api v1.11.13, buckets privados + signed URLs), `kong` (gateway :8000 = `SUPABASE_URL`). Todos apontam ao Postgres `db` já existente (`vera_dev`); GoTrue cria o schema `auth`, storage-api o `storage`. Volumes/healthcheck. JWT_SECRET/anon/service via env com defaults de dev (NUNCA produção).
- **`infra/supabase/kong.yml` (NOVO):** config declarativa do gateway (`/auth/v1`→auth, `/rest/v1`→rest, `/storage/v1`→storage) + CORS.
- **`.env.example`:** `SUPABASE_JWT_SECRET` + `SUPABASE_STORAGE_BUCKET` (default `vera-private`). Documentado: sem envs → web cai no shim de cookie + storage mock.
- **Como subir / criar Filipa+Inês no GoTrue:** instruções no topo do compose (`--profile supabase up -d` + script de seed). Nota Windows: se `kong`/`storage` não arrancarem, a app funciona com fallback mock — ficheiro correto para Linux/CI.
- **Verde:** `docker compose config --quiet` exit 0 (sintaxe válida). Não subi os contentores (Ω-3b/c usam client mockado nos testes).

## [2026-06-20 ~12:15] Ω-2 — Assistente REAL (motor LLM)
- **`@rh/ai features/assistant.ts` (NOVO):** `assistantPlan({message,candidatos,clienteNome,tools}, opts)` → `generate("ARCHITECT", …, planSchema, opts)` pede JSON `{reply, toolCalls:[{tool,args}]}`, **valida com Zod** (schema SEM `confirmed`), filtra tool-calls a ferramentas conhecidas (anti-alucinação). Reusa o gate ZDR + fallback do `runSlot`.
  - **Porquê em `@rh/ai` e não no web:** o `web` resolve `zod@4.3.6` (hoisted no monorepo pai) e o `@rh/ai` usa `zod@4.4.3` → schema definido no web é **incompatível** com o `generate<T extends z.ZodType>` do @rh/ai (tipos `$ZodTypeInternals` divergem). A feature vive no @rh/ai (Zod coerente), espelhando `judge.ts`.
- **`apps/web/lib/assistant/llm.ts` (NOVO):** thin wrapper `planResponseWithLlm({message,ctx,tools}, opts)` → `assistantPlan` → `ChatPlan` (mesma forma do mock keyword).
- **`run.ts` — config-not-code:** `planFor()` → `AI_ENABLED` (há `OPENROUTER_API_KEY`) → planner LLM (`aiOptions`); senão keyword mock. LLM falha (rede/parse/slot) → **degrada** para keyword mock (assistente nunca fica mudo; sem silêncio — degradação determinística).
- **PORTA DE CONFIRMAÇÃO INTACTA:** o LLM devolve só `{reply,toolCalls}` (sem `confirmed`); `run.ts` corre `executeToolCall({confirmed:false})` → `gravar`/`enviar_fora` ficam `pending_confirm`; só `confirmAction` (ação humana) executa. O LLM NUNCA contorna a porta.
- **TDD (transporte LLM mockado, sem rede):** @rh/ai +5 (valida plano; defaults toolCalls/args; filtra desconhecida; `enviar_email` planeado sem `confirmed`); web +4 (mapeia ChatPlan; `enviar_email` planeado; filtra desconhecida; Q&A vazio).
- **Verde:** typecheck (ai+web) ✅ · @rh/ai **35→40** · web **91→95** · Biome ✅. Sem segredos · zero chamadas pagas nos testes.

## [2026-06-20 ~11:55] Ω-1 (1d) — replay WS por seq/ack + FIM de Ω-1
- **`WsServer` (server.ts):** buffer de frames enviados por ligação (`state.sent`, anel limitado a **256** com `shift()` anti-DoS). No `ack {lastSeq}` → `#replay` reenvia os do buffer com `seq > lastSeq` (reconstruídos com o **seq original** → dedup do lado do cliente). Limpeza de ligação no `sock close` (sem leak de `#conns`).
- **`broadcast(payload)` (NOVO, público):** difunde um frame a todas as ligações autenticadas (ticks/sugestões/alertas) — é o que permite testar o replay e é a porta de saída real dos frames de servidor. v1 = single-tenant (1 recrutador/entrevista), sem filtro por `interviewId` (nota: apertar no multi-conn se necessário).
- **Protocolo respeitado:** usa `ack`/`lastSeq` (cliente→servidor) e `seq` por-ligação do `FrameSession` — **sem frames inventados**.
- **TDD (+2):** broadcast 3 frames (seq 2,3,4) → `ack{lastSeq:2}` reenvia só seq 3,4 (textos b,c); `ack` no topo → nada a reenviar.
- **Verde:** typecheck ✅ · ws **45→47** · `pnpm test` (com DB) **311 testes** · Biome ✅.
- **✅ Ω-1 FECHADA** (1a RGPD+migr.0002 · 1b posse REAL · 1c refresh JWT · 1d replay). +15 testes vs. base (296→311).

## [2026-06-20 ~11:50] Ω-1 (1c) — refresh/rotação de JWT (ws)
- **`apps/ws/src/refresh.ts` (NOVO, lib pura, exportada):** `issueWsToken` (JWT curto, TTL default **15 min**), `refreshWsToken` (re-emite SÓ a partir de um token verificável → **fail-closed**: expirado/forjado NÃO renova), `shouldRefresh({exp,now,thresholdSec})` (quando o servidor emite `auth.refresh_needed`).
- **Protocolo respeitado:** o congelado (`@rh/core`) tem o frame de SERVIDOR `auth.refresh_needed` mas **nenhum** frame cliente→servidor de refresh → **NÃO inventei frame**; a rotação é ao nível do token/endpoint (servidor sinaliza → cliente busca token novo via HTTP → reautentica com `auth`). Documentado no topo do ficheiro.
- **TDD (+8, sem rede/DB):** issue (exp=now+ttl; TTL default); refresh (renova+rotaciona; expirado→recusa; assinatura errada→recusa); shouldRefresh (longe→false; dentro do threshold→true; já expirado→true).
- **Verde:** typecheck ✅ · ws **37→45** · Biome ✅. Sem segredos (secret é parâmetro do env).

## [2026-06-20 ~11:40] Ω-1 (1b) — posse REAL do ws (@rh/db no entrypoint)
- **`apps/ws/src/ownership.ts` (NOVO):** `dbVerifyOwnership(db)` = `SELECT 1 FROM interview WHERE id=$1 AND recruiter_id=$2` (Drizzle `and(eq,eq)`, `.limit(1)`). `recruiter_id` = `sub` do JWT (já verificado por `createWsAuthenticate`). **Guarda UUID_RE** antes da query → `sub`/interviewId não-UUID (token forjado) devolve `false` em vez de rebentar o cast no Postgres.
- **config-not-code (`main.ts`):** `resolveConfig` lê `DATABASE_URL`; com URL → `createDb`+`dbVerifyOwnership` (posse REAL), sem URL → `mockVerifyOwnership` (dev/testes a €0). Pool fechado no shutdown (sem leak; `closing` guard idempotente). `startFromConfig` relaxado p/ `Pick<WsConfig,"port"|"secret">` (a posse é injetada).
- **`@rh/db`+`drizzle-orm` adicionados como dep do `apps/ws`** (a APP); a lib `@rh/ws` (`index.ts`) **continua SEM** `@rh/db` (`ownership.ts` não é exportado) → contrato `@rh/core` intacto.
- **TDD (DB local):** `test/ownership.integration.test.ts` (+4, `skipIf(!TEST_DATABASE_URL)`): dono→true; outro recruiter→false (4403); entrevista inexistente→false; `sub` não-UUID→false. +1 em `main.test.ts` (`resolveConfig` lê/limpa `DATABASE_URL`).
- **Self-review (atacante):** fail-closed mantido (`createWsAuthenticate` try/catch → 4401 se a query lançar); sem posse → 4403; sem segredos hardcoded; lib sem @rh/db.
- **Verde:** typecheck global ✅ · `pnpm test` (com DB) **301 testes** (ws 32→**37**) · sem DB: ws 33 pass/4 skip (modo CI) ✅ · Biome ✅ · **boot REAL** `WS_JWT_SECRET+DATABASE_URL pnpm start` → `[ws] posse: REAL (@rh/db)` ✅.

## [2026-06-20 ~10:30] Ω-1 (1a) — RGPD completo + migração 0002 (candidate_id)
- **Migração 0002:** `candidate_id` (nullable, FK→candidate, índice) em `async_job` E `interview`.
- **`purgeCandidate`** cobre agora: `async_job WHERE candidate_id` (PII no JSONB args); threads/mensagens/ações do assistente ligadas ao candidato (via `active_context->>'candidate_id'`); e **entrevistas ÓRFÃS** (`process_id NULL`, atribuídas por `interview.candidate_id`) + os seus filhos. Teste de integração estendido (órfã + thread + async_job; isolamento cross-agency mantém-se).
- **Reconciliação:** o teste de schema G1/G2 (que exigia `interview` SEM `candidate_id`) foi atualizado — `candidate_id` é uma **exceção RGPD documentada** para atribuir as órfãs (não-derivam o candidato do processo).
- **Verde:** typecheck · `next build` · **296 testes** (db 28, web 91, knowledge 10, ai 35, ws 32, desktop 44, core 37, ui 16, realtime 2, intake-bots 1) · Biome.
- **Nota infra (2026-06-20):** o Docker Desktop crashou pós-reboot (serviço `com.docker.service` parado → precisa de admin); o Mateus relançou-o com permissão de admin e a DB dev (`5433`) voltou. A sessão paralela escreveu este Ω-1 mas parou por **rate-limit do servidor** antes de testar/commitar — eu apliquei a migração, reconciliei o teste de schema e fechei a fatia.

## [2026-06-19] Ω-2 (parcial) — embedder REAL (commit `4e3bc66`)
- `createOpenAiEmbedder` (OpenAI text-embedding-3-small, dim 1536) atrás da interface `Embedder`; `getEmbedder` (web) config-not-code (`EMBEDDER_API_KEY` → real, senão mock). +5 testes (fetch mockado, sem rede).

---

# ═══ RESUMO FINAL — VERA v1 FASE 3 (build C–N) ═══
**[2026-06-19] Fases I→N TODAS VERDES. Produto demonstrável ponta-a-ponta SÓ COM MOCKS. Branch `phase3/product`.**

## O que foi construído (por fase)
- **C–H** (fundação, pré-resumo): monorepo pnpm + Biome/TS strict + Vitest; `@rh/db` (35 tabelas, migração 0000) + seed IRIS; `@rh/core` (enums, envelope, protocolo WS congelado, frames); intake (classifica→confirma→cria) + bots stub; FastAPI esqueleto (contrato); auth/sessão shim.
- **I** — `@rh/ui` (tokens "Apollo" + Card/Button/Chip/Tabs/Field/EmptyState/StateLight…) + shell web (NavBar, layout dark) + Telas 1–5/7 (pipeline, vaga, triagem, candidato, briefing, parecer).
- **J** — Desktop Electron endurecido (sandbox/contextIsolation/CSP/nav-allowlist/IPC-validation) + HUD overlay (semáforo/sugestão/chat) + reducer + mockFeed.
- **K** — `apps/realtime` (engine de ticks, frames, source) + libs web de entrevista (createInterview/transition CAS/join/report) + ticks (persistTick CAS) + resiliência (gaps, teto de custo, degrade).
- **L** — `@rh/ai` (match mock determinístico) + triagem/pipeline/briefing/parecer (libs + Telas) — vaga→triagem→briefing→parecer→submitted.
- **M** — Assistente (mock): tool registry + **porta de confirmação** (idempotência) → chat backend (planner+run, porta ENFORÇADA no route) → **Tela 9** (chat+artefactos+cartão de confirmação) → **memória durável** (recruiter_memory_fact) → **proativo** (prep/no-show/garantia/lacuna) → **Tela 10 comparar** (matriz).
- **N** — Login mock (Filipa+Inês, face/liveness desenhada) + middleware gate + **isolamento agency_id auditado** + 401 uniforme + **validador de upload** (magic-bytes/anti-traversal) + storage stub (signed URLs) + **purga RGPD em cascata** + **Tela 12 Definições** + **endurecimento DB** (CHECK+índices+UNIQUE, migração 0001) + **entrypoint ws** (arrancável) + **CI gates**.

## Testes (291, todos verdes) · `pnpm test` com DB local
web 91 · desktop 44 · ai 35 · core 37 · db 28 · ws 32 · ui 16 · knowledge 5 · realtime 2 · intake-bots 1. typecheck ✅ · build ✅ · Biome ✅.

## DEMONSTRÁVEL ponta-a-ponta SÓ COM MOCKS
- **Desktop**: overlay pinta o feed mock → sugestão + semáforo + chat.
- **Entrevista golden** (mock) → ticks → parecer.
- **Web**: vaga → triagem → briefing → parecer → submitted (sem ecrã branco; 3 estados UX).
- **Assistente**: Q&A · comparação · "envia email"→cartão de confirmação (só envia após OK) · facto→memória · proativo dispara prep.
- **Login mock** entra (Filipa+Inês) · Definições · servidor WS arranca (`tsx apps/ws/src/main.ts`).

## Handover (NÃO feito neste loop — é do Mateus)
👉 **`KEYS-TODO.md`** — todas as chaves/serviços a ligar (Supabase auth+storage, STT/Soniox, LiveKit, biometria, LLM lince-brain) + a secção Ω/fast-follow dos itens deferidos. **Merge do PR só após o handover de chaves.**

---

## [2026-06-19 ~22:44] iteração 62 — 🚧 FASE N (8/N): seed Inês (já feito) + CI gates → FASE N FECHADA

**Seed Inês:** já estava completo — `packages/db/src/seed.ts` insere Filipa **e Inês** (`recruiterInes` = `22222222-…-002`, = `INES_RECRUITER_ID` em `auth.ts`) com `onConflictDoNothing`; **confirmado vivo no dev-DB** (`name: "Inês"`). O login da Inês funciona 100%. Sem alteração de código.

**Feito — CI gates:** `.github/workflows/ci.yml` (push + PR) — checkout + pnpm@10.32.1 (auto do packageManager) + Node 24 + `install --frozen-lockfile` → `pnpm typecheck` · `pnpm lint` (Biome) · `pnpm build` · `pnpm test`. **ZERO segredos** no workflow.

**SIMULA/CORRE (como o CI, SEM DB):** `pnpm test` sem `TEST_DATABASE_URL` → **50 passados / 41 saltados** no web (DB-integração saltam via `describe.skipIf`, NÃO falham) + ai 35 + ws 32 + desktop 44 + realtime 2 + knowledge 3/2-skip + ui 16. `pnpm typecheck` exit 0 · `pnpm lint` limpo (276 ficheiros) · `pnpm build` ✓ · YAML válido (sem tabs).

**Self-review (CI/seed):** sem segredos no YAML; testes DB saltam (não falham); Inês já seedada. → sem review dedicado.

### ✅ FASE N FECHADA (menos os Ω deferidos documentados). FASES I→N TODAS VERDES.
**PRÓXIMA ITERAÇÃO = STOP FINAL:** RESUMO no topo + `KEYS-TODO.md` + memória + PR + PushNotification.

**Commit:** <hash>

---

## [2026-06-19 ~22:24] iteração 61 — 🚧 FASE N (7/N): entrypoint do servidor WS (apps/ws arrancável)

**Contexto:** `apps/ws` já tinha o `WsServer` (handshake auth, close 4401/4403, `FrameSession`), `createWsAuthenticate` (JWT HS256 real + posse), jwt/codec + **testes do handshake** (server.test.ts). Faltava SÓ o entrypoint executável.

**Feito (`apps/ws`):**
- `src/main.ts` (NOVO) — `resolveConfig(env)` (porta `WS_PORT` def 18792 + `WS_JWT_SECRET`, **sem segredo hardcoded**), `mockVerifyOwnership` (v1: par não-vazio → ok; o real liga ao @rh/db a montante), `startFromConfig` (liga `createWsAuthenticate`+`WsServer`, testável), `main()` (aborta se faltar segredo → exit 1; `127.0.0.1` only; logs; SIGINT/SIGTERM → close; **guard `import.meta` p/ não correr quando importado**).
- `package.json` — script `start: tsx src/main.ts` (+tsx devDep, já no monorepo).
- `test/main.test.ts` (+6) — resolveConfig; mockVerifyOwnership; **boot real** (JWT HS256 válido → auth.ok+interview.active; token inválido → 4401).

**SIMULA/CORRE:** `tsx src/main.ts` arranca → `[ws] a ouvir em ws://127.0.0.1:PORT` ✅; sem `WS_JWT_SECRET` → aborta (exit 1) ✅.

**Verde:** typecheck ✅ · ws **32 testes** (+6) · `pnpm -r` (ui 16 + knowledge 5 + realtime 2 + desktop 44 + web 91 + ws 32) · Biome ✅.

**Self-review (wrapper de boot; core já revisto):** segredo via env (fail-closed), localhost-only, guard de import, posse mock documentada. → sem review dedicado (o auth/handshake/close-codes estão no `server.ts`/`auth.ts` já revistos + 32 testes).

**DEFERIDOS p/ FASE Ω (com justificação — gold-plating no v1 mock):** WS replay/snapshot (protocolo congelado SEM `snapshot.request`; `seq` é por-ligação; v1 usa mock feed no desktop), `chat.answer` frame (o chat do assistente é HTTP no v1), refresh de JWT (token único no v1), posse real (liga @rh/db ao handshake).

**FASE N — quase fechada.** Falta: seed Inês (2.º recrutador) + CI gates → depois STOP FINAL.

**Commit:** <hash>

---

## [2026-06-19 ~22:04] iteração 60 — 🚧 FASE N (6/N): endurecimento DB (constraints + índices) — migração 0001

**Feito (`packages/db`):** migração `0001_confused_weapon_omega.sql`:
- **CHECK** `interview_status_chk` (status ∈ scheduled|live|done|unstructured) + `interview_capture_type_chk` (capture_type NULL ou ∈ bot_online|local_mic|none).
- **Índices compostos**: `interview_agency_status_idx (agency_id,status)` + `interview_agency_recruiter_idx (agency_id,recruiter_id)` (substituem o `interview_status_idx` solto).
- **UNIQUE(interview_id, tick_n)** em `interview_tick` (`interview_tick_interview_tickn_uidx`, substitui o índice não-único).

**Processo seguro (sem forçar):** gerei → INSPECIONEI o SQL → **verifiquei o dev-DB** (243 ticks/388 entrevistas: **0 duplicados, 0 status inválidos, 0 capture_type inválidos**) → apliquei (`db:migrate`) → confirmei.

**Verde:** typecheck (db+web) ✅ · web **91 testes** (+3: 2.º tick mesmo n→erro; status inválido→erro; capture_type inválido→erro / NULL ok) — provam as constraints VIVAS · `pnpm -r` (knowledge 5 + desktop 44 + realtime 2 + web 91) · Biome ✅.

**Self-review (migração):** additiva (índices+checks, sem drop de coluna/dados); 0 violações verificadas ANTES de aplicar; valores das constraints batem com o schema/código; provada viva por testes. → sem review dedicado.

**Próximo (FASE N):** entrypoint ws + refresh JWT + WS replay/snapshot + chat.answer frame; (tabelas biometria + colunas RGPD candidate_id = outra migração, opcional); seed Inês; CI gates. **Falta ws para fechar a FASE N.**

**Commit:** <hash>

---

## [2026-06-19 ~21:44] iteração 59 — 🚧 FASE N (5/N): Tela 12 — Definições (UI)

**Feito (`apps/web`):**
- `lib/definicoes.ts` (puro) — `RETENTION_DEFAULTS` (alavancas RGPD §3: 30/90/30 dias) + `appEnvironment(NODE_ENV)`.
- `app/definicoes/page.tsx` (server) — 4 secções: **Conta** (nome do recrutador via getSession+query agency-scoped + `LogoutButton`), **Biometria** (estado mock "Rosto inscrito · sem câmara"), **Privacidade & Retenção (RGPD)** (prazos sugeridos, leitura), **Sobre** (versão+ambiente).
- `app/definicoes/LogoutButton.tsx` (client) — POST logout → /login.
- Link "Definições" na navbar.

**Verde:** typecheck ✅ · `next build` ✅ (+`/definicoes`) · web **88 testes** (+2 `appEnvironment`/`RETENTION_DEFAULTS`) · `pnpm -r` (desktop 44 + realtime 2 + web 88) · Biome ✅.

**Self-review (UI):** server-render, getSession (gated pelo middleware), nome do recrutador agency-scoped, alavancas RGPD só-leitura, biometria mock; LogoutButton espelha o padrão da navbar; sem escrita/segredo → sem review dedicado.

**Próximo (FASE N):** endurecimento DB (CHECK status/capture_type + índices (agency_id,status)+(agency_id,recruiter_id) + UNIQUE(interview_id,tick_n) + tabelas biometria + colunas RGPD) — 1 migração, CUIDADO com cruft do dev-DB; entrypoint ws + refresh/replay; seed Inês; CI.

**Commit:** <hash>

---

## [2026-06-19 ~21:26] iteração 58 — 🚧 FASE N (4/N): purga RGPD em cascata (direito ao esquecimento)

**Feito (`apps/web/lib/rgpd.ts`, TDD DB):** `purgeCandidate(db, agencyId, candidateId)` — HARD delete em CASCATA, numa transação, **isolado por agência** (cross-agency = no-op). Apaga a subárvore PII filhos→pais: process → interview → [tick, gap, participant, report, transcript_chunk(+embedding cascade), contradiction-por-chunk] ; process-children [client_verdict, placement_outcome, agenda_event, contradiction] ; candidate_memory_fact(+embedding), source_doc(+embedding), document (null do self-ref `based_on` antes) ; **PII polimórfica sem FK**: proactive_task (por target candidate/process/interview) + intake_message (por alvo/entity). Devolve `{removed: {tabela:n}}`.

**Verde:** typecheck ✅ · `next build` ✅ · web **86 testes** (+2: cenário completo→tudo removido incl. proactive_task+intake_message; cross-agency intacto) · `pnpm -r` (desktop 44 + realtime 2 + web 86) · Biome ✅.

**Code-review DEDICADO (database-reviewer, completude da cascata):** confirmou os 3 `onDelete:cascade` (embeddings), isolamento, transação. **Encontrou GAPS de PII órfã → CORRIGIDOS:** proactive_task (CRITICAL) + intake_message (CRITICAL) agora apagados; contradiction-por-chunk apagada ANTES dos chunks (evita violação FK).

**⚠️ GAPS DE COMPLETUDE RGPD DEFERIDOS (precisam de schema/Ω — fechar antes de PII real):**
1. `async_job.args` (JSONB com refs do candidato, sem coluna `candidate_id`) → adicionar coluna `candidate_id` no insert dos jobs candidate-bound, ou apagar por predicado JSONB.
2. `assistant_message.content` (texto livre que mencione o candidato) → scrub fino = Ω (assistente real).
3. Entrevistas órfãs (`process_id IS NULL`) — sem `candidate_id` na `interview`, não são atribuíveis ao candidato (limitação de schema; ponderar coluna `candidate_id` em `interview`).

**Próximo (FASE N):** Tela 12 Definições + tabelas biometria (mock); endurecimento DB (CHECK + índices + UNIQUE); entrypoint ws + refresh/replay; seed Inês; CI.

**Commit:** <hash>

---

## [2026-06-19 ~21:02] iteração 57 — 🚧 FASE N (3/N): validador de upload (CV) + signed URLs (stub)

**Feito (`apps/web/lib`, puro/TDD):**
- `upload.ts` — `validateUpload({filename, mime, sizeBytes, header})`: tamanho inteiro finito ∈ (0,10MB]; MIME allowlist ESTRITA (pdf/docx/doc; SVG/HTML/exe bloqueados); extensão === mime; **magic-bytes OBRIGATÓRIOS** (o conteúdo manda — apanha `cv.exe.pdf` com bytes de .exe); `storageKey = UUID.ext` gerado no servidor (anti path-traversal); `displayName` saneado (basename).
- `storage.ts` — `StorageProvider` (signedUpload/DownloadUrl) + `createMockStorage(now)` stub: `mock://vera-private/<key>?exp&sig` (sig fake não-secreta, `now` injetado, TTL 300s). Real Supabase/S3 (bucket privado por agência) = Ω atrás da interface.
- (Sem rota de upload ainda → libs prontas p/ ligar; o intake v1 é texto.)

**Verde:** typecheck ✅ · `next build` ✅ · web **84 testes** (+12: pdf ok; .exe/mismatch/dupla-ext/sem-magic/NaN/>MAX/vazio rejeitam; path-traversal→UUID; signed URL ttl/sig) · `pnpm -r` (desktop 44 + realtime 2 + web 84) · Biome ✅.

**Security-review** (dedicado, olho de atacante): **0 CRITICAL/HIGH** · path-traversal estruturalmente impossível (UUID), ReDoS nil, storage stub sem injeção/segredo. **3 MEDIUM corrigidos:** magic-bytes passam a OBRIGATÓRIOS (fecha dupla-extensão `cv.exe.pdf` + content-spoofing); guarda `Number.isInteger` (NaN/decimal); JSDoc Content-Disposition + zip-bomb(Ω). +regressões (maiúsculas, sem-magic, NaN).

**Próximo (FASE N):** purga RGPD em cascata (TDD DB); Tela 12 Definições + biometria (mock); endurecimento DB (CHECK + índices + UNIQUE); entrypoint ws + refresh/replay; seed Inês; CI.

**Commit:** <hash>

---

## [2026-06-19 ~20:42] iteração 56 — 🚧 FASE N (2/N): auditoria de isolamento agency_id + 401 uniforme das /api

**Auditoria (a):** as **17 rotas** `app/api/**/route.ts` obtêm `agencyId`/`recruiterId` SÓ via `getSession()` — **nenhuma** os aceita do body/query (confirmado por grep + security-review). Isolamento por agência: ✅ sem desvios.

**Feito (b) — 401 uniforme centralizado:**
- `lib/api.ts` (NOVO) — `sessionFromCookies(get)` puro/edge-safe (exige `vera_agency`+`vera_recruiter`; senão null).
- `middleware.ts` — gate ÚNICO: `/api` sem sessão → **401 JSON** (envelope @rh/core inline) exceto `isPublicApi` (== `/api/health` OU == `/api/auth/login`); páginas → /login; matcher passa a incluir /api.
- `lib/session.ts` — `getSession` reusa `sessionFromCookies` + fallback DEV (guardado: em produção sem sessão → erro, não silencia como Filipa).

**Verde:** typecheck ✅ · `next build` ✅ (Middleware) · web **72 testes** (+4 `sessionFromCookies`) · `pnpm -r` (desktop 44 + realtime 2 + web 72) · Biome ✅.

**Security-review** (dedicado): **0 CRITICAL/HIGH** · confirmado sem bypass (`/api/authxyz` não fura), envelope 401 correto, edge-safe, 17 rotas protegidas, sem server-actions, redirect sem open-redirect. **2 MEDIUM corrigidos:** (1) fallback DEV agora lança em produção; (2) `/api/auth/logout` deixa de ser público (evita forced-logout — exige sessão). LOW matcher `_next/*` = sem impacto (App Router).

**Próximo (FASE N):** validador de upload + URLs assinadas (stub) + purga RGPD em cascata; Tela 12 Definições + biometria (mock); endurecimento DB (CHECK + índices + UNIQUE); entrypoint ws + refresh/replay; seed Inês.

**Commit:** <hash>

---

## [2026-06-19 ~20:24] iteração 55 — 🚧 FASE N (1/N): LOGIN MOCK + gate de sessão — "login mock entra" ✅

**Feito (`apps/web`):** o gate final do demo:
- `lib/auth.ts` (NOVO) — `verifyMockLogin({email,password})`: SEED_USERS IRIS (filipa@/ines@iris.tech → MESMA agência) — email seed + password não-vazia → utilizador; **zero segredos** (password real = Supabase Ω).
- `app/api/auth/login/route.ts` (POST, Zod) — set cookies `vera_agency`/`vera_recruiter` (httpOnly, sameSite lax, secure-em-prod, **maxAge 8h**) **do utilizador resolvido no servidor** (o input só escolhe ENTRE os 2 seed; não forja agency/recruiter). `logout` (delete cookies).
- `app/login/page.tsx` — login dark: **face mock** (SVG + pulse de liveness, SEM webcam) + email/senha; 3 estados UX.
- `middleware.ts` — sem sessão → /login; com sessão em /login → /. **Gate de páginas** (matcher exclui /api+estáticos; 401 das /api = N2).
- `NavBar` — botão "Sair" (logout).

**Verde:** typecheck ✅ · `next build` ✅ (+`/login`, `/api/auth/login|logout`, **Middleware**) · web **68 testes** (+4 `verifyMockLogin`) · `pnpm -r` (desktop 44 + realtime 2 + web 68) · Biome ✅.

**Security-review** (dedicado): **0 CRITICAL, 0 HIGH** · confirmado: identidade NÃO-forjável pelo input, ZERO segredos, middleware sem open-redirect/loop, Zod suficiente. **MEDIUM corrigido** (maxAge 8h → a sessão expira). LOW: hint de demo no DOM ("filipa@…") = **intencional** (aid do mock; remover no handover de auth real); CSRF logout coberto por sameSite=lax.

**Notas:** (1) Inês (`INES_RECRUITER_ID`) precisa de uma linha `recruiter` no seed p/ login dela funcionar a 100% — **TODO seed** (o demo usa a Filipa, seeded). (2) cookie-trust (sessão sem assinatura) = limitação v1 aceite → auth real Supabase = Ω.

**Próximo (FASE N):** agency_id audit (`withAgencySession` em TODAS as rotas) + **401 uniforme das /api** (N2); upload validator + URLs assinadas + purga RGPD; Tela 12 Definições + biometria (mock); endurecimento DB; ws entrypoint/refresh/replay.

**Commit:** <hash>

---

## [2026-06-19 ~20:06] iteração 54 — 🚧 FASE M (6/N): Tela 10 — comparar (matriz requisitos×candidatos)

**Feito (`apps/web`):**
- `lib/comparar.ts` (NOVO) — `buildComparisonMatrix(db, agency, jobId, candidateIds?)` → {requisitos[], columns[{candidato, matchScore, cells[{requisito, status}]}]}. **Reusa `triageVaga`** (cobertos/faltantes) → coberto→`coberto-com-prova`, senão `não-tocado` (raso/contradito pedem prova real → Ω). Isolado por agency.
- `app/comparar/page.tsx` (Tela 10) — matriz visual (linhas=requisitos, colunas=candidatos, células=Chip por `RequisitoStatus`); entra via `?job=<id>&c=id1,id2`; estados vazios (sem vaga / sem candidatos).
- `app/vagas/[id]/triagem` — link "⊞ Comparar candidatos →" (quando há candidatos).

**Verde:** typecheck ✅ · `next build` ✅ (+`/comparar`) · web **64 testes** (+2: matriz status por célula; vaga inexistente→vazia) · `pnpm -r` (desktop 44 + realtime 2 + web 64) · Biome ✅.

**Self-review (read-only + UI):** `buildComparisonMatrix` reusa o `triageVaga`/`getVaga` (agency-scoped) → o `?c=` só mostra candidatos já devolvidos pela triagem da agência (sem fuga cross-agency); sem escrita/chamada externa → sem review dedicado.

**FASE M:** núcleo ✅ + Tela 10 ✅. Telas 8 (Q&A) / 11 (onboarding) = opcionais (fora do STOP FINAL). **PRÓXIMO: ARRANCAR A FASE N** — login mock (gate final do demo) primeiro.

**Commit:** <hash>

---

## [2026-06-19 ~19:50] iteração 53 — 🚧 FASE M (5/N): PROATIVO (mock) — aceitação "proativo→prep" ✅ · NÚCLEO DE M COMPLETO

**Feito (`apps/web`):**
- `lib/assistant/proactive.ts` (NOVO, PURO) — `buildProactiveCards(events, now)` → cartões prep/no-show/garantia/lacuna. `now` é PARÂMETRO (sem Date.now() escondido). Janelas: prep <60min, garantia <7d (urgente <2d). Ordena por severidade (urgente 1.º).
- `lib/assistant/proactive-feed.ts` (NOVO) — `mockProactiveEvents(now)` (feed determinístico, 4 eventos demo).
- `app/page.tsx` (Home/Tela 1) — secção **"Sugestões proativas"** (server-render dos 4 cartões; vazio = "Tudo em dia ✓").

**Verde:** typecheck ✅ · `next build` ✅ · web **62 testes** (+7: cada regra dispara o cartão certo; fora-da-janela→nada; ordenação; feed mock→4 cartões) · `pnpm -r` (desktop 44 + realtime 2 + web 62) · Biome ✅.

**Self-review (lógica pura + UI informativa):** `buildProactiveCards` puro/determinístico (`now` param, 7 testes); Home chama `Date.now()` 1× no render (app code); sem escrita DB / chamada externa → sem review dedicado.

### ✅ NÚCLEO DE M (assistente+proativo) COMPLETO — aceitação cumprida:
Q&A/comparação ✅ · envia→cartão de confirmação (só envia após OK) ✅ · facto novo→memória ✅ · **proativo dispara prep** ✅.
**Telas 8 (Q&A por entidade) / 10 (comparar matriz) / 11 (onboarding)** = polimento opcional (NÃO no critério do STOP FINAL). **Próximo grande bloco: FASE N** (login mock — é o que falta para o demo ponta-a-ponta — + segurança/RGPD/endurecimento DB). Faço Tela 10 (comparar, mais valor de demo) e depois arranco a FASE N.

**Commit:** <hash>

---

## [2026-06-19 ~19:34] iteração 52 — 🚧 FASE M (4/N): memória durável do recrutador (`recruiter_memory_fact`) — aceitação "facto novo→memória" ✅

**Feito (`apps/web/lib/assistant`):**
- `memory.ts` (NOVO) — `saveMemoryFact` (valida texto 1–2000 + `kind` ∈ enum; isolado agency+recruiter) · `listMemoryFacts` · `searchMemoryFacts` (recall por `ILIKE`, valor parametrizado; SEM vetorial — isso é Ω).
- `chat.ts` — intent `save_memory_fact` ("anota/lembra-te/regista/memoriza/guarda que…") com `extractFact` → o texto do facto vai nos args.
- `run.ts` — `confirmAction`: a tool `save_memory_fact` (efeito `gravar`, já passa pela porta) **persiste mesmo** o facto na confirmação; se a gravação falhar → marca `failed` (a UI não finge sucesso).

**Verde:** typecheck ✅ · `next build` ✅ · web **55 testes** (+3: planner memória; save/list/search isolado; "anota que X"→pending→confirma→recall) · `pnpm -r` (desktop 44 + realtime 2 + web 55) · Biome ✅.

**Code-review** (dados do recrutador → isolamento): **0 CRITICAL, 3 HIGH** → **corrigidos:** (1) gravação silenciosa de texto vazio → agora `saveMemoryFact` valida e `confirmAction` marca `failed`; (2) sem `.max` no `factText` → bound 2000 na fronteira; (3) two-phase write (CAS done→insert) → try/catch marca `failed` (transação atómica = nota Ω). +MEDIUM `kind` validado contra o enum. **Confirmado: isolamento agency+recruiter em save/list/search; só grava via porta.** LOW índice `(agency_id,recruiter_id)` → **FASE N** (lote de endurecimento DB).

**A fazer (FASE M):** proativo (prep/no-show/guarantee/lacunas — mock); Tela 8 Q&A; Tela 10 comparar; Tela 11 onboarding. (Recall na conversa Q&A = nota: passar factos no `ctx` numa próxima fatia.)

**Commit:** <hash>

---

## [2026-06-19 ~19:14] iteração 51 — 🚧 FASE M (3/N): UI Tela 9 — assistente (chat + artefactos + cartão de confirmação)

**Feito (`apps/web`):** a Tela 9 demonstrável:
- `app/assistente/page.tsx` (server) + `AssistantChat.tsx` (client) — **chat** (histórico + input → POST `/api/assistant/chat`), **rail** com "Contexto ativo" (placeholder) + **Artefactos** (resultRef das ações done), e a porta na UI.
- `ConfirmationCard.tsx` (puro) — para ações `pending_confirm`: [Confirmar]→POST `{confirmActionId}` / [Cancelar] (local, deixa a ação pendente, nunca executa). A UI **nunca** envia `confirmed` → não fura a porta.
- `efeito-label.ts` — `efeitoVerbo` (linguagem humana do efeito), pura/testável.
- Link "Assistente" na navbar. 3 estados UX (vazio com sugestões, a-pensar, erro).

**Verde:** typecheck ✅ · `next build` ✅ (**24 rotas**, +`/assistente` ~105 kB) · web **52 testes** (+3 `efeitoVerbo`) · `pnpm -r test` (desktop 44 + realtime 2 + web 52) · Biome ✅.

**Self-review (UI, §7):** confirm POSTa `{confirmActionId}` → o backend (`confirmAction`, revisto em M2) é que ENFORÇA a porta; a UI nunca seta `confirmed`. Cancelar = local, não executa. Estado imutável (spread). Espelha o padrão `StartInterviewButton`. → sem review dedicado.

**⚠️ NOTA p/ próximas fatias de UI (Telas 8/10/11):** render-tests de `.tsx` **não correm** no `apps/web` (tsconfig Next = `jsx: preserve` → o bundler de teste não transforma JSX em node; `esbuild.tsconfigRaw`/`jsx:automatic` NÃO resolveram). **Padrão:** extrair a lógica pura para um `.ts` (sem JSX) e testar ESSE; o JSX é auto-revisto. (No `@rh/ui` os render-tests funcionam porque o tsconfig é `react-jsx`.)

**A fazer (FASE M):** Tela 8 Q&A por entidade; Tela 10 comparar (matriz); Tela 11 onboarding; memória durável; proativo.

**Commit:** <hash>

---

## [2026-06-19 ~18:58] iteração 50 — 🚧 FASE M (2/N): chat do assistente — planner + orquestrador + route (ENFORÇA a porta)

**Feito (`apps/web`):** o backend do chat (a porta é ENFORÇADA aqui):
- `lib/assistant/chat.ts` — **`planResponse`** (planner MOCK puro: intenção por palavras-chave → {reply, toolCalls}; comparar/enviar_email/rascunhar/planilha/sourcing/agenda; senão Q&A). SEM LLM (real = Ω).
- `lib/assistant/run.ts` — **`runMessage`** (persiste msg, planeia, corre cada tool com `executeToolCall(confirmed:FALSE)` → leitura=done / gravar+enviar_fora=**pending_confirm** persistido) + **`confirmAction`** (CAS atómico pending→done com TODAS as colunas de isolamento; só DEPOIS corre a tool com `confirmed:true`; idempotente; trata `failed`).
- `app/api/assistant/chat/route.ts` — POST `z.union([{confirmActionId},{message,threadId?}])`; **o body NÃO tem `confirmed`** → o modelo/cliente não o pode forjar; `confirmAction` é o ÚNICO caminho que corre uma tool `gravar`/`enviar_fora`.

**Verde:** typecheck ✅ · `next build` ✅ (**23 rotas**, +/api/assistant/chat) · web **49 testes** (+7: planner intenção; runMessage leitura→done / enviar_fora→pending; confirma idempotente) · `pnpm -r test` verde · Biome ✅.

**Code-review** (code-reviewer, fatia SENSÍVEL): **1 CRITICAL + 2 HIGH.** **Corrigidos:** CRITICAL (executor a falhar após o claim → marca `failed`, não fica preso em `done`); HIGH `ensureThread` filtra `recruiterId` (anti-adoção de thread); +MEDIUM (CAS com agency+recruiter atómico; `idempotencyKey` passado ao executor) +LOW (route try/catch→404 sem stack). **Confirmado: SEM bypass da porta** (runMessage sempre confirmed:false; body sem `confirmed`; confirmAction é o único confirmed:true). **Deferidos com nota:** HIGH session-shim por cookie (é o shim da FASE H; auth real = **FASE N**; v1 single-tenant 2-user IRIS) + `argsSchema` Zod por tool (Ω).

**A fazer (FASE M):** UI **Tela 9** (chat+artefactos+cartão de confirmação→re-POST confirm); Telas 8/10/11; memória durável; proativo.

**Commit:** <hash>

---

## [2026-06-19 ~18:42] iteração 49 — 🚧 FASE M (1/N): núcleo seguro do assistente — tool registry + porta de confirmação

**Feito (`apps/web/lib/assistant/`):** o núcleo seguro do assistente ("ChatGPT dela"), puro e mock:
- `tools.ts` — **tool registry** (13 ferramentas com efeito canónico `@rh/core` + executor MOCK puro): `leitura` (search_knowledge/comparar_candidatos/ler_agenda/pesquisa_web/gen_spreadsheet/gerar_cv/rascunhar_email — gerar≠guardar), `gravar` (save_artifact/save_memory_fact/sourcing), `enviar_fora` (enviar_email/marcar_agenda/por_bot_na_call). `getTool`.
- `gate.ts` — **porta de confirmação** `requiresConfirmation(efeito)` (= gravar|enviar_fora) + `executeToolCall(call, store)`: tool desconhecida→não executa; gravar/enviar_fora sem `confirmed`→`needs_confirm`; **idempotência** (gravar+enviar_fora) com a chave marcada **só após sucesso**; executor que lança→`failed` (chave não queimada→retry possível). `IdempotencyStore` (interface; mock=Set; real=DB).

**Verde:** typecheck ✅ · `next build` ✅ · web **42 testes** (+8: efeitos, registry, porta sem/com confirmação, idempotência gravar+enviar_fora) · Biome ✅.

**Code-review** (code-reviewer, fatia sensível): **0 CRITICAL, 3 HIGH — todos corrigidos:** (1) idempotência alargada a `gravar` (criar 2× não duplica); (2) a chave só é "queimada" APÓS o executor ter sucesso (+arm `failed` no union — evita perder um envio num throw); (3) `confirmed` com aviso ⚠️ de fronteira de confiança (SÓ a route/UI a põe true, nunca o JSON do modelo). +MEDIUM (comentário do sourcing). Confirmado: **sem bypass** da porta (o efeito vem do registry, não do input); mapeamento dos 13 efeitos correto. Deferido (Ω): `argsSchema` Zod por tool (validação no adapter).

**A fazer (FASE M):** assistant chat (mock ReAct intenção→resposta+tool-calls) + `/api/assistant/chat` (ENFORÇA a porta: `confirmed` só vem da UI) + UI Tela 9 (chat+artefactos+cartão de confirmação); Telas 8/10/11; memória durável; proativo.

**Commit:** <hash>

---

## [2026-06-19 ~18:28] iteração 48 — ✅ FASE L COMPLETA: Tela 1 (dashboard/kanban) — painel Antes→Depois v1 inteiro

**Feito (`apps/web`):** o "QG" da recrutadora — fecha a FASE L:
- `lib/pipeline.ts` **`listPipeline`** (processos com nome do candidato + título da vaga via innerJoin; isolado por agency; exclui apagados).
- `app/page.tsx` (home = Tela 1) — **kanban** por etapa (`processStage`: Novos→Triados→Entrevistar→Enviados→Entrevista cliente→Oferta→Colocado), cartões (`@rh/ui` Card/Chip) com candidato+vaga + link p/ detalhe; `EmptyState` com CTA se vazio.

**Verde:** typecheck ✅ · `next build` ✅ (home dinâmica) · web **34 testes** (+2: listPipeline join+isolamento) · `pnpm -r test` verde · Biome ✅.

🎉 **FASE L ("Painel web Antes→Depois") COMPLETA** — as 6 telas v1 (1 dashboard, 2 vaga, 3 triagem, 4 candidato, 5 briefing, 7 parecer) navegáveis em dark Apollo, reusando `@rh/ui`, com 3 estados UX. **Aceitação L cumprida:** percorrer dashboard→vaga→triagem→candidato→briefing→▶iniciar→parecer SEM ecrã branco. (Telas 8–12 = FASE M/N.)

**Self-review (fatia UI+lib):** join + isolamento por agency testados; kanban agrupa pelo enum canónico; EmptyState; zero `as` cego.

**A fazer:** **FASE M** — Assistente ("ChatGPT dela") + proativo (mock): motor ReAct em `services/agent` (esqueleto FastAPI já existe), porta de confirmação, tool registry+executor MOCK, memória, onboarding, proativo, UI Telas 8/9/10/11. Depois FASE N (auth/biometria/definições/segurança/RGPD + endurecimento DB deferido).

**Commit:** <hash>

---

## [2026-06-19 ~18:16] iteração 47 — 🚧 FASE L (5/N): Tela 7 (parecer — abas Interna/Cliente + export md)

**Feito (`apps/web`):** o "Depois" do ciclo (reusa `gerarParecer` da FASE E):
- `app/interviews/[id]/parecer/ParecerTabs.tsx` (client) — **abas Interna/Cliente** (`@rh/ui` Tabs): renderiza o `Parecer` estruturado de `@rh/core` — veredito, **critérios com citação+timestamp** (ou "⬜ não confirmado — recomendo perguntar" quando null), forças, riscos (vista interna), logística/ângulo de venda/credenciais (vista cliente), fiabilidade (intervalos não-capturados), fontes.
- `app/interviews/[id]/parecer/page.tsx` (server) — `getInterview` (isolamento+notFound) + `gerarParecer` + **export md** (`<a>` → GET /api/parecer?interviewId=).
- `StartInterviewButton` agora mostra "Ver parecer →" após iniciar → o fluxo **briefing→iniciar→parecer** fica navegável no web.

**Verde:** typecheck ✅ · `next build` ✅ (**22 rotas**, +/interviews/[id]/parecer) · web **32 testes** (sem lib nova — reusa `gerarParecer`/`getParecerMd` já testados) · Biome ✅.

**Self-review (fatia UI):** renderiza o Parecer já validado por Zod (buildParecer); citações honestas (assinala não-confirmado); export via GET seguro; `notFound`; zero `as` cego. write-on-GET idempotente (report.interview_id UNIQUE + onConflictDoUpdate) anotado como simplificação v1 (editar/preparar-email = follow-up).

> 🎯 **Fluxo "Antes→Depois" v1 navegável no web:** vaga→triagem→candidato→briefing→▶iniciar→parecer (sem ecrã branco). Falta a **Tela 1 (dashboard/kanban)** para o "QG" e depois M/N.

**Commit:** <hash>

---

## [2026-06-19 ~18:04] iteração 46 — 🚧 FASE L (4/N): Tela 5 (briefing pré-entrevista) — liga "antes"→"durante"

**Feito (`apps/web`):** o roteiro pré-entrevista (reusa `generateBriefing` da FASE C, já testado):
- `app/vagas/[id]/briefing/page.tsx` — Tela 5: perguntas agrupadas pelas **3 lentes canónicas** (`@rh/core` enum `lente`: tecnica/cliente/gap → "Técnicas"/"Interesses do cliente"/"Lacunas") via `Card`; cada pergunta com **"boa resposta" recolhível** (`<details>`); `notFound`.
- `StartInterviewButton.tsx` (client) — **▶ Iniciar entrevista**: `POST /api/interviews` → mostra a sala mock (estados idle/busy/done/error). **Liga o "antes" ao "durante"** (cria a entrevista do pipeline da FASE K).
- Links "▶ Ver triagem" + "▶ Briefing pré-entrevista" na Tela 2.

**Verde:** typecheck ✅ · `next build` ✅ (**21 rotas**, +/vagas/[id]/briefing) · web **32 testes** (sem lib nova — reusa `generateBriefing` já testado) · Biome ✅.

**Self-review (fatia UI):** usa o enum `lente` canónico (não re-decide); 3 estados no botão; `notFound`; zero `as` cego. **Simplificação v1 anotada:** a página gera o briefing no render (write-on-GET, mas **idempotente** — rubric.job_id UNIQUE + onConflictDoNothing + stub sem custo). Produção: gerar via POST explícito + cache.

**A fazer (FASE L):** Tela 7 parecer (abas Interna/Cliente + export md) · Tela 1 dashboard/kanban. Depois M, N.

**Commit:** <hash>

---

## [2026-06-19 ~17:52] iteração 45 — 🚧 FASE L (3/N): Tela 4 (candidato detalhe)

**Feito (`apps/web`):** o CV destrinchado:
- `lib/candidatos.ts` += **`getCandidato`** (valida `candidateProfile` na fronteira com `safeParse`; isolado por agency; null fora).
- `app/candidatos/[id]/page.tsx` — Tela 4: resumo, **skills declaradas como chips** (`@rh/ui`), experiência-anos, lacunas do CV; `notFound`. Lista `/candidatos` liga a cada detalhe (a triagem 👁 já apontava para cá).

**Verde:** typecheck ✅ · `next build` ✅ (**20 rotas**, +/candidatos/[id]) · web **32 testes** (+1: getCandidato detalhe+isolamento) · `pnpm -r test` verde · Biome ✅.

**Self-review (fatia UI+lib, espelha getVaga/Tela 2):** validação na fronteira, isolamento agency, notFound, zero `as` cego. **O 👁 da triagem agora resolve** (vaga→triagem→candidato ligado).

**A fazer (FASE L):** Tela 5 briefing UI (3 lentes + ▶ Iniciar→POST /api/interviews) · Tela 7 parecer (abas) · Tela 1 dashboard/kanban.

**Commit:** <hash>

---

## [2026-06-19 ~17:40] iteração 44 — 🚧 FASE L (2/N): Tela 3 (triagem — ranking por match%)

**Feito (`apps/web`):** a triagem (resolve a dor #1: 40 CVs em minutos):
- `lib/triagem.ts` **`triageVaga`** — lista candidatos da agência + ranking por **match%**; v1 = **mock determinístico** (score do hash de `candidatoId+roleType`, 40–95% → ranking demo-able sem chave) + **cobertura** dos must declarados (skills do perfil vs requisitos). Valida o perfil JSONB na fronteira (`candidateProfile.safeParse`); read-only; isolado por agency. (Match real por candidato + cache = FASE Ω.)
- `app/vagas/[id]/triagem/page.tsx` — barra+match%, **chips cobertos (strong)/faltantes (muted)**, 1-linha resumo, 👁 ver perfil (→ `/candidatos/[id]`, Tela 4); `EmptyState` se sem candidatos. Link "▶ Ver triagem" na Tela 2.

**Verde:** typecheck ✅ · `next build` ✅ (**19 rotas**, +/vagas/[id]/triagem) · web **31 testes** (+2: ranking ordenado + cobertura dos must; vaga inexistente→[]) · `pnpm -r test` verde · Biome ✅.

**Self-review (fatia UI+lib):** validação na fronteira; isolamento por agency; mock determinístico documentado; zero `as` cego. **Nota:** ao testar, apanhei dados-cruft pré-existentes na dev-DB (prefixo a7 de sessão anterior) → o teste passou a **IDs aleatórios por execução** (zero colisão). `triageVaga` é read-only (não criou nada).

**A fazer (FASE L):** Tela 4 candidato detalhe (`/candidatos/[id]`) · Tela 5 briefing UI · Tela 7 parecer (abas) · Tela 1 dashboard/kanban.

**Commit:** <hash>

---

## [2026-06-19 ~17:26] iteração 43 — ✅ FASE K COMPLETA (v1) + 🚧 FASE L (1/N): Tela 2 (vaga detalhe)

**🎉 FASE K ("durante") COMPLETA para v1** — o pipeline ao vivo funciona ponta-a-ponta com fonte MOCK:
ciclo de vida (K1) · escritor único + CAS de ticks (K2) · REST join/report (K3) · **ws com JWT+posse** (K4) · **resiliência** gap/teto-custo/timeout (K5). Aceitação provada ao nível de lógica/integração+socket.

**Duas decisões registadas (não-código):**
1. **Frame do chat ao vivo:** v1 = resposta **MOCK local** (já no desktop J2/J3, fora do reducer/WS). O frame real `chat.answer` é uma **extensão versionada do protocolo `@rh/core` na FASE Ω** — **NÃO reusar `alert`** (semântica distinta). O protocolo congelado fica intacto agora.
2. **WS replay-on-reconnect: DEFERIDO p/ FASE Ω** (não é gold-plating do v1). Razão: o `seq` é por-ligação (reinicia na reconexão) e o protocolo congelado **não tem** frame `snapshot.request` do cliente → um replay limpo exige uma extensão do protocolo (snapshot.request + seq do tick-stream). Além disso o **demo v1 usa o feed MOCK** (o desktop não abre ws real). Construir agora seria especular sobre um caminho não-exercido. Entra com o ws real + Supabase Auth (refresh JWT silencioso) na FASE Ω.

---

**FASE L (1/N) — Tela 2 (Vaga: requisitos):** primeira tela do painel "Antes→Depois", reusando `@rh/ui`:
- `lib/vagas.ts` += **`getVaga`** (detalhe + nome do cliente via leftJoin; **valida os requisitos JSONB na fronteira** com `jobRequirements.safeParse` — não confia no shape da DB, sem `as` cego).
- `app/vagas/[id]/page.tsx` — Tela 2: must-have (chips `strong`) / nice-to-have (chips `muted`) + contexto; `notFound()` para o estado não-encontrado; dark Apollo. A lista `/vagas` liga a cada detalhe.

**Verde:** typecheck ✅ · `next build` ✅ (**18 rotas**, +/vagas/[id]) · web **29 testes** (+1: getVaga detalhe+isolamento) · `pnpm -r test` verde · Biome ✅.

**Self-review (fatia pequena de UI):** validação na fronteira (safeParse), isolamento por agency, `notFound` cobre o estado vazio, zero `as` cego. 

**A fazer (FASE L):** Tela 3 triagem (ranking match% + chips + ✓/✗/👁) · Tela 4 candidato detalhe · Tela 5 briefing UI · Tela 7 parecer (abas Interna/Cliente) · Tela 1 dashboard/kanban. Uma tela de cada vez.

**Commit:** <hash>

---

## [2026-06-19 ~17:14] iteração 42 — 🚧 FASE K (5/N): resiliência PURA (gap/teto-custo/timeout)

**Feito (`apps/web/lib/resilience.ts`):** a degradação graciosa (§0: nenhuma falha encerra a sessão):
- **`openGap`/`closeGap`** (`interview_gap`: start_ms/end_ms/cause `stt_reconnect|network|app_crash|pc_sleep|manual_pause|cost_cap`; CAS — só fecha se aberto, idempotente) + `readGaps` (para a secção "⬜ não-capturado" do parecer §14).
- **`sumTickCostUsd`** (soma `cost_usd` dos ticks) + **`costCapTier`** (puro §4: ok/alert 70%/soft 90%/hard 100%).
- **`runWithTimeout`** (tick que excede `ms` → `{timedOut:true}` → degrada com `degraded=true`, não bloqueia; erros propagam p/ o fallback de modelo §5). Constantes `TICK_DEGRADE_MS=60s`, `RECONNECT_AUDIO_MS=3s`.

**Verde:** typecheck ✅ · `next build` ✅ · web **28 testes** (+4: costCapTier limiares + runWithTimeout rápido/lento [puros]; openGap/closeGap CAS idempotente + readGaps; sumTickCostUsd [c/ DB]) · `pnpm -r test` = **223** · Biome ✅.

**Self-review (fatia pequena; espelha o CAS/isolamento da K1/K2 já revisto):** CAS de fecho idempotente testado; isolamento por agency em todas as queries; `costCapTier` puro com limiares testados; `runWithTimeout` limpa o timer no finally; zero `as` cego. A composição (TickEngine + runWithTimeout→persistTick(degraded) + sumCost→openGap(cost_cap)) é wiring fino — os primitivos estão prontos.

**A fazer (FASE K):** reconexão WS replay (`ack{lastSeq}`→reenviar via `readTicks`) + refresh JWT; decisão do frame da resposta do chat ao vivo. Depois L/M/N.

**Commit:** <hash>

---

## [2026-06-19 ~17:02] iteração 41 — 🚧 FASE K (4/N): `apps/ws` sai do stub — JWT mock + posse (segurança)

**Feito (`apps/ws`):** o auth REAL do WebSocket (v1), substituindo o stub injetado:
- `src/jwt.ts` — JWT **HS256** sem dependências (`node:crypto`): `signJwt`/`verifyJwt` (assinatura `timingSafeEqual` tempo-constante + `exp`; `nowSec` injetável). **Guard anti-algorithm-confusion** (só `alg:HS256`).
- `src/auth.ts` — `createWsAuthenticate({secret, verifyOwnership, now})` → o hook `WsServerHooks.authenticate`: sem segredo→**4401**; JWT inválido/expirado→**4401**; `verifyOwnership(interviewId, recruiterId)` **injetável** (a app fornece `SELECT 1 FROM interview WHERE id AND recruiter_id` — @rh/ws fica SEM @rh/db) falso→**4403**; erro na posse→4401 (fail-closed). O segredo vem do env `WS_JWT_SECRET` — NUNCA hardcoded.
- `src/server.ts` — teto 8 KB anti-DoS pré-auth. index exporta jwt/auth.

**Verde:** typecheck ✅ · **@rh/ws 27 testes** (+13: jwt round-trip/bad-sig/expirado/malformado/adulterado/alg-confusion; auth válido/sem-segredo/inválido/expirado/sem-posse/posse-throw + 4 socket-localhost: auth.ok, 4401, 4403, 8KB) · `pnpm -r test` = **219** · Biome ✅.

**Security-review** (security-reviewer): **0 CRITICAL**. Aplicados: guard `alg` (MEDIUM — anti algorithm-confusion + future-proof p/ RS256); try/catch no `verifyOwnership` (fail-open→fail-closed); teto 8 KB pré-auth; comentário da comparação base64url. **Confirmado seguro:** sem alg-confusion bypass; posse confia na query (não nos claims do token); fail-closed sem segredo; sem segredos hardcoded. Gap Fase Ω (anotado): `nbf`/`iat`, RS256+JWKS.

**A fazer (FASE K):** entrypoint do ws a correr com `verifyOwnership` real (via `getInterview`)+`WS_JWT_SECRET` — **NÃO no caminho do demo v1** (o desktop usa feed MOCK); resiliência pura (timeout/degradar/`interview_gap`/teto custo); reconexão WS replay (usa `readTicks`); decisão do frame do chat.

**Commit:** <hash>

---

## [2026-06-19 ~16:50] iteração 40 — 🚧 FASE K (3/N): REST `/api/interviews/:id/join` + `/:id/report`

**Feito (`apps/web`):** fecha o fluxo "durante→depois" do ciclo de entrevista (reusa K1+FASE E):
- `lib/interviews.ts` += `joinInterview` ("vou para uma reunião": garante sala/token MOCK + transita→'live'; idempotente; 409 se já 'done'), `reportInterview` (o desktop chama ao encerrar: transita→'done' + `gerarParecer` da FASE E — funciona mesmo em entrevista órfã), `InterviewNotFoundError`.
- Rotas dinâmicas Next 15 (`params: Promise`): `app/api/interviews/[id]/join/route.ts` (POST→200, 404/409/400) + `app/api/interviews/[id]/report/route.ts` (POST→201, 404/400).

**Verde:** typecheck ✅ · `next build` ✅ (**17 rotas**, +/interviews/[id]/join +/report) · web **24 testes** (+3 c/ DB: join→live+sala, join inexistente→NotFound, report→done+parecer+idempotente mesmo órfã) · `pnpm -r test` = **203** · Biome ✅.

**Self-review (fatia pequena; reusa `transitionInterview`+`gerarParecer` já testados):** mapeamento de erros correto (NotFound→404, InvalidTransition→409); isolamento por agency (getInterview/gerarParecer filtram); idempotência testada; zero `as` cego. O desktop (`endInterview`) já aponta a este `/report` (FASE J).

**A fazer (FASE K):** `apps/ws` sai do stub (JWT mock + posse); resiliência pura (timeout/degradar/`interview_gap`/teto custo); reconexão WS replay (usa `readTicks`); decisão do frame da resposta do chat.

**Commit:** <hash>

---

## [2026-06-19 ~16:38] iteração 39 — 🚧 FASE K (2/N): TickEngine→`interview_tick` (escritor único + CAS por tick_n)

**Feito (`apps/web/lib/ticks.ts`):** a persistência do estado vivo (Camada B) — o **escritor único** (§11):
- `nextTickN` (max+1, monótono); **`persistTick`** (insere `interview_tick`: live_state=estado, suggestion, custo/tokens/modelo/latência/degraded; **CAS por `tick_n`** — não duplica, idempotente); `readTicks` (ordenado por `tick_n`, isolado por agency — base do replay); **`createTickPersister`** = bridge type-compatível com `TickEngine.onTick` (`new TickEngine({ onTick: createTickPersister(db, ag, id) })`) com contador monótono.

**Verde:** typecheck ✅ · `next build` ✅ · web **21 testes** (+3 c/ DB: persiste+lê isolado por agency; CAS idempotente não duplica; persister escreve tick_n 0/1/2 monótono) · Biome ✅.

**Self-review (fatia pequena ~120 linhas, espelha a K1 já revista):** CAS idempotente (testado); isolamento OK (existence-check keia no `interview_id` globalmente único; `readTicks` filtra agency; insert grava o agency certo); zero `as` cego (só `String(costUsd)` p/ numeric, justificado); imutável. **Deferido (FASE N, com o resto do endurecimento DB):** `UNIQUE(interview_id, tick_n)` como backstop forte do CAS — o escritor único + a verificação cobrem o v1.

**A fazer (FASE K):** `apps/ws` sai do stub (JWT mock + posse `SELECT 1 FROM interview`); `/api/interviews/:id/join` + `/:id/report`; resiliência pura (timeout/degradar/`interview_gap`/teto custo); reconexão WS replay (usa `readTicks`); decisão do frame da resposta do chat.

**Commit:** <hash>

---

## [2026-06-19 ~16:25] iteração 38 — 🚧 FASE K (1/N): REST `POST /api/interviews` + ciclo de vida (CAS)

**Feito (`apps/web`):** primeira fatia da orquestração ao vivo — o ciclo de vida da entrevista:
- `lib/interviews.ts` — `createInterview` (insere `interview`: sem processo→**'unstructured'** órfã §12, com processo→**'live'**; `captureType:'none'` v1; devolve `{interviewId, room, token}` **MOCK** inertes — LiveKit real = handover); `getInterview` (filtrado por agency); **`transitionInterview`** (guarda de transições válidas + **CAS por status atual**: `UPDATE … WHERE status=<lido>` → 0 linhas = corrida; **recheck idempotente** se uma transição concorrente já levou ao mesmo destino); `InvalidTransitionError`.
- `app/api/interviews/route.ts` — POST (Zod `{processId?}`, `getSession`→agency+recruiter, envelope).

**Verde:** typecheck ✅ · `next build` ✅ (**15 rotas**, +/api/interviews) · web **18 testes** (+4 c/ DB: cria órfã+mock token, isolamento agency, unstructured→live→done idempotente, rejeita done→live) · Biome ✅.

**Code-review** (database-reviewer): 2 CRITICAL + 3 HIGH. **Aplicados:** C1 (recheck idempotente pós-CAS sob concorrência); M2 (removida aresta incoerente `scheduled→unstructured`); H3 (documentado token mock efémero). **Deferidos com critério (não-bloqueante):** C2 (try/catch no `getSession` — o shim não lança; tratamento uniforme de auth fica para a **FASE N**, evita inconsistência com as outras 14 rotas); H1/H2/M4 (CHECK constraints de `status`/`capture_type` + índices compostos `(agency_id,status)` — **endurecimento DB para a FASE N/migração**; a guarda `isStatus` na app já cobre o risco realista). M1 mantido: `status:string`+`isStatus` (validar-na-fronteira é mais seguro que confiar no tipo da DB).

**A fazer (FASE K):** TickEngine→`interview_tick` (escritor único + CAS, família G); `apps/ws` sai do stub (JWT mock + posse `SELECT 1 FROM interview`); `/api/interviews/:id/join` + `/:id/report`; resiliência pura (timeout/fallback/degradar/`interview_gap`/teto custo); reconexão WS replay; decisão do frame da resposta do chat ao vivo.

**Commit:** <hash>

---

## [2026-06-19 ~16:10] iteração 37 — ✅ FASE J COMPLETA (parte 3/3): casca Electron + hardening + distribuição

**Feito (`apps/desktop`):** a casca Electron que monta o HUD e o endurece (hardening R2):
- **`src/main/main.ts`** — entry: cria a `BrowserWindow` (via `buildOverlayWindowOptions` — sandbox/contextIsolation/nodeIntegration:false/webSecurity), `setAlwaysOnTop('screen-saver')`, `setVisibleOnAllWorkspaces`, **multi-monitor** (restaura/persiste posição por `display.id`), `setWindowOpenHandler`→deny, **`will-navigate`+`will-redirect`**→allowlist, **`app.enableSandbox()`** global, **`setPermissionRequestHandler`** nega mic/câmara/geo (v1 não capta áudio), CSP via `onHeadersReceived`, `openExternal` só http(s); IPC `vera:action`/`vera:end` validam **sender (file:)** + **payload Zod**. URLs públicas por env.
- **`src/main/security.ts`** (puro) `navigationDecision`/`withCspHeader`; **`src/main/windowState.ts`** (puro) `pickWindowPosition` (clamp/fallback) + read/write JSON.
- **`src/preload/preload.ts`** — `contextBridge` mínimo (`sendAction`/`onFrame`); **`src/shared/action.ts`** (Zod `veraAction`). **`src/main/tray.ts`**.
- **`src/renderer/index.html`** (CSP `<meta>` estrita) + **`src/renderer/main.tsx`** (monta o `Hud`, corre `playScript(goldenInterviewScript)`→reducer, cronómetro `Date.now`, chat-resposta MOCK local). **`electron-builder.yml`** (Win NSIS + macOS DMG; signing = handover). `globals.d.ts` (`*.css`).

**Verde:** typecheck ✅ (contra os tipos do `electron` — binário NÃO descarregado, `ELECTRON_SKIP_BINARY_DOWNLOAD=1`) · **desktop 44 testes** (hardening/nav/CSP, multi-monitor, schema IPC + render/reducer/player) · `pnpm -r test` = **193** · Biome ✅.

**Security-review** (security-reviewer): 2 CRITICAL + 5 HIGH **todos corrigidos** — `will-redirect` em falta (C1); `javascript:` negado estruturalmente (C2); `app.enableSandbox()` (H4); `setPermissionRequestHandler` nega mic/câmara (H5); IPC valida sender+payload Zod (H2/H3); `openExternal` só http(s) (M5); CSP `file:` documentada (H1). Checklist R2 = PASS.

> ⚠️ **Verificação honesta (headless):** não dá para LANÇAR o GUI Electron neste ambiente — provei tudo por **typecheck (tipos electron) + 44 testes (lógica pura/render/smoke do hardening)**. **Run local do Mateus (handover):** descarregar o binário electron (`pnpm rebuild electron` ou re-instalar sem `ELECTRON_SKIP_BINARY_DOWNLOAD`) + bundler do renderer/main (ex.: vite/esbuild → `dist-build/`) + `electron .`. Packaging assinado (Authenticode EV / Developer ID + notarização) = handover.

🎉 **FASE J ("a ESTRELA") COMPLETA** — overlay desktop demonstrável (lógica/render/hardening provados; feed MOCK).

**A fazer:** **FASE K** — orquestração da entrevista ao vivo (TickEngine↔TranscriptSource→interview_tick; ws sai do stub: JWT mock+posse; REST /api/interviews+/join+/:id/report; resiliência; reconexão WS replay; decidir o frame da resposta do chat ao vivo). Depois L/M/N.

**Commit:** <hash>

---

## [2026-06-19 ~15:50] iteração 36 — 🚧 FASE J (parte 2/3): HUD em React (overlay Tela 6) reutilizando `@rh/ui`

**Feito (`apps/desktop/src/renderer/hud/`):** o overlay que pinta o `HudState` (cérebro da parte 1) — **dark Apollo, reutiliza `@rh/ui`**:
- `Pill.tsx` — pílula compacta (~300×44, arrastável): estado num relance; sugestão em 1 linha (borda **teal só quando há sugestão**), contagem coberto/total, 🔴; clique→expande.
- `ExpandedPanel.tsx` — painel ~360px (Tela 6 completa): header 🔴+contexto+**cronómetro mm:ss**; PRÓXIMA PERGUNTA grande + 💡porquê + **Usei/Pular/★** (`@rh/ui` Button); fila; **ESTADO DOS REQUISITOS via `StateLight`** (semáforo 4 estados de `@rh/ui`); **rede de segurança** (alerts âmbar); **"silêncio é feature"** (sem sugestão → estado calmo, não inventa pergunta); chat ao vivo.
- `ChatPanel.tsx` — chat ao vivo (input + histórico por prop). `Hud.tsx` (raiz pílula↔painel). `format.ts` (formatElapsed/coverageCount). `player.ts` (`playScript` reproduz `goldenInterviewScript` com **scheduler injetável** + cancelador). `hud.css` (estilos do overlay + drag regions `-webkit-app-region`).

**Verde:** typecheck ✅ · **desktop 33 testes** (+9: pílula/painel render via `renderToStaticMarkup`, semáforo, chat, calmo; `playScript` com agendador falso; cronómetro) · `pnpm -r test` = **182** · Biome ✅ (a11y incl.).

**Code-review** (code-reviewer): **0 CRITICAL, 1 HIGH corrigido** (key da fila `pergunta`→`requisitoId`+composto); +MEDIUM (focus-ring WCAG no input do chat; cast do scheduler documentado); +LOW (emojis decorativos 💡/✅/⚠ com `aria-hidden`).

**⚠️ Nota de contrato (para FASE K):** o protocolo WS congelado de `@rh/core` **não tem frame de resposta do chat ao vivo**. Decisão: o chat é **local** (histórico por prop, fora do reducer — não inventei frame WS). Na FASE K, ao tirar o `ws` do stub, decidir como a resposta do chat volta (provável: reusar `alert` OU adicionar um frame — decisão a registar, não inventar agora).

**A fazer (fechar J):** parte 3/3 — Electron `main.ts` (BrowserWindow via `buildOverlayWindowOptions` + setAlwaysOnTop screen-saver + multi-monitor persist + setWindowOpenHandler deny + will-navigate allowlist + CSP nos headers da sessão), `preload.ts` (contextBridge mínimo), `tray.ts`, `index.html`+`main.tsx` (monta o `Hud` + corre o feed mock), `electron-builder.yml` (Win NSIS + macOS DMG), smoke do hardening. safeStorage (login bypass mock). encerramento→POST /api/interviews/:id/report.

**Commit:** <hash>

---

## [2026-06-19 ~15:35] iteração 35 — 🚧 FASE J (parte 1/3): núcleo puro do `apps/desktop` (hardening R2 + cérebro do overlay + feed mock)

> A FASE J (Electron + overlay HUD) é XL → partida em sub-fatias demonstráveis. Esta entrega o **núcleo puro e testável sem GUI** (não dá para abrir uma janela Electron neste ambiente headless; a verificação honesta é ao nível da lógica). As partes 2/3 (HUD React + Electron main/preload/tray) seguem.

**Feito (`apps/desktop`, novo package `desktop`):**
- **Hardening R2 (BLOQUEADOR de segurança — CONTRATO):**
  - `shared/windowConfig.ts` `buildOverlayWindowOptions()` — opções da `BrowserWindow` do overlay: `frame:false`/`transparent`/`alwaysOnTop`/`skipTaskbar`/`focusable:false` + `webPreferences` **sandbox:true · contextIsolation:true · nodeIntegration:false · webSecurity:true**. `ALWAYS_ON_TOP_LEVEL="screen-saver"`.
  - `shared/csp.ts` `buildCsp()` — CSP estrita (`script-src 'self'`, `object-src/base-uri/frame-ancestors 'none'`, `img-src 'self'`); `connect-src` recebe a origem do WS por config.
  - `shared/navigation.ts` `isAllowedNavigationUrl()` — allowlist de navegação; nega `blob:`/`data:`/`javascript:` e credenciais embebidas; só `file:`+origens permitidas.
- **Cérebro do overlay (puro, imutável):** `overlay/reducer.ts` `hudReduce(state, action)` — aplica o protocolo WS **congelado** de `@rh/core` (auth.ok/tick.update/suggestion.next/coverage.update/alert/interview.active/job.*) ao `HudState` (semáforo 4 estados, sugestão+porquê, fila, rede de segurança, gravação 🔴). **Auto-dismiss** da sugestão coberta + promoção da fila; **proteção de replay** (descarta seq repetido/fora de ordem); `derivePorque` deriva do estado real (não inventa). `overlay/types.ts`.
- **Feed mock (`overlay/mockFeed.ts`):** `goldenInterviewFrames()`/`goldenInterviewScript()` — "entrevista golden" guionada, frames validados por `serverMessage`. Substituível pelo WS real só com a chave.

**Verde:** typecheck ✅ · **desktop 24 testes** (hardening R2 asserido; reducer; **feed golden → reducer prova sugestão→semáforo→auto-dismiss→rede de segurança**) · `pnpm -r test` = **173** · Biome limpo.

**Code-review** (code-reviewer): **0 CRITICAL, 3 HIGH — todos corrigidos:** (1) `isAllowedNavigationUrl` bypass via `blob:`/`data:` → guard + testes; (2) `applyCoverage` copy-then-mutate → reescrito 100% imutável; (3) `seq` fora de ordem revertia estado → drop de frames antigos (replay). +MEDIUM `img-src data:` removido; +test fidelity (`serverMessage.parse` no helper).

**A fazer (fechar J):** parte 2 — HUD React (pílula↔expandido, reusa `@rh/ui`: sugestão+porquê, fila, `StateLight`, cronómetro, 🔴, Usei/Pular/★, chat ao vivo, rede de segurança) + player do feed mock. parte 3 — Electron `main`/`preload`(contextBridge)/`tray` + `electron-builder` Win/macOS + smoke do hardening. Depois K/L/M/N.

**Commit:** <hash>

---

## [2026-06-19 ~15:10] iteração 34 — ✅ FASE I COMPLETA: design system Apollo + `@rh/ui` + shell web dark

> **Nova branch de build:** `phase3/product` (criada de `phase3/build`; merge via PR no fim — o `phase3/build` não foi tocado). Início do build do PRODUTO (Fases I–N do `PLANO-CONCLUSAO-V1.md`).

**Feito (2 sub-fatias):**
- **`packages/ui` (`@rh/ui`)** — biblioteca de componentes partilhada (web ↔ futuro desktop Electron), **sem dependência de Tailwind** (classes `.vera-*` portáveis):
  - `styles/tokens.css` — **fonte única** dos tokens dark "Apollo" (`--vera-*`: superfícies `#0E1116`/`#11151B`/`#161B22`, acento teal `#5DCAA5`, semáforo, raios, Inter). Flat (sem gradiente/sombra/blur).
  - `styles/ui.css` — classes de componente + `.sr-only`.
  - 10 componentes tipados: `Button` (variant/size, type=button), `Card`, `Field`+`Input`/`Textarea`/`Select`, `Tabs` (controlado), `Modal` (presentational, `useId`+`aria-labelledby`), `Chip`, **`StateLight`** (semáforo: reusa `RequisitoStatus` de `@rh/core` — `Record` exaustivo em compile-time; estado canónico sempre exposto a leitores de ecrã), `Skeleton`, `EmptyState`, `ErrorRetry`. `cx()` util. Barrel `index.ts`.
- **Integração web (`apps/web`)** — fim do tema branco/violeta:
  - `globals.css` — `@import tailwindcss` + `@theme` mapeia `--vera-*` → utilitários semânticos (`bg-surface`/`text-ink`/`border-line`/`rounded-card`…); `body` dark + `color-scheme: dark`.
  - `layout.tsx` importa `tokens.css`+`ui.css`+`globals.css`; shell dark + `NavBar` (client; `usePathname` → contexto ativo `aria-current` + breadcrumb).
  - Re-skin: `page.tsx` (home), `clientes`/`vagas`/`candidatos` (dark + `EmptyState`), `CreateForm` (refactor → `@rh/ui`). **3 estados UX** ligados: `EmptyState` (vazio), `loading.tsx` (Skeleton), `error.tsx` (ErrorRetry).
  - `next.config` transpila `@rh/ui`; `biome.json` exclui `globals.css` (parser CSS do Biome não suporta `@theme` do Tailwind v4).

**Verde:** typecheck (ui+web) ✅ · `next build` ✅ (CSS compilado contém `--vera-bg-base`, `.vera-*`, body dark, chip `color-mix`) · **`pnpm -r test` = 149** (ui **16** novos · core 37 · db 28 · ai 35 · ws 11 · knowledge 5 · realtime 2 · intake-bots 1 · web 14) · Biome limpo.

**Code-review** (code-reviewer): **0 CRITICAL, 3 HIGH — todos corrigidos:** (1) `Modal` `aria-labelledby`+`useId`; (2) `Chip` shallow/alert ganham fundo semântico (`color-mix`); (3) `StateLight` expõe sempre o estado canónico a AT (não só sem label). +MEDIUM: `Field`/`CreateForm` removida a dupla-associação `htmlFor`/`id` (associação implícita via `<label>`).

**Dívida v1 documentada (não-bloqueante, do review):** `Modal` sem focus-trap; `Tabs` sem tríade `aria-controls`/`role=tabpanel` (presentational — o pai põe o painel); `EmptyState` usa `<p>` no título.

**A fazer:** **FASE J** — `apps/desktop` Electron + overlay HUD (hardening R2; feed WS MOCK; reusa `@rh/ui`). Depois K/L/M/N.

**Commit:** <hash>

---

## [2026-06-19 ~13:14] iteração 33 — ✅ FASE H COMPLETA: auth/sessão — 🏁 BUILD C–H COMPLETO

**Feito:** `apps/web/lib/session.ts` `getSession()` → `{agencyId, recruiterId}` (lê cookies `vera_agency`/`vera_recruiter`; senão o seed fixo IRIS/Filipa). **Refactor:** todos os **10 routes + 3 pages** passam a obter a identidade do shim (`DEV_AGENCY_ID` agora só em `db.ts`+`session.ts`); as libs continuam a receber `agencyId` por parâmetro (testes intactos). TODO(KEYS): `@supabase/ssr` (Auth) — login email/senha OU biometria (`services/face`). KEYS-TODO atualizado.

**Verde:** typecheck ✅ · `next build` ✅ · **`pnpm -r test` TODO verde** (core 37 · db 25 · ai 35 · ws 11 · knowledge 3 · realtime 2 · intake-bots 1 · web 14 c/DB) · Biome ✅.

---

# 🏁 RESUMO FINAL — Vera Fase 3 (build C–H completo, ~34 commits)

**O produto está construído de ponta a ponta, tudo a correr com MOCKS (zero chaves, zero custo).** Falta só o Mateus ligar as chaves (`KEYS-TODO.md`) para trocar cada mock pelo adapter real.

- **Fundação+DB:** monorepo pnpm (Biome, TS strict, Vitest), 35 tabelas canónicas (Drizzle+pgvector) vivas na DB `vera_dev` :5433 (migração+seed+GUC tenant).
- **Cérebro `@rh/ai`:** slots EXTRACTOR/ARCHITECT/LIVE + gate ZDR + `generate` (Zod) + 8 features (extract vaga/CV, intake, rubric/roleProfile/briefing, match, tick, parecer) + mock transport.
- **RAG `@rh/knowledge`:** pgvector + embedder mock (cosine).
- **C — "Antes":** `apps/web` (clientes/vagas/candidatos/match/briefing) + UI navegável.
- **D — "Durante":** `@rh/realtime` TickEngine (transcrição→EstadoVivo→frames WS).
- **E — "Depois":** parecer+export md, destilar→RAG, calibração (client_verdict).
- **F — Ingestão:** intake (classifica→confirma→cria) + `@rh/intake-bots` (Telegram/WhatsApp stub).
- **G — Serviços Python:** `services/agent` + `services/face` FastAPI esqueleto (contrato + 501).
- **H — Auth:** shim de sessão (single-tenant IRIS) + refactor.

**Pendente (só Mateus, no fim):** ligar chaves — OpenRouter (LLM), Embedder, Exa/Brave, LiveKit+Soniox, Telegram/WhatsApp, Resend, Google/Apify, Supabase Auth. Ver `KEYS-TODO.md`. Implementar a lógica real dos serviços Python (incl. flash liveness, após o bug do cmtec-face).

---

## [2026-06-19 ~13:06] iteração 32 — ✅ FASE G COMPLETA: serviços Python (FastAPI esqueleto)

**Feito:** dois serviços FastAPI (só contrato; lógica depois):
- `services/agent/` (assistente proativo): `/health` ✅ + `POST /proactive/suggest` e `/sourcing/search` em **501** (GOOGLE_OAUTH/APIFY, KEYS-TODO). pydantic models + README com contrato HTTP.
- `services/face/` (biometria): `/health` ✅ + `POST /enroll` e `/verify` em **501**. **TODO duro: flash liveness é trabalho real; clonar do cmtec-face só após resolver o bug de enroll** (MEMORY `project_cmtec_face_enroll_bug`). README + contrato.

**Verde:** **pytest agent 3/3 + face 3/3** (Python 3.14, FastAPI 0.136) · **ruff limpo**. Zero segredos, zero chamadas externas.

🎉 **FASE G COMPLETA.** **Falta só H (auth).**

**Commit:** <hash>

---

## [2026-06-19 ~13:00] iteração 31 — ✅ FASE F COMPLETA: bots stub (`@rh/intake-bots`)

**Feito:** novo package `@rh/intake-bots`:
- `source.ts` — `MessageSource` interface + `IntakeBotMessage` ({source, externalId, text}) + `createManualMessageSource` (push manual; real = Telegram/WhatsApp c/ chave, inerte).
- `bridge.ts` — `runIntakeBridge(source, onMessage)` liga a fonte ao handler de ingestão (a app fecha o circuito com `ingerirMensagem`); fire-and-forget; devolve cancelamento.

**Verde:** typecheck ✅ · **1/1 teste** (entrega + cancelamento) · Biome ✅. Tudo mock — zero custo.

🎉 **FASE F ("Ingestão") COMPLETA** — intake tipado (classifica→confirma→cria) + fonte de bots reutilizável.

**A fazer:** G services Python (FastAPI esqueleto + contrato) · H auth (Supabase local + ws + substituir DEV ids). **2 fases para o fim.**

**Commit:** <hash>

---

## [2026-06-19 ~12:56] iteração 30 — Fase F1+F2: ingestão (intake classifica→confirma→cria)

**Feito:**
- `@rh/ai/features/intake.ts` `classifyIntake(text, opts)` → `intakeEnvelope` (alvo/intenção/conteúdo; slot EXTRACTOR; alvoId sempre null = não adivinha). Exportado no index.
- `apps/web/lib/intake.ts`: `ingerirMensagem` (classifica stub → grava `intake_message` por confirmar, `confirmed_at` NULL) + `confirmarIntake` ('pergunta' não grava; 'novo_candidato' cria candidato via `createCandidato`; outras intenções marcam confirmado sem criar até resolver alvo de sessão; idempotente).
- Routes `/api/intake` (POST ingest) + `/api/intake/confirm` (POST).

**Verde:** typecheck (ai+web) ✅ · `next build` ✅ (**14 rotas API**) · `@rh/ai` **35 testes** (+intake) · web **14 testes** (+intake integração: ingere→confirma cria candidato, idempotente) · Biome ✅.

**A fazer (fechar F):** F3 bots stub (`MessageSource` Telegram/WhatsApp mock → `ingerirMensagem`). Depois G services Python, H auth.

**Commit:** <hash>

---

## [2026-06-19 ~12:48] iteração 29 — ✅ FASE E COMPLETA: destilar→RAG + calibração

**Feito:** `apps/web`:
- `lib/embedder.ts` `getEmbedder()` — factory (mock determinístico até à chave `EMBEDDER_API_KEY`; €0).
- `lib/destilar.ts` `destilarFacto` — persiste `candidate_memory_fact` + `indexCandidateFact` (RAG pgvector). Route `/api/destilar`.
- `lib/verdict.ts` `registarVerdict` — insere `client_verdict` (ground-truth da calibração: veredito do cliente × `bot_predicted`). Route `/api/verdict`.

**Verde:** typecheck ✅ · `next build` ✅ (**12 rotas API**) · **13/13 testes web** (+destilar: RAG devolve o facto mais próximo da query, isolado por agency; +verdict: grava+lê) · Biome ✅.

🎉 **FASE E ("Depois") COMPLETA** — parecer+export, memória RAG durável, calibração. KEYS-TODO atualizado (OpenRouter 🟡 inerte; Embedder mock ativo).

**A fazer:** F ingestão (intake + bots stub) · G services Python · H auth.

**Commit:** <hash>

---

## [2026-06-19 ~12:42] iteração 28 — Fase E1: parecer ("Depois") + export markdown

**Feito:** `apps/web/lib/parecer.ts`:
- `renderParecerMd(name, Parecer)` — render markdown determinístico e PURO (7 secções + credenciais + fiabilidade; honesto em secções vazias).
- `gerarParecer(db, agencyId, {interviewId})` — lê entrevista → processo → candidato + `candidate_memory_fact` → `buildParecer` (stub sem chave) → renderiza → **persiste `report`** (interview_id UNIQUE, `onConflictDoUpdate`, status 'ready'). Devolve {reportId, parecer, contentMd}.
- `getParecerMd` — export do markdown guardado.
- Route `app/api/parecer/route.ts`: **POST** gera/regera · **GET** `?interviewId=` exporta `.md` (Content-Disposition; PDF=TODO pós-chave).

**Verde:** typecheck ✅ · `next build` ✅ (**10 rotas**) · **11/11 testes web** (+parecer-md unit, +parecer integração idempotente vs DB) · Biome ✅.

**A fazer (fechar E):** destilar factos→RAG (`lib/destilar.ts` + `indexCandidateFact`) · calibração `lib/verdict.ts` (client_verdict). Depois F/G/H.

**Commit:** <hash>

---

## [2026-06-19 ~12:32] iteração 27 — Fase D: copiloto ao vivo (`@rh/realtime` TickEngine)

**Feito:** novo package `@rh/realtime` (dep @rh/core+@rh/ai+@rh/ws):
- `source.ts` — `TranscriptSource` interface + `createManualTranscriptSource` (push manual; real = LiveKit+Soniox c/ chave; diarização Soniox = trabalho NOVO, stub).
- `engine.ts` — **`TickEngine`**: acumula janela (cap `maxWindow`), dispara um tick a cada `windowSize` falas do candidato → `runTick` (mock) → EstadoVivo+sugestão via `onTick`; mantém `estadoAnterior`. `attach(source)`.
- `frames.ts` — `tickToFramePayloads` → `tick.update`+`suggestion.next` (o `apps/ws` injeta v+seq).

**Verde:** typecheck ✅ · **2/2 testes** (tick dispara no Nº de falas + produz EstadoVivo; frames com seq via FrameSession) · Biome ✅. Tudo mock — zero custo.

**A fazer:** E parecer/export/RAG/calibração · F ingestão · G services Python · H auth. (Falta wiring real do servidor realtime — só com LiveKit/Soniox chave.)

**Commit:** <hash>

---

## [2026-06-19 ~12:27] iteração 26 — ✅ FASE C COMPLETA: UI mínima ("Antes" navegável)

**Feito:** `apps/web` UI: `layout.tsx` (nav Vera/Clientes/Vagas/Candidatos) + `page.tsx` (home cards) + `components/CreateForm.tsx` (client, genérico text/textarea/**select**, POST→`router.refresh`) + páginas server-component `/clientes` `/vagas` `/candidatos` (listam da DB + form criar; vagas tem select de clientes). Tailwind v4 sóbrio.

**Verde:** typecheck ✅ · `next build` ✅ (**9 rotas**: 3 pages + 6 API, todas dynamic) · Biome ✅.

🎉 **FASE C ("Antes") COMPLETA com ecrãs** — a Filipa pode (no demo, sem chave): criar cliente → abrir vaga (extrai requisitos) → adicionar candidato (extrai CV) → /api/match → /api/briefing, tudo contra a DB real.

**A fazer:** D realtime (copiloto ao vivo) · E parecer/memória · F ingestão · G services · H auth.

**Commit:** (UI=2cdc7e6; este log no próximo)

---

## [2026-06-19 ~12:21] iteração 25 — Fase C5: briefing (rubric→briefing) — fluxo "Antes" completo (lógica)

**Feito:** `apps/web/lib/briefing.ts` `generateBriefing` — `buildRubric` (atribui requisitoId §16F) → **persiste `rubric`** (job_id UNIQUE) → `buildBriefing` ligado aos ids da rubric → devolve {rubric, briefing}. Route `app/api/briefing/route.ts` POST {jobId}.

**Verde:** typecheck ✅ · `next build` ✅ (**6 rotas API**) · **8/8 testes web** com DB (+briefing: rubric c/ id + persistida + briefing) · Biome ✅.

🎉 **Fluxo "Antes" completo (lógica):** cliente → vaga(extrai) → candidato(extrai CV) → match → briefing. Tudo contra a DB real, cérebro com stub sem chave.

**A fazer (fechar C):** **UI mínima** (pages server-component + form client). Depois D realtime.

**Commit:** <hash>

---

## [2026-06-19 ~12:16] iteração 24 — Fase C4: match candidato×vaga (process + matchCandidate)

**Feito:** `apps/web/lib/match.ts` `matchCandidatoVaga` — garante o `process` (candidatura, UNIQUE candidate×job, idempotente) + lê candidato/vaga + corre `matchCandidate` (stub sem chave) + devolve `{processId, match}`. Route `app/api/match/route.ts` POST. (roleProfile vazio até o carril knowledge o preencher.)

**Verde:** typecheck ✅ · `next build` ✅ (5 rotas API) · **7/7 testes web** com DB (+2 match: cria process+MatchResult; idempotência do process) · Biome (115 fich.) ✅.

**A fazer (fechar C):** briefing (buildRubric→guarda rubric→buildBriefing) + **UI mínima** (pages).

**Commit:** <hash>

---

## [2026-06-19 ~12:11] iteração 23 — Fase C3: candidatos (CRUD + extração de CV)

**Feito:** `apps/web/lib/candidatos.ts` (`createCandidato` extrai perfil do CV via `extractCandidateProfile`+aiOptions, `nameNormalized` p/ dedup §12, insere `candidate`; `listCandidatos`) + `app/api/candidatos/route.ts` (GET+POST).

**Verde:** typecheck ✅ · `next build` ✅ (4 rotas: clientes/vagas/candidatos/health) · **5/5 testes web** com DB · Biome (112 fich.) ✅.

**A fazer (resto C):** match (`process` candidate×job + `matchCandidate`) + briefing (buildRubric→buildBriefing) routes/lib; **UI mínima** (pages).

**Commit:** <hash>

---

## [2026-06-19 ~12:05] iteração 22 — Fase C2: `aiOptions` (real-ou-stub) + vagas com extração

**Feito:**
- `apps/web/lib/ai.ts` — **`aiOptions(stub)`**: com `OPENROUTER_API_KEY` → transporte OpenRouter real (registry/fallback dos `MODEL_*` env, zdr:true placeholder); **sem chave → stub determinístico** que a rota fornece (demo sem custo). `AI_ENABLED` flag. **Ponto único de troca mock→real.**
- `apps/web/lib/vagas.ts` — `createVaga` (extrai requisitos via `extractJobRequirements` + `aiOptions`; insere `job` c/ requirements JSONB + roleType) + `listVagas`. `DEV_RECRUITER_ID` (Filipa seed).
- `app/api/vagas/route.ts` — GET+POST (Zod, envelope).

**Verde:** typecheck ✅ · `next build` ✅ (`/api/vagas`) · **4/4 testes web** com DB (clientes + aiOptions-stub + criar/listar vaga c/ extração) · Biome (109 fich.) ✅.

**A fazer (resto C):** candidatos (+CV extração) + match + briefing routes/lib; UI mínima (pages).

**Commit:** <hash>

---

## [2026-06-19 ~11:55] iteração 21 — Fase C1: `apps/web` ligado à DB (clientes CRUD)

**Mateus: "faz tudo, continua o /loop até ao fim" — loop retomado.**

**Feito:** `apps/web` ↔ DB viva:
- `lib/db.ts` — `getDb()` singleton (lazy; `DATABASE_URL` do env, nunca hardcoded) + `DEV_AGENCY_ID` (= agência IRIS do seed; substituído pela auth na Fase H).
- `lib/clientes.ts` — `createCliente`/`listClientes` (lógica testável; `agency_id` predicado §15.1).
- `app/api/clientes/route.ts` — GET (lista) + POST (cria, valida Zod, envelope `ok`/`err`).
- next.config `transpilePackages` += @rh/db/@rh/ai/@rh/knowledge; +dep `drizzle-orm` (direta).

**Verde:** typecheck ✅ · **`next build` ✅** (`/api/clientes` dynamic; @rh/db/pg compila no app) · **2/2 testes web** com DB (cria/lista/isola por agência) · Biome (104 fich.) ✅.

**A fazer (resto Fase C):** vagas (+extração via @rh/ai) + candidatos (+CV) + match + briefing routes/lib; UI mínima (forms/listas). AI routes usam transporte real se `OPENROUTER_API_KEY`, senão stub demo (sem chaves).

**Commit:** <hash>

---

## [2026-06-19 ~11:49] iteração 20 — Fase B: `@rh/knowledge` RAG pgvector (embedder mock)

**Feito:** novo package `@rh/knowledge` (dep @rh/core+@rh/db+drizzle):
- `embedder.ts` — interface `Embedder` + **`mockEmbedder`** determinístico (LCG semeado pelo hash do texto → vetor dim 1536 normalizado; mesmo texto→mesmo vetor). Real (OpenAI) entra com a chave.
- `rag.ts` — `indexCandidateFact` (embed+insert em `candidate_memory_embedding`) + `searchCandidateFacts` (cosine `<=>` na DB, **sempre filtrado por agency_id+candidate_id** §15.1).

**Verde:** typecheck ✅ · sem DB 3 pass + 2 skip · **com DB real: 5/5** ✅ (indexa→recupera por cosine dist≈0; isolamento por agency confirmado) · Biome (99 fich.) ✅. RAG real a correr contra pgvector.

**A fazer (resto Fase B):** `SearchProvider` (Exa/Brave) interface+mock → alimenta `buildRoleProfile`; `source_doc` ciclo de pesquisa; RAG de cliente/recruiter (mesma mecânica).

**Commit:** <hash>

---

## [2026-06-19 ~11:41] iteração 19 — ✅ FASE A COMPLETA (cérebro): RoleProfile + briefing + tick ao vivo

**Feito:**
- `@rh/core/src/briefing.ts` — shape `briefing` (P1.5: perguntas[{pergunta, lente, boaResposta, requisitoId}]).
- `@rh/ai/src/features/prepare.ts` — `buildRoleProfile` (P1.2 → `RoleProfile`) + `buildBriefing` (P1.5 → `Briefing`; §16F: requisitoId fora da rubric → anulado).
- `@rh/ai/src/features/live.ts` — **`runTick`** (P2.3 → `EstadoVivo`+`Suggestion`; **fail-safe §16F**: descarta requisitos com id fora da rubric, anula suggestion.requisitoId desconhecido).

**🧠 Cérebro completo** (7 features, slot certo por tarefa): `extractJobRequirements`/`extractCandidateProfile` (EXTRACTOR) · `buildRoleProfile`/`buildRubric`/`matchCandidate`/`buildBriefing`/`buildParecer` (ARCHITECT) · `runTick` (LIVE). Todas via `generate` (Zod-validado, 1 retry) + `runSlot` (ZDR+fallback) + **mock** (zero chamadas pagas).

**Verde:** typecheck ✅ · core **37/37** · ai **34/34** · Biome (91 fich.) ✅.

**Próximo (Fase B):** `packages/knowledge` — search Exa/Brave (interface+mock) + **RAG pgvector** (embedder mock) contra a DB viva.

**Commit:** <hash>

---

## [2026-06-19 ~11:36] iteração 18 — Fase A: extração (vaga + CV)

**Feito:**
- `@rh/core/src/extraction.ts` — shapes `jobRequirements` (P1.1: roleType/nivel/skills{must,nice}/contexto) + `candidateProfile` (P1.3: skillsDeclaradas/experienciaAnos/gapsCv/resumo). *(A spec descreve em prosa; fixei a forma Zod — registado.)*
- `@rh/ai/src/features/extract.ts` — `extractJobRequirements` + `extractCandidateProfile` (slot EXTRACTOR, via `generate` + mock).

**Verde:** typecheck ✅ · core **35/35** (+4) · ai **30/30** (+2) · Biome ✅. Tudo mock.

**A fazer (resto da Fase A):** `buildRoleProfile`, `buildBriefing` (+shape `briefing`), `runTick` (EstadoVivo, keia por requisitoId dados no input).

**Commit:** <hash>

---

## [2026-06-19 ~11:32] iteração 17 — Fase A (cérebro): features `matchCandidate`/`buildParecer`/`buildRubric`

**Feito:** primeiras features de IA em `@rh/ai/src/features/` (slot ARCHITECT, via `generate` + mock):
- `judge.ts` — `matchCandidate` (P1.4 → `MatchResult`) + `buildParecer` (P3.1 → `Parecer`, prompt encoda as regras anti-achismo do RELATORIO §3: critério não-coberto assinala-se, inconsistências c/ dois lados sem acusar, credenciais por documento, não-capturado).
- `prepare.ts` — `buildRubric` (P1.5 → `Rubric`): **padrão §16F** — o LLM gera o CONTEÚDO dos critérios (schema = `rubricCriterion.omit({requisitoId})`), o **SISTEMA atribui o `requisitoId` canónico** (`randomUUID`), nunca o modelo.
- `@rh/core` adicionado como dep de `@rh/ai`.

**Verde:** typecheck ✅ · **28/28 testes @rh/ai** (+5: match válido/inválido, parecer, rubric id-atribuído/ids-distintos) · Biome (82 fich.) ✅. Tudo com transporte **mock** — zero chamadas pagas.

**A fazer (resto da Fase A):** `extractJobRequirements`/`extractCandidateProfile` (precisam de shapes novos em `@rh/core`), `buildRoleProfile` (estrutura), `buildBriefing` (+shape briefing), `runTick` (EstadoVivo, keia por requisitoId).

**Commit:** <hash>

---

## [2026-06-19 ~11:25] iteração 16 — `@rh/ai` `generate` + infra mock (base das features, SEM chaves)

**Novo mandato (Mateus):** construir o **produto** o mais completo possível **sem chaves** (mocks atrás de interfaces); deixar `KEYS-TODO.md` para o wiring final. ZERO chamadas pagas. Fluxo decidido: A `@rh/ai` features → B `knowledge` (RAG) → C `apps/web` "Antes" → D realtime "Durante" → E "Depois" → F ingestão → G services → H auth.

**Feito:**
- **`KEYS-TODO.md`** (raiz) — tabela de cada serviço externo, env var, onde liga, o que ativa, estado.
- **`generate(slot, prompt, schema, opts)`** em `@rh/ai` — chama o slot, extrai JSON (tolera ```fences```), valida contra Zod, **1 retry** com erro realimentado; reusa `runSlot` (ZDR + fallback). É a base de TODAS as features de IA.
- **`mock.ts`** — `MOCK_MODEL`/`mockRegistry`/`mockFallback`/`mockTransport`/`mockRunSlotOptions`: corre o cérebro sem chaves; troca-se pelo transporte real quando o `OPENROUTER_API_KEY` chegar.

**Verde:** typecheck ✅ · **23/23 testes @rh/ai** (+4 generate: válido à 1ª, fences, retry, GenerateParseError) · Biome ✅.

**Commit:** <hash>

---

## [2026-06-19 ~11:06] iteração 15 — `docker-compose.dev.yml` (dev DB reprodutível) ✅ desbloqueado

**Feito:** `docker-compose.dev.yml` (infra mínima: **Postgres pgvector + Redis**, volumes nomeados, bind 127.0.0.1, password via env com default de dev, healthcheck). Substitui o container ad-hoc por uma stack reprodutível (`name: vera`). Os serviços de app entram aqui à medida que ficam prontos.

**Validado end-to-end:** `docker compose config` ✅ · `up -d` → `vera-db-1`+`vera-redis-1` healthy em ~3s ✅ · `db:migrate` → 35 tabelas ✅ · `db:seed` → IRIS+Filipa/Inês ✅ · **28/28 testes de integração vs a compose DB** ✅ · Biome ✅. Receita: `docker compose -f docker-compose.dev.yml up -d` + migrate + seed (no header do ficheiro).

**Commit:** <hash>

---

## [2026-06-19 ~11:05] iteração 14 — `seeds` (IRIS + Filipa/Inês + cliente/vaga/candidato)

**Feito:** `packages/db/src/seed.ts` + CLI `seed.cli.ts` (`db:seed` script, dep `tsx`):
- Seed de dev (INFRA-E-MIGRACAO §8): agência **IRIS Tech** + recrutadoras **Filipa/Inês** + 1 cliente (TechCorp demo) + 1 vaga (Dev Frontend React Pleno) + 1 candidato (João) + o **`process`** que liga candidato↔vaga. UUIDs fixos + `onConflictDoNothing` → **idempotente**.
- `DATABASE_URL` nunca hardcoded (CLI lê de env; lança se faltar).

**Verde:** typecheck ✅ · sem DB 25 pass + 3 skip · **com DB real: 28/28** ✅ (teste de integração corre o seed 2× e confirma agência/recrutadoras/process + FK integrity) · CLI `db:seed` corre OK · DB confere `agency=1, recruiter=2, process=1` após 3 execuções (idempotência provada) · Biome ✅.

**Reproduzir o dev DB:** `docker run -d --name vera-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vera_dev -p 127.0.0.1:5433:5432 pgvector/pgvector:pg16` → `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev pnpm --filter @rh/db db:migrate && pnpm --filter @rh/db db:seed`.

**Commit:** <hash>

---

## [2026-06-19 ~11:00] iteração 13 — Docker resolvido → migração APLICADA a Postgres real + `createDb`

**🔓 Spike #1 do RESUMO RESOLVIDO.** O Mateus corrigiu o Docker (crash-loop do Gordon AI: `EnableDockerAI=true` + socket `dockerInference` reparse-point WSL2 stale → matar procs + `wsl --shutdown` + renomear `run/` + `EnableDockerAI:false`; ver `feedback_docker_ai_socket_bug_2026_06_19`).

**Feito:**
- **Migração aplicada a um Postgres real** (pgvector pg16, container próprio isolado `vera-postgres` :5433) via **`drizzle-kit migrate`** (caminho da spec). **Verificação exaustiva no DB real:** 35 tabelas ✅ · `vector` 0.8.2 ✅ · `interview` só com `process_id` (sem job_id/candidate_id, nullable=órfã) ✅ · `candidate_memory_embedding.embedding`=`vector(1536)` ✅ · **58 FKs** ✅ · 4 CHECK nomeados (B/16C/L) ✅ · 4 índices ivfflat ✅ · journal drizzle=1 ✅. O schema deixou de ser só introspeção — **aplica-se limpo a Postgres real**.
- **`createDb(connectionString)`** em `@rh/db` (driver `pg` + Drizzle, `DATABASE_URL` nunca hardcoded) → `DbHandle{db,close}`; `db` satisfaz `TransactionalDb` (usar com `withAgencySession`).
- **Teste de integração GATED** (`TEST_DATABASE_URL`): sem DB salta (CI verde); com DB **prova o GUC end-to-end** — `withAgencySession` fixa `app.agency_id` na transação e o valor é vazio fora dela (local-à-transação).

**Verde:** typecheck ✅ · sem DB: 25 pass + 2 skip · **com DB real: 27/27** ✅ · Biome ✅. Container reprodutível: `docker run -d --name vera-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vera_dev -p 127.0.0.1:5433:5432 pgvector/pgvector:pg16` → `drizzle-kit migrate`.

**Próximo (agora desbloqueado):** `seeds` (IRIS+Filipa/Inês+cliente/vaga/candidato) · `docker-compose.dev.yml` (Docker funciona → já validável) · carris knowledge/realtime.

**Commit:** <hash>

---

## 🏁 RESUMO DA NOITE (STOP FINAL — 2026-06-19 ~02:50, ~1h20 de loop)

> ⏩ **ATUALIZAÇÃO 2026-06-19 ~11:00 (Docker resolvido):** os spikes #1 e #2 abaixo (DB viva)
> ficaram **RESOLVIDOS** — ver iterações 13–15 no topo. Migração aplicada a Postgres real,
> `createDb`, seeds e `docker-compose.dev.yml` validados end-to-end (15 commits, 86 unit + 3 integração).

**12 commits em `phase3/build` (pushed), monorepo todo verde — 86 testes, typecheck/Biome limpos.** Camada de contratos + fundação testável da P0.1 **completa**.

**Construído (todos verdes, com TDD + code-review):**
- **`@rh/db`** — schema Drizzle das **35 tabelas** na forma canónica FINAL (famílias A–M), migração `0000_init.sql` (+pgvector), contrato GUC `withAgencySession` (isolamento de tenant). 25 testes.
- **`@rh/core`** — contratos: envelope `ApiResponse`, protocolo WS (frames+fiabilidade seq/ack, close 44xx), 22 enums canónicos, paginação, idempotência, skill (J); **AI shapes completos**: EstadoVivo/Suggestion (frame §9), RoleProfile/Rubric, MatchResult, IntakeEnvelope, Parecer. 31 testes.
- **`@rh/ai`** — registry de modelos + **gate ZDR fail-closed** (§3/§7), runner com **fallback por slot** (§5, salta não-ZDR), transporte OpenRouter (status→transient/permanent). 19 testes.
- **`apps/web`** — Next.js 15 (App Router, Tailwind v4) a compilar; `/api/health` consome `@rh/core`. (standalone gated por env p/ Linux.)
- **`apps/ws`** — codec de frames + **servidor WS real** com handshake auth (close 4401/4403). 11 testes.

**⏳ SPIKES / PENDENTE para o Mateus (por ordem):**
1. **Docker Desktop está DOWN nesta máquina** → bloqueou TODA a camada de DB viva. Quando ligares o Docker: `supabase start` (Postgres+pgvector+Auth+Storage local) + aplicar `packages/db/migrations/0000_init.sql` (ou `drizzle-kit migrate`). A migração está validada por `drizzle-kit generate` + 25 testes de introspeção, mas **ainda não foi aplicada a um Postgres real**.
2. Depois do Docker: `createDb` real (driver `pg`), `docker-compose.dev.yml` (web/ws/realtime/agent/face/redis), `seeds` (1 agência IRIS + Filipa/Inês + 1 cliente/vaga/candidato), mocks Soniox/OpenRouter/LiveKit.
3. **Não construído ainda** (carris seguintes): `packages/knowledge` (RAG pgvector — DB-gated), `apps/realtime` (LiveKit+Soniox), `apps/bot` (Telegram/WhatsApp), `apps/desktop` (Electron overlay), `services/agent`+`services/face` (Python, vendorizar clones REUSE-MAP). Supabase Auth real (o WS usa hook injetável stub). WS replay-on-reconnect (fonte = interview_tick, DB-gated).

**Como retomar:** `git checkout phase3/build` → `pnpm install` → `pnpm -r test` (deve dar 86 verdes). Próxima fatia natural assim que o Docker estiver up: aplicar a migração + `createDb` + seeds (desbloqueia o carril "antes": vaga→RoleProfile→briefing).

---

## [2026-06-19 ~02:50] iteração 12 — `@rh/ai`: transporte OpenRouter (status→falha)

**Feito:** `packages/ai/src/transport.ts` — `createOpenRouterTransport({apiKey, baseUrl?, fetchImpl?})` (chave via `process.env`, NUNCA hardcoded; `fetchImpl` injetável p/ testes). POST a `/chat/completions`, valida a resposta (Zod), mapeia HTTP → falha que o `runSlot` entende: **429/5xx/rede → `transient`** (desce na lista, §5); **4xx≠429 → `permanent`**; formato inesperado → `permanent`.

**Verde:** typecheck ✅ · **19/19 testes @rh/ai** (+6 transport, fetch mockado — sucesso, 429/500/503 transient, 400 permanent, rede transient, malformado permanent) · `pnpm -r test` = **86 verdes** · Biome (71 fich.) ✅. Zero chamadas de rede reais.

**Commit:** <hash>

---

## [2026-06-19 ~02:47] iteração 11 — `@rh/ai`: runner com fallback por slot (§5)

**Feito:** `packages/ai/src/runner.ts` + refactor `registry.ts`:
- Extraído `modelIssuesForSlot(model, slot)` (DRY entre `validateRegistry` e o runner).
- `LlmTransport` (interface injetável), `LlmTransportError` (`transient` 429/timeout/5xx | `permanent` 4xx), `runSlot(slot, req, {registry, fallback, transport})` — tenta a lista ordenada do slot (§5), **salta modelos não-elegíveis sem os chamar** (fail-closed: nunca manda PII a provider sem ZDR, mesmo em fallback), desce em falha transitória, propaga permanente, `SlotExhaustedError` na lista esgotada.

**Verde:** typecheck ✅ · **13/13 testes @rh/ai** ✅ (5 runner: primário ok; desce em 429; salta sem-ZDR sem chamar; permanente propaga; esgotada→SlotExhausted) · Biome (69 fich.) ✅. **80 testes no total.** Transporte OpenRouter real (fetch) = fatia seguinte.

**Commit:** <hash>

---

## [2026-06-19 ~02:41] iteração 10 — `packages/ai`: registry de modelos + gate ZDR (§3/§7)

**Feito:** `packages/ai` (@rh/ai, dep zod) — bootstrap + o contrato de segurança nomeado no §3:
- `slot` (EXTRACTOR/ARCHITECT/LIVE), `modelEntry` (id + capacidades declaradas: supportsJson/Tools/Streaming/PromptCache, maxContext, cost, **`zdr`**), `slotAssignment` (os 3 slots configurados).
- **`validateRegistry(registry, slots)`** — devolve violações; **`assertRegistryValid`** lança (deploy fail-closed). Regras: todos os 3 slots veem PII → exigem `zdr:true` (§3/§7); capacidades por slot (LIVE=streaming+tools+json, ARCHITECT=json+tools, EXTRACTOR=json); modelo tem de existir + declarar o slot.

**Verde:** typecheck ✅ · **8/8 testes** ✅ (config válida=0 violações; sem_zdr; capacidade_em_falta; modelo_inexistente; slot_nao_declarado; assert lança) · Biome (67 fich.) ✅. **75 testes no total.** Wrappers de chamada (OpenRouter) + fallback por slot (§5) ficam para fatia seguinte (precisam de chave/mock).

**A fazer:** wrapper LLM com mock + fallback por slot (§5); WS replay/auth.refresh; services Python. GATED: docker-compose.dev, seeds, createDb (Docker down).

**Commit:** <hash>

---

## [2026-06-19 ~02:35] iteração 9 — `apps/ws` servidor WS real (handshake auth)

**Feito:** `apps/ws/src/server.ts` — `WsServer` (dep `ws`):
- 1ª mensagem TEM de ser `auth` (JWT no corpo, AUTENTICACAO §4); senão → close **4401**.
- `WsServerHooks.authenticate(token, interviewId)` **injetável** (stub em dev; real = Supabase + `can_join_interview`). Recusa → close **4403** (sem posse) / **4401**.
- Sucesso → cria `FrameSession`, envia `auth.ok` (seq 0) + `interview.active` (seq 1, arranca o overlay). `ack` do cliente guarda `lastSeq`. Bind a `127.0.0.1` (não exposto). `WsServer.start({port:0})` p/ porto efémero + `.close()`.

**Verde:** typecheck ✅ · **11/11 testes** ✅ (4 novos de integração com **socket localhost real** via Vitest: auth.ok+interview.active com seq 0/1; close 4403 token recusado; close 4401 1ª-msg-não-auth; close 4401 token vazio) · Biome (61 fich.) ✅. **67 testes no total.** Sem Docker (sockets localhost). auth.refresh + replay-on-reconnect (last_seq) ficam para fatia seguinte.

**A fazer:** replay/auth.refresh no WS; `services/agent`+`services/face` (estrutura Python). GATED: docker-compose.dev, seeds, createDb (Docker down).

**Commit:** <hash>

---

## [2026-06-19 ~02:30] iteração 8 — `apps/ws` codec de frames (fiabilidade seq/ack)

**Feito:** `apps/ws` (@rh/ws) — codec de frames WebSocket que consome `@rh/core`:
- `parseClientMessage(raw)` — aceita string JSON ou objeto, valida via `clientMessage` (Zod), devolve `ParseResult` (sem throw); rejeita JSON malformado E frames inválidos.
- `SeqCounter` — `seq` monótono por ligação (base do replay/ack na reconexão).
- `buildServerFrame(payload, seq)` — injeta `v`+`seq` e valida contra `serverMessage`; `ServerFramePayload` = `DistributiveOmit<ServerMessage,"v"|"seq">` (segurança por variante).
- `FrameSession` — prende o SeqCounter ao builder (emite seq incremental).

**Verde:** typecheck ✅ · 7/7 testes ✅ (parse auth/ack, rejeição de lixo, seq incremental, `@ts-expect-error` no `auth.error` code inválido = segurança em compilação) · Biome (59 fich.) ✅. **63 testes no total** (core 31 + db 25 + ws 7). Wiring do socket real (ws + upgrade HTTP + auth.refresh) deferido para fatia seguinte.

**A fazer:** `services/agent`+`services/face` (estrutura Python + contrato HTTP/S2S, não correr). GATED: docker-compose.dev, seeds, createDb, migração ao vivo (Docker down).

**Commit:** <hash>

---

## [2026-06-19 ~02:25] iteração 7 — scaffold `apps/web` (Next.js 15) + consumo de contratos

**Feito:** `apps/web` (Next.js **15.5.19** — NÃO 16; App Router + TS strict + Tailwind v4):
- `next.config.mjs` (`transpilePackages:['@rh/core']`, `outputFileTracingRoot` à raiz; `output:'standalone'` **gated por env**), `tsconfig.json` (estende o base + lib dom + jsx preserve + next plugin), `postcss.config.mjs` (Tailwind v4), `app/{layout,page}.tsx` + `globals.css`.
- **`app/api/health/route.ts`** importa `ok()` de `@rh/core` → **PROVA que os contratos são consumíveis** num route handler real.
- Deps: `@rh/core` (workspace:*), next@^15, react@^19. `sharp` aprovado nos build scripts.

**Verde:** `next build` ✅ (rotas `/`, `/api/health`) · typecheck (-r: core/db/web) ✅ · 56 testes ✅ · Biome (53 fich.) ✅.

**Reconciliação (Windows dev × Linux deploy):** `output:'standalone'` faz symlinks que o **Windows recusa (EPERM)** sem dev-mode/admin. Gated por `NEXT_OUTPUT=standalone` → local compila sem standalone (verde), o build da **VPS/CI (Linux)** ativa-o (onde symlinks funcionam). O `standalone` continua a ser a forma de deploy (playbook Vercel→VPS) — só não corre no Windows.

**A fazer:** `apps/ws` (stub que importa serverMessage/clientMessage), `services/agent`+`services/face` (estrutura Python + contrato HTTP). GATED (Docker down/apps): docker-compose.dev, seeds, createDb, migração ao vivo.

**Commit:** <hash>

---

## [2026-06-19 ~02:15] iteração 6 — AI shapes (3/3): MatchResult + IntakeEnvelope + Parecer

**Feito:** fecham-se os AI shapes de `packages/core`:
- `match.ts` — `MatchResult` (matchScore/gapsAInvestigar/pontosFortes — PLANO P1.4). Escala do score não-fixada pela spec → sem teto (não inventar).
- `intake.ts` — `intakeEnvelope` (alvo + alvoId nulável + intenção + conteudo — INTAKE §; o bot NUNCA adivinha o alvo).
- `report.ts` — `parecer` (RELATORIO-CLIENTE §3): veredito + `criterioResposta[]` (resposta+citação+timestamp, rastreável), forças, riscos, `logistica`, anguloVenda, `credencialVerificar[]` (§11, por documento), `intervaloNaoCapturado[]` (§14, buraco≠silêncio), fontes (Camada A).
- +4 enums: `credencialEstado`, `intakeAlvo`, `intakeIntencao`, `respostaCriterio`.

**Verde:** typecheck ✅ · 31/31 testes ✅ (+outputs.test.ts) · Biome ✅. Auto-review: removida const morta `UUID` (apanhada pelo `noUnusedLocals`+Biome — gate funcionou).

**Estado da Fundação P0.1:** `@rh/db` (schema 35 tabelas + migração + GUC) e `@rh/core` (envelope/ws/enums/pagination/idempotency/skill + **todos os AI shapes**: frame/evaluation/match/intake/report) — **camada de contratos COMPLETA**. Falta: docker-compose.dev + seeds + mocks + apps/services scaffolds + createDb (Docker-gated).

**Commit:** <hash>

---

## [2026-06-19 ~02:09] iteração 5 — AI shapes (2/N): RoleProfile + Rubric ("antes")

**Feito:** `packages/core/src/evaluation.ts` (CAMADA-CONHECIMENTO + INTAKE-E-JULGAMENTO Parte B):
- `roleProfile` — conteúdo dos 6 campos JSONB de `role_profile` (`competencias` [{skill,nivel,obrigatorio?}], `oQueEBom` record, `sinaisNivelErrado`, `linguagemFilipa` record, `perguntasChave`, `sources` [{url,acedidoEm}]).
- `rubricCriterion` — gabarito por requisito: keia por `requisitoId` (§16F), `perguntaSonda`, `fraco`/`ok`/`forte` + `linguagemFilipa` {fraco,ok,forte}, `peso`, `origem`, `originCriteriaId`, `tipo` (competencia|credencial §11); `rubric` (version≥1 + criteria[]).
- +2 enums em `enums.ts`: `criterioOrigem` (role_profile|client_criteria|ambos), `criterioTipo` (competencia|credencial).

**Verde:** typecheck ✅ · 24/24 testes ✅ (+6 evaluation.test.ts) · Biome ✅.

**Reconciliação:** o JSON do doc usa `competencias_esperadas`/`fontes` (output do LLM); o contrato segue os **nomes das colunas** de `role_profile` (MODELO-DADOS é a autoridade do storage) — o package `knowledge` mapeia LLM→colunas.

**A fazer (AI shapes 3/N):** MatchResult, Parecer, IntakeExtraction (ler ACESSO-E-CONHECIMENTO / RELATORIO-CLIENTE).

**Commit:** <hash>

---

## [2026-06-19 ~02:06] iteração 4 — AI shapes (1/N): frame de avaliação + EstadoVivo

**Feito:** `packages/core/src/frame.ts` — o frame de avaliação ao vivo (ARQUITETURA-TEMPO-REAL §2/§9):
- `requisitoStatus` = 4 estados canónicos da máquina de estados §9 (`não-tocado`/`raso`/`coberto-com-prova`/`contradito`).
- `requisitoCoverage` (keia por `requisitoId` UUID — família F; texto = display), `interesseClienteCoverage`, `afirmacaoCandidato` (c/ `conflitoCv`), `estadoVivo` (requisitos + interessesCliente + afirmacoesCandidato + perguntasFeitas + redFlags + resumoCorrente), `suggestion` (pergunta + lente + requisitoId nulável).
- **Apertou o `ws.ts`:** `tick.update.estado` deixou de ser `z.record(...)` genérico → passa a `estadoVivo`; `suggestion.next` agora reusa `...suggestion.shape` (single source).

**Verde:** typecheck ✅ · 18/18 testes ✅ (6 novos em frame.test.ts + o teste do tick.update endurecido) · Biome ✅.

**Reconciliação documentada:** o exemplo do doc keava `requisitos` por nome ("React"); apliquei a forma canónica da **família F** (keia por `requisitoId`, texto só display) — §16F sobrepõe-se ao exemplo pré-F.

**A fazer (AI shapes 2/N):** RoleProfile (CAMADA-CONHECIMENTO), Rubric+criteria (INTAKE-E-JULGAMENTO Parte B), MatchResult/Parecer/IntakeExtraction (ACESSO-E-CONHECIMENTO).

**Commit:** <hash>

---

## [2026-06-19 ~01:59] iteração 3 — P0.1: contrato GUC de tenant (@rh/db)

**Feito:** `packages/db/src/client.ts` — contrato OBRIGATÓRIO de isolamento de tenant (FASE-3-ARRANQUE §3, SEGURANCA §1/§15.9):
- `AGENCY_GUC = "app.agency_id"` + `setAgencyIdSql(agencyId)` (`select set_config($1,$2,true)` — is_local, parametrizado).
- `withAgencySession(db, agencyId, fn)` — abre transação curta → fixa o tenant → corre `fn`; reset garantido no fim da tx. Interfaces `TxExecutor`/`TransactionalDb` estruturalmente compatíveis com Drizzle (sem acoplar a um driver concreto). Exportado de `@rh/db`.

**Verde:** typecheck ✅ · 25/25 testes ✅ (3 novos: SQL renderizado via `PgDialect` — agency_id é PARÂMETRO, sem injeção; ordem tx_open→set_agency→fn; propagação do resultado) · Biome ✅. **Testável sem DB viva** (Docker continua down) — o `createDb` real (wiring ao pool pg) fica para quando a app precisar.

**Commit:** <hash>

---

## [2026-06-19 ~01:56] iteração 2 — P0.1: packages/core (contratos)

**Feito:** `packages/core` (@rh/core, dep zod 4.4.3) — contratos partilhados que tudo importa:
- `enums.ts` — 18 enums canónicos (efeito, speakerRole, processStage, interviewStatus, captureType, estadoProva, classificacao c/ nicho clínico, rubricLevel, confianca, peso, lente, fetchStatus, reportStatus, …) como fonte ÚNICA de validação nas fronteiras (espelham as colunas TEXT do schema).
- `envelope.ts` — `ApiResponse` (`{ok:true,data}|{ok:false,error}`), `errorCode` enum + `HTTP_STATUS_BY_CODE`, helpers `ok()`/`err()`, factory `apiResponse(schema)` (ARQUITETURA-INTEGRACAO §8).
- `pagination.ts` — cursor (`paginationQuery` limit≤100 default 20, `paginated(item)`).
- `idempotency.ts` — `IDEMPOTENCY_HEADER` + `idempotencyKey` (UUID).
- `ws.ts` — protocolo WebSocket FROZEN: `clientMessage` (auth+ack) / `serverMessage` (auth.ok/error/refresh, tick.update, suggestion.next c/ requisito_id [família F], coverage.update, alert, interview.active, job.progress/done) como discriminated unions; envelope fiável `v`+`seq` em todo frame de servidor; close codes `WS_CLOSE` 4401/4403; `WS_PROTOCOL_VERSION`.
- `skill.ts` — contrato de saída de skill (família J): `skillResult` JSON (`status`/`artifactPath`/`itemsCount`/`cost`/`error`).

**Verde:** typecheck ✅ · 12/12 testes ✅ (round-trips Zod + exaustividade dos unions + close codes) · Biome ✅.

**Notas (apertar em fatias seguintes, não inventado):** o payload `estado` do `tick.update` (EstadoVivo) e os shapes de IA (RoleProfile/Rubric/Parecer/MatchResult) ficam como placeholder genérico até ler `ARQUITETURA-TEMPO-REAL §2` na fatia de AI shapes. `agent_db_session(GUC)`/`search_knowledge`/`can_join_interview` (contratos de runtime do §3) entram com o cliente Drizzle de `@rh/db`.

**Commit:** <hash>

---

## [2026-06-19 ~01:50] iteração 1 — P0.1 Fundação: scaffold + packages/db (35 tabelas)

**Feito:**
- **Monorepo pnpm** na raiz do repo: `pnpm-workspace.yaml` (apps/* + packages/*; services/* Python ficam de fora), `package.json` (Biome 2.3.4 + TS 5.9.3, `engines.node>=20`, esbuild aprovado), `tsconfig.base.json` (strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`), `biome.json` (lint+format, migrations excluídas), `.gitignore` (`.env*` exceto `.example`/`.enc`), `.env.example` (inventário de env de ARQUITETURA-INTEGRACAO §3 — **zero segredos**).
- **`packages/db` (@rh/db):** schema Drizzle na forma FINAL canónica das **35 tabelas** (MODELO-DADOS), partido em 13 ficheiros de domínio (<800 linhas) + `_shared.ts` (helpers `pk`/`agencyId`/timestamps, `EMBEDDING_DIM=1536`). Famílias A–M materializadas: `process_id` canónico (interview/client_verdict/placement_outcome SEM job_id/candidate_id; órfã = process_id nullable), `requisito_id` (F), proveniência chunk→facto `source_chunk_id` (A), veredito graduado durável `rubric_level`/`confianca`/`parent_fact_id` (L), RGPD `classificacao`/`usar_no_score`/`estado_prova` (§5), idempotência `idempotency_key`/`provider_message_id` (I), `interview.distilled_at` (H), `report.status` (B), `source_doc.fetch_status`/`fetch_cost_usd` (K), `transcript_chunk.content_hash`/`prev_hash` não-repúdio (§15.8), `interview_participant` role-binding (M), 4 embeddings `vector(1536)` ivfflat.
- **Migração `migrations/0000_init.sql`** (35 CREATE TABLE + 58 FKs + `CREATE EXTENSION vector` prepended manualmente).
- **TDD:** `test/schema.test.ts` — 22 testes a encodar os invariantes canónicos A–M (contagem=35, process_id vs job_id, nullability órfã, 4 embeddings, vector(1536), agency_id defesa-em-profundidade) como suíte de regressão.

**Verde:** typecheck ✅ · 22/22 testes ✅ · `drizzle-kit generate` ✅ · Biome ✅.

**Code-review** (code-reviewer): 0 CRITICAL, **2 HIGH — ambos corrigidos:**
1. índice `client_verdict_process_idx (process_id, verdict)` — portado da spec (era `(job_id, verdict)`; job_id→process_id na evolução G1/G2; FK não cria índice implícito).
2. `agency_id` adicionado a `interview_tick` + `assistant_message` (guia de consolidação item 9 "agency_id em TODAS as tabelas" + §15.1; são as tabelas de maior volume → migrar depois seria caro).

**Reconciliações documentadas (não inventadas):**
- `report.content_md` → NULLABLE (base-DDL `NOT NULL` × ciclo de vida `'generating'` §16B; o §16B é mais recente e específico → ganha).

**A fazer (próximas iterações):** `packages/core` (contratos Zod + tipos WS + `agent_db_session` GUC + envelope/idempotência/paginação) → `docker-compose.dev` + seeds + mocks (Soniox/OpenRouter/LiveKit) → Supabase local → carris P1+.

**Bloqueios / spikes p/ o Mateus:**
- ⏳ **SPIKE — aplicar a migração a um Postgres real ficou por correr: Docker Desktop não está a correr nesta máquina** (daemon down). Validação feita via `drizzle-kit generate` (SQL válido pelo tooling) + 22 testes de introspeção. Quando o Docker estiver up: `docker run -d --name pgcheck -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg16` + aplicar `packages/db/migrations/0000_init.sql` no psql (ou `supabase start` + `drizzle-kit migrate`). Espera-se 35 tabelas + extensão `vector`.
- 🔲 pgvector: usei `ivfflat` (= DDL). §15.3 deixa HNSW em aberto p/ alto volume — decisão de ops futura, não bloqueia o build.

<!-- O loop acrescenta aqui as entradas, ex.:
## [data hora] iteração N — P0.1 packages/db
- Feito: schema.ts (35 tabelas) + 001_init.sql; migração aplica em Supabase local (verificado).
- Verde: typecheck ✅ · build ✅ · testes 12/12 ✅ · biome ✅ · code-review (0 critical) ✅.
- Falta: seeds, mocks.
- Bloqueios: nenhum.
- Commit: <hash>.
-->
