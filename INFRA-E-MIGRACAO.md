# Infra & Migração — onde corre, e o que NÃO esquecer de migrar

> **Medo do Mateus (2026-06-17, legítimo):** *"vais pôr no nosso Supabase/VPS e depois
> vais esquecer de migrar."* Este doc existe **para não esquecermos.** Tem o caminho de
> infra por fase + um **checklist de migração** explícito.
>
> **Regra do "por enquanto":** enquanto o produto é **nosso** (antes de vender),
> usamos a **nossa infra e o nosso motor** (Supabase self-hosted + VPS CMTec + Lince
> clonado + chaves nossas/OpenRouter do Mateus). Ao vender, **migra-se tudo** para o
> comprador.

---

## 1. Onde corre — por fase (o caminho)

| Fase | Onde | Chaves | Quando |
|---|---|---|---|
| **0 — LOCAL** | PC do Mateus (Docker Compose) | nossas (OpenRouter, Soniox, etc.) | **build + teste** antes de mostrar à Filipa |
| **1 — NOSSA infra** | Supabase self-hosted + **VPS CMTec** (72.60.88.137) + túnel `rh.cmtecnologia.pt` + **Lince clonado** | nossas | quando passa o teste local → **a Filipa usa aqui** |
| **2 — infra do COMPRADOR** | Supabase + VPS **dele** + domínio dele | **dele** | **ao vender** (multi-tenant v2) |

> Docker Compose (D4) + chaves por deployment (sops+age) + slots de modelo agnósticos
> (`MODELOS-E-API`) é **o que torna cada salto possível sem reescrever.** A portabilidade
> não é acidente — é a razão dessas decisões.

---

## 2. ⚠️ CHECKLIST DE MIGRAÇÃO (não deixar nada preso) — correr a CADA salto

Local → Nossa infra → Comprador. Em **cada** salto, migrar **tudo isto**:

- [ ] **Base de dados** — schema + dados (migrações Drizzle/SQL) para o Postgres de
      destino. **Não deixar dados só no local.**
- [ ] **Storage** — CVs, documentos, áudios das entrevistas (Supabase Storage) →
      bucket de destino.
- [ ] **Embeddings (pgvector)** — re-gerar se o destino mudar de embedder/dimensão
      (`MODELOS-E-API §3`).
- [ ] **Biometria** — o **clone** do `cmtec-face` (instância própria do RH) → VPS de
      destino (`AUTENTICACAO.md`).
- [ ] **Motor (Lince clonado)** — o serviço agêntico do assistente → VPS de destino.
- [ ] **Segredos** — `.env.enc` (sops+age) re-encriptado para o destino; trocar chaves
      (OpenRouter/Soniox/Google OAuth/…) quando for do comprador.
- [ ] **Túnel/domínio** — `rh.cmtecnologia.pt` (nosso) → domínio do comprador.
- [ ] **Crons/serviços** (systemd) — lembretes proativos, backups → re-criar no destino.
- [ ] **Google Calendar OAuth** — re-autorizar com a conta de destino.

> **Backups** antes de cada migração (pg_dump). Verificar contagens origem=destino
> depois (drill de restauro, como fazemos nos outros projetos CMTec).

---

## 3. Teste LOCAL-FIRST (antes de a Filipa ver) — plano do Mateus

1. **Baixar e correr local** (Docker Compose) com as nossas chaves de API.
2. **Teste E2E local:** criar cliente+vaga → briefing → **entrevista SIMULADA em tempo
   real** (o Mateus faz uma entrevista a fingir com um **amigo**, pagando as APIs:
   Soniox + ticks) → veredito ao vivo → parecer → Q&A/comparação.
3. **Validar custo real** numa sessão de ~1–2h (dashboard de tokens + Soniox/hora) —
   prova a constância (`REVISAO-360` B6) antes de pôr à frente de alguém.
4. **Só depois** subir para a **Nossa infra** (Fase 1) e **mostrar à Filipa** lá.

> Princípio: **a Filipa só vê quando já funciona** — local primeiro, sempre.

---

## 4. Estado

- **Nada construído ainda** — isto é o plano de infra/migração da Parte 1+2.
- Quando arrancar o build, a **Fase 0 (local)** é o ponto de partida; o checklist do §2
  corre no salto para a Fase 1 (nossa infra) e, mais tarde, para o comprador.
- **Lembrete vivo na memória** (`project_rh_automacao_copiloto_2026_06_17`): "⚠️ não
  esquecer migração local → nossa infra → comprador".
