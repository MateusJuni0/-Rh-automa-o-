# Vera — Agent (assistente proativo)

Esqueleto FastAPI. `/health` vivo; o resto é **contrato em stub (501)** até às chaves (`KEYS-TODO.md`).
Lógica real (agenda, follow-ups, sourcing) entra depois — zero chamadas externas até lá.

## Correr
```bash
cd services/agent
python -m pip install -e ".[dev]"
python -m pytest            # testes
python -m uvicorn app.main:app --port 8100   # dev
```

## Contrato HTTP (consumido pelo `apps/web`)
| Método | Rota | Body | Resposta | Estado |
|---|---|---|---|---|
| GET | `/health` | — | `{status, service}` | ✅ |
| POST | `/proactive/suggest` | `{process_id}` | `{actions:[{kind,detail}]}` | 🟡 501 (GOOGLE_OAUTH) |
| POST | `/sourcing/search` | `{job_id}` | `{candidates:[{name,source,url}]}` | 🟡 501 (APIFY_TOKEN) |

## Chaves (ligar no fim — KEYS-TODO.md)
- `GOOGLE_OAUTH_CLIENT_ID/SECRET` → agenda/follow-ups proativos.
- `APIFY_TOKEN` → sourcing de candidatos.
