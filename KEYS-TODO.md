# 🔑 KEYS-TODO — o que o Mateus liga no FIM (até lá, tudo MOCK)

> Regra do build: **ZERO chamadas pagas**. Cada serviço externo está atrás de uma interface com um
> **mock/stub** local. Quando deres a chave, mete-se no `.env` (sops/`.env.enc`) e o adapter real
> entra no lugar do mock — sem reescrever features. Estado: ⬜ por ligar · 🟡 adapter real escrito (inerte) · ✅ ligado.

| Serviço | Env var(s) | Onde liga | Ativa | Estado |
|---|---|---|---|---|
| **OpenRouter** (LLM chat) | `OPENROUTER_API_KEY` (+ `MODEL_EXTRACTOR/ARCHITECT/LIVE`) | `@rh/ai` (transporte) + `apps/web/lib/ai.ts` `aiOptions` | extração de vaga/CV, Role Profile, Rubric, briefing, tick ao vivo, parecer | 🟡 transporte real escrito (inerte sem chave) |
| **Embedder** (OpenAI `text-embedding-3-small`, dim 1536) | `EMBEDDER_API_KEY` | `packages/knowledge` (embedder) + `apps/web/lib/embedder.ts` `getEmbedder` | RAG por candidato/cliente (pgvector) | ⬜ (mock determinístico ativo; falta adapter real) |
| **Exa** (web search) | `EXA_API_KEY` | `packages/knowledge` (search) | Role Profile (conhecimento de mercado) | ⬜ |
| **Brave** (search fallback) | `BRAVE_API_KEY` | `packages/knowledge` (search) | fallback do Role Profile | ⬜ |
| **LiveKit** (áudio da call) | `LIVEKIT_URL` `LIVEKIT_API_KEY` `LIVEKIT_API_SECRET` | `apps/realtime` | bot entra na call (transporte de áudio) | ⬜ |
| **Soniox** (STT + diarização) | `SONIOX_API_KEY` | `apps/realtime` | transcrição ao vivo + quem-fala | ⬜ |
| **Telegram** | `TELEGRAM_BOT_TOKEN` | `apps/bot` | ingestão por Telegram | ⬜ |
| **WhatsApp** (Evolution) | `EVOLUTION_API_URL` `EVOLUTION_API_KEY` | `apps/bot` | ingestão por WhatsApp | ⬜ |
| **Resend** (email) | `RESEND_API_KEY` | envio do parecer ao cliente | email do parecer | ⬜ |
| **Google Calendar** | `GOOGLE_OAUTH_CLIENT_ID/SECRET` | `services/agent` | assistente proativo (agenda) | ⬜ |
| **Apify** (sourcing) | `APIFY_TOKEN` | `services/agent` | sourcing de candidatos | ⬜ |
| **Supabase Auth** | self-hosted local — substituir o **shim de cookie** por `@supabase/ssr` | `apps/web/lib/session.ts` (`getSession`) + `lib/api.ts` (`sessionFromCookies`) + `lib/auth.ts` (`verifyMockLogin`/SEED_USERS) + `app/login` + `middleware.ts` | login real email/senha; remove o cookie-trust (limitação v1) + a dica de demo no ecrã de login | 🟡 login mock pronto (Filipa+Inês) · sessão por cookie httpOnly+maxAge |
| **Supabase Storage** (bucket PRIVADO por agência) | `STORAGE_*` | `apps/web/lib/storage.ts` (`StorageProvider` + `createMockStorage`) | upload/download de CVs/áudios/pareceres por **signed URL** de curta duração | 🟡 stub determinístico (`mock://…?exp&sig`); falta adapter Supabase/S3 |
| **Validador de upload (AV/re-render)** | `CLAMAV_*` (opcional) | `apps/web/lib/upload.ts` (`validateUpload`) | v1 já valida tamanho/MIME/magic-bytes/anti-traversal; falta ClamAV + re-render PDF + XXE-off no docx | ⬜ (validador base ✅; AV/re-render = Ω) |
| **Auth biométrica** (login facial Filipa/Inês) | — (motor em `services/face`) | `apps/web/app/login` (face mock + liveness desenhada) → `services/face` enroll/verify | email/senha OU biometria (enroll pós-1º login → passwordless) + anti-spoof | ⬜ (UI mock pronta; motor + anti-spoof por implementar) |
| **WS JWT** (servidor de overlay) | `WS_JWT_SECRET` (+ `WS_PORT`) | `apps/ws` (`createWsAuthenticate`, `src/main.ts`) | handshake HS256 do overlay (sem segredo → o server aborta) | 🟡 server arrancável; falta a **posse real** (injetar `SELECT 1 FROM interview WHERE id=$1 AND recruiter_id=$2`) |
| **LLM lince-brain-local** (motor ReAct do assistente) | (env do `services/agent`) | `apps/web/lib/assistant/*` (planner+tools MOCK) → `services/agent` | substituir o planner por palavras-chave pelo ReAct real + execução real das tools | ⬜ (porta de confirmação + tools mock ✅; motor real = Ω) |

**Como ligar (no fim):** preencher o `.env` (a partir do `.env.example`), `sops -e` → `.env.enc`, e trocar o factory do serviço de `mock*` para o adapter real (cada um documentado no seu package). Nada de chaves em código (sempre `process.env`).

---

## Ω / fast-follow — DEFERIDOS no v1 (com justificação; NÃO são chaves, é trabalho)
Itens conscientemente adiados durante a Fase 3 (documentados nas iterações do BUILD-LOG). Fechar quando o handover de chaves trouxer os adapters reais:
- **WS replay/snapshot** — o protocolo congelado (@rh/core) não tem `snapshot.request`; `seq` é por-ligação; o v1 usa mock feed no desktop. Construir só quando houver reconexão real.
- **`chat.answer` frame (WS)** — o chat do assistente é HTTP no v1; só faz sentido quando o assistente for ao vivo sobre WS.
- **Refresh de JWT (ws)** — token único no v1; adicionar rotação/refresh com a auth real.
- **Posse real do ws** — `apps/ws` usa `mockVerifyOwnership` (par não-vazio); ligar a query `@rh/db` no handshake (o @rh/ws fica sem @rh/db — injeção pela app).
- **RGPD — completude da purga**: `async_job.args` (PII em JSONB sem coluna `candidate_id` → adicionar coluna no insert dos jobs candidate-bound), `assistant_message.content` (texto livre que mencione o candidato), e **entrevistas órfãs** (`process_id IS NULL` sem `candidate_id` → ponderar coluna `candidate_id` em `interview`). Migração nova.
- **Embeddings/RAG reais** — `recruiter_memory_fact`/`candidate_memory_fact` usam recall por texto (ILIKE); ligar o embedder + pgvector para semântica.
- **Endurecimento adicional** — re-auth-24h, 2FA, hash-chain de auditoria, cosign — fora do scope v1 (single-tenant IRIS).
