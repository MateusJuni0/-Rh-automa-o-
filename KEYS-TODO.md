# 🔑 KEYS-TODO — o que o Mateus liga no FIM (até lá, tudo MOCK)

> Regra do build: **ZERO chamadas pagas**. Cada serviço externo está atrás de uma interface com um
> **mock/stub** local. Quando deres a chave, mete-se no `.env` (sops/`.env.enc`) e o adapter real
> entra no lugar do mock — sem reescrever features. Estado: ⬜ por ligar · 🟡 adapter real escrito (inerte) · ✅ ligado.

| Serviço | Env var(s) | Onde liga | Ativa | Estado |
|---|---|---|---|---|
| **OpenRouter** (LLM chat) | `OPENROUTER_API_KEY` (+ `MODEL_EXTRACTOR/ARCHITECT/LIVE`) | `@rh/ai` (transporte) | extração de vaga/CV, Role Profile, Rubric, briefing, tick ao vivo, parecer | ⬜ |
| **Embedder** (OpenAI `text-embedding-3-small`, dim 1536) | `EMBEDDER_API_KEY` | `packages/knowledge` (embedder) | RAG por candidato/cliente (pgvector) | ⬜ |
| **Exa** (web search) | `EXA_API_KEY` | `packages/knowledge` (search) | Role Profile (conhecimento de mercado) | ⬜ |
| **Brave** (search fallback) | `BRAVE_API_KEY` | `packages/knowledge` (search) | fallback do Role Profile | ⬜ |
| **LiveKit** (áudio da call) | `LIVEKIT_URL` `LIVEKIT_API_KEY` `LIVEKIT_API_SECRET` | `apps/realtime` | bot entra na call (transporte de áudio) | ⬜ |
| **Soniox** (STT + diarização) | `SONIOX_API_KEY` | `apps/realtime` | transcrição ao vivo + quem-fala | ⬜ |
| **Telegram** | `TELEGRAM_BOT_TOKEN` | `apps/bot` | ingestão por Telegram | ⬜ |
| **WhatsApp** (Evolution) | `EVOLUTION_API_URL` `EVOLUTION_API_KEY` | `apps/bot` | ingestão por WhatsApp | ⬜ |
| **Resend** (email) | `RESEND_API_KEY` | envio do parecer ao cliente | email do parecer | ⬜ |
| **Google Calendar** | `GOOGLE_OAUTH_CLIENT_ID/SECRET` | `services/agent` | assistente proativo (agenda) | ⬜ |
| **Apify** (sourcing) | `APIFY_TOKEN` | `services/agent` | sourcing de candidatos | ⬜ |
| **Supabase** (DB/Auth/Storage) | self-hosted local (`docker-compose.dev` / `supabase start`) — **sem chave externa em dev** | toda a app | DB + Auth + Storage | ✅ DB local viva |

**Como ligar (no fim):** preencher o `.env` (a partir do `.env.example`), `sops -e` → `.env.enc`, e trocar o factory do serviço de `mock*` para o adapter real (cada um documentado no seu package). Nada de chaves em código (sempre `process.env`).
