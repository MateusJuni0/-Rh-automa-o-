# Vera — Face (biometria)

Esqueleto FastAPI. `/health` vivo; `enroll`/`verify` são **stub (501)** — biometria + **flash liveness**
são trabalho real (lógica depois). Auth da Vera = email/senha **OU** biometria (enroll pós-1º login → passwordless).

## ⚠️ Antes de implementar
Clonar do **cmtec-face**, mas só **depois** de resolver o bug conhecido de enroll (cadastra rápido demais
sem mostrar a tela colorida do flash liveness). Ver MEMORY `project_cmtec_face_enroll_bug`.

## Correr
```bash
cd services/face
python -m pip install -e ".[dev]"
python -m pytest
python -m uvicorn app.main:app --port 8101
```

## Contrato HTTP (consumido pelo `apps/web` na Fase H/auth)
| Método | Rota | Body | Resposta | Estado |
|---|---|---|---|---|
| GET | `/health` | — | `{status, service}` | ✅ |
| POST | `/enroll` | `{user_id, frames_b64[]}` | `{enrolled, template_id}` | 🟡 501 (lógica) |
| POST | `/verify` | `{user_id, frames_b64[]}` | `{match, score, liveness_ok}` | 🟡 501 (lógica) |
