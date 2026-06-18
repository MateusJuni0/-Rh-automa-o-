# Infra & Migração — spec COMPLETA (empacotar, migrar, verificar, reverter)

> **Medo do Mateus (legítimo):** *"vais pôr no nosso Supabase/VPS e depois esqueces de
> migrar… e vais lembrar a configuração certinha?"*. Este doc é o **runbook completo**
> para isso não acontecer — incluindo **empacotar/compactar** tudo e pôr a correr noutra
> VPS com a config exata.
>
> **Base provada:** reaproveita a receita do **Cronos** (`[[playbook_vercel_to_vps_migration_2026_06_13]]`
> + `cronos-game/docs/DEPLOY.md`). O RH é **mais** que isso (multi-serviço), então este
> doc estende a receita.

> ⚠️ **Correção de scope (2026-06-18):** **NÃO há comprador / revenda** — a Vera é só para a
> IRIS Tech (ADR em `DECISOES-E-MVP`). O que **fica**: o salto **Local → VPS dedicada (nossa→IRIS)**
> — o runbook §3 vale na mesma. O que vira **futuro-opcional, NÃO gate**: a Fase 2 "infra do
> COMPRADOR", a custódia de chave ao comprador, o bundle auto-instalável de revenda (§7). O
> `agency_id`/bundle portável ficam como costura barata para uma expansão futura, não produto.

---

## 0. Decisão: a migração é CÓDIGO, não o agente a improvisar

| | |
|---|---|
| **A migração em si** | **scripts determinísticos + este runbook.** Repetível, auditável, com rollback. Nunca um LLM a decidir passos no momento. |
| **O papel do Hermes/agente** | pode **executar** os scripts e **verificar** a saúde (contagens, health checks), e **avisar** se algo falha — mas **não inventa** a sequência. |

> Princípio CMTec: **determinismo onde o erro é caro.** Perder a DB de um cliente por
> uma decisão "criativa" do agente é inaceitável. Código onde tem de ser código.

---

## 1. O caminho (3 saltos) e o que corre em cada um

| Fase | Onde | Chaves | Quando |
|---|---|---|---|
| **0 — LOCAL** | PC do Mateus (Docker Compose) | nossas | build + teste E2E (incl. entrevista simulada) |
| **1 — NOSSA infra** | Supabase self-hosted + **VPS CMTec** (72.60.88.137) + túnel `rh.cmtecnologia.pt` + **Lince clonado** | nossas | a Filipa usa aqui (já a funcionar) |
| **2 — infra do COMPRADOR** | Supabase + VPS **dele** + domínio dele | **dele** | ao vender (multi-tenant v2) |

**O que compõe o produto (tudo a migrar):**
- `apps/web` (Next.js — a casa da Filipa) · `apps/ws` (WebSocket) · `apps/realtime`
  (motor ao vivo) · `apps/bot` (Telegram) · `apps/desktop` (Electron — distribuído à
  parte, ver §6).
- **O agente / Lince clonado** (o assistente pessoal — FastAPI + grafo + tools).
- **Biometria clonada** (cmtec-face — FastAPI + modelos ONNX).
- **Supabase** (Postgres + pgvector + Auth + Storage).
- **Externos por API** (não se "migram", troca-se a chave): OpenRouter, Soniox/LiveKit,
  Exa/Brave, Google OAuth.

> ⚠️ **Blast radius na VPS partilhada (loop segurança 2026-06-18):** a Fase 1 corre na VPS
> 72.60.88.137, **partilhada com produção live** (Cronos vende, Madalena responde). O compose
> da Vera **TEM** limites de recurso por container (`cpus`/`mem_limit`/`pids_limit`) desde o
> dia 1 — um pico da Vera degrada a Vera, **não** derruba o Cronos. Capacidade agregada
> (entrevistas simultâneas), crescimento de dados e backup/DR: **`ESCALA-E-OPERACAO.md`**.
> Postura de segurança técnica completa: **`SEGURANCA.md`**.

---

## 2. Empacotar ("compactar") — o bundle portável

O objetivo: **um pacote** que se larga numa VPS nova e sobe com **um comando**. Conteúdo:

```
rh-bundle/
  docker-compose.yml            # todos os serviços (web/ws/realtime/bot/agente/face/supabase)
  .env.enc                      # segredos (sops+age) — re-encriptar para o dono novo
  images/                       # docker save *.tar  (OU puxar do GHCR no destino)
  db/  rh_dump.sql.gz           # pg_dump (schema + dados)
  storage/  storage.tar.gz      # CVs, documentos, áudios (Supabase Storage)
  models/                       # ONNX da biometria (YuNet/SFace/…) — pesados, vão no bundle
  cloudflared/  *.yml           # config dos túneis (hostnames)
  cron/                         # timers systemd (lembretes, backups, auto-deploy)
  agent-packs/                  # packs de ferramentas/skills da Vera (recrutamento/documentos/comunicação/agenda/sourcing) — ASSISTENTE-PESSOAL §8; viajam com o agente
  bootstrap.sh                  # SOBE tudo: carrega imagens, restaura DB+storage, sobe compose
  RUNBOOK.md                    # este passo-a-passo, versão executável
```

- **Imagens:** ou **`docker save`** para `images/*.tar` (bundle 100% offline), ou puxar
  do **GHCR** no destino (mais leve; precisa net). Default: GHCR; tarball como opção
  "tudo no pacote".
- **Compactar:** `tar czf rh-bundle.tar.gz rh-bundle/`. Um ficheiro, leva-se para
  qualquer VPS.
- **Build é SEMPRE fora da VPS** (CI/GitHub Actions → GHCR) — nunca buildar no destino
  (regra do Cronos: build Next pede 3-4GB → OOM). O destino só **corre** + restaura.

---

## 3. Runbook de migração (passo-a-passo) — corre em CADA salto

**Antes (sempre):** `pg_dump` da origem + `tar` do storage → **backup**. Anotar
contagens (linhas por tabela) para verificar no fim.

1. **Provisionar destino:** VPS (Docker + compose), portas internas livres (`ss -tlnp`),
   `cloudflared` instalado.
2. **DB:** criar Postgres (Supabase) no destino → `gunzip < rh_dump.sql.gz | psql` →
   restaura schema + dados. Garantir extensão **`pgvector`**.
3. **Embeddings (pgvector):** se o destino **mantém** o mesmo EMBEDDER → os vetores vêm
   no dump, nada a fazer. Se **troca** de embedder/dimensão → **re-gerar** todos
   (`source_doc_embedding`, `*_memory_embedding`, `transcript_chunk_embedding`) com o
   script de re-index (`MODELOS-E-API §3`).
4. **Storage:** restaurar `storage.tar.gz` para o bucket de destino (CVs/docs/áudios).
5. **Segredos:** `.env.enc` → **re-encriptar** com a chave age do dono novo (sops); no
   salto para o comprador, **trocar as chaves** (OpenRouter/Soniox/Google/…). Escapar
   valores que começam por `$` → `$$` (gotcha Cronos).
   - 🔒 **(R2 — custódia da chave age, BLOQUEADOR):** a **chave privada age do comprador é
     GERADA na VPS dele e NUNCA trafega** — nós recebemos **só a pública** para encriptar; a
     **nossa cópia de qualquer chave da instância dele é destruída** pós-migração (senão somos
     custodiantes de todos os segredos dele = quebra o "sem cordão umbilical"). Recomendado: 2º
     recipient *sealed-offline* do próprio comprador (recuperação). 🟦 Mateus ratifica o modelo
     de confiança. (`SEGURANCA §13`, decisão de produto vendável.)
6. **Imagens:** `docker load` dos tarballs **ou** `docker compose pull` (GHCR).
   - 🔒 **(R2 — supply-chain) integridade no destino:** imagens **assinadas (cosign)** + **pin
     por digest** no compose; o `bootstrap.sh` **verifica checksums** dos tarballs e dos
     **modelos ONNX** da biometria **antes** de subir — um GHCR/bundle adulterado correria com
     a PII toda na VPS do comprador. (`SEGURANCA §13.h`.)
7. **Biometria:** subir o container do **clone** + montar os `models/` ONNX; aplicar a
   migração do schema `face` (próprio do RH); provisionar o role Postgres dedicado
   (gotcha: password no `docker exec` — `AUTENTICACAO §6 C4`).
8. **Agente (Lince clonado):** subir o serviço; ligar ao Postgres (estado/memória);
   confirmar o trilho de auditoria e o kill switch ativos.
9. **Subir o compose** (`bootstrap.sh`): web/ws/realtime/bot atrás de `127.0.0.1:<porta>`.
10. **Túnel Cloudflare DEDICADO** (não mexer nos existentes): config próprio com **todos
    os hostnames** no ingress + catch-all 404; serviço systemd próprio.
11. **DNS:** `cloudflared tunnel route dns` se o `cert.pem` cobre a zona; senão API CF
    (CNAME → `<uuid>.cfargotunnel.com`, proxied). **Preservar MX/TXT/CAA.**
12. **Crons/timers:** recriar lembretes proativos, **backups diários** (pg_dump **+ backup do
    Storage** — CVs/áudios/PDFs; **ambos cifrados** `age` + **off-site**), **cron de PURGA RGPD**
    (hard-delete após `purge_after`, em cascata transcript→embedding→source_doc→facts) e
    auto-deploy pull. Cada um com **monitor "correu nas últimas 24h senão alerta"** (senão
    morrem em silêncio — gotcha Cronos + dor do claude-mem). Detalhe: `ESCALA-E-OPERACAO §3/§5`.
13. **Google Calendar OAuth:** re-autorizar com a conta de destino (o token não migra).
14. **Auto-deploy PULL** (timer systemd cada 2min; **SSH-from-CI não funciona** —
    firewall da VPS rejeita runners → por isso pull, não push).

---

## 4. Cutover, verificação e rollback

- **Staging primeiro:** `staging.<dominio>` → smoke E2E (login biométrico, criar vaga,
  briefing, uma entrevista de teste, parecer, Q&A) = tudo 200, logs limpos.
- **Verificação dura:** contagens **origem == destino** (por tabela); RAG devolve
  resultados; biometria faz enroll+verify; o agente executa uma ferramenta simples.
- **Cutover** (só com GO explícito): apontar o domínio para o túnel novo. **Manter a
  origem como fallback 1–2 semanas.**
- **Rollback:** se algo parte, voltar o DNS para a origem (que ficou intacta). Por isso
  **nunca apagar a origem** antes da janela de fallback fechar.

---

## 5. Gotchas (do Cronos + novos do RH — não repetir)

- **Env que começa por `$`** → escapar `$$` (Asaas/chaves).
- **Ingress do túnel** tem de listar **todos** os hostnames (apex + www + sub).
- **`sharp`** é dep transitiva do Next — não pôr direto; copiar `node_modules/sharp`+`@img`.
- **`NEXT_PUBLIC_*`** são **inlined no build** → mudar exige rebuild (build args/repo vars).
- **Imagens webp-only** (AVIF parte Safari iOS).
- **`cert.pem`** só cobre a zona do login → outras zonas via API CF.
- **NUNCA buildar na VPS** (OOM derruba a DB de produção).
- **NOVOS do RH:** dimensão do **pgvector** ao trocar embedder (re-index); **modelos
  ONNX** da biometria são pesados (vão no bundle, não no git); **role Postgres** da
  biometria (syntax da password); **Google OAuth** re-consent; **estado do agente**
  (Lince) tem de migrar com a DB, senão perde memória/auditoria.

---

## 6. App desktop (Electron) — caso à parte

O `apps/desktop` **não corre na VPS** — é instalado na máquina da Filipa. "Migrar" aqui
= **distribuir o instalador** (assinado) e apontá-lo ao backend de destino (URL do WS +
do `/auth`). Code-signing + permissão de microfone do SO ficam na embalagem
(`REVISAO-360`).

---

## 7. Como o comprador recebe (2 modelos)

1. **Nós migramos (serviço):** corremos este runbook na VPS dele. Mais controlo, é o
   default no início.
2. **Bundle auto-instalável:** entregamos `rh-bundle.tar.gz` + `bootstrap.sh` + RUNBOOK
   → ele (ou o IT dele) sobe. Para escala/quando houver muitos clientes.

> Em ambos, o que torna isto possível **sem reescrever** são as decisões já tomadas:
> Docker Compose (D4), chaves por deployment (sops+age), modelos por slot agnósticos
> (`MODELOS-E-API`), `agency_id` na costura (multi-tenant v2).

### Regra: a instância do comprador é INDEPENDENTE (sem cordão umbilical)
A VPS do comprador corre uma instância **autónoma** — o *core* do Hermes vai
**vendorizado dentro do bundle**, **não** puxado de um repo/infra nossa em runtime.
Consequências (o que o Mateus quer):
- **Sem dependência da nossa stack** — se desligarmos a nossa, a dele continua.
- **Sem refém da nossa manutenção** nem limitada pelo nosso lado.
- **Updates = entrega limpa e opcional** (um bundle/imagem novos que ele aplica se
  quiser), **não** um push automático nosso para dentro da máquina dele. Decoupled by
  design. *(Isto fecha o tema "updates a instâncias vendidas".)*

> 🟦 **(R2 — BLOQUEADOR de design) O que o ADMIN-comprador vê dos dados de terceiros:** ao
> vender, o admin da instância do comprador herda acesso a CV/contactos/transcrições/**saúde
> clínica** de candidatos que nunca consentiram que *aquele* admin os visse individualmente. O
> RGPD é da agência, mas a **arquitetura de quem-vê-o-quê é decisão técnica nossa** e cara de
> mudar depois. Mínimo: **trilho de auditoria de LEITURA de PII** (não só de ações) + decidir
> se o **admin tem role separado** do recrutador operacional. 🟦 Mateus decide; documentar em
> `LEGAL-E-RGPD`. (`SEGURANCA §13.k`.)

---

## 8. Teste LOCAL-FIRST (antes de a Filipa ver)

### Ambiente de dev local (o concreto — dia 1 do build)
- **DB:** **Supabase local** via `supabase start` (Docker oficial: Postgres+pgvector+Auth+
  Storage no PC) — NÃO usar a Supabase de produção da VPS para dev. Migrações Drizzle
  contra o local.
- **Serviços:** `docker compose -f docker-compose.dev.yml up` sobe web(Next dev)+ws+
  realtime+agent+face+redis; o desktop (Electron) corre `npm run dev` apontando ao WS local.
- **Chaves (dev):** `OPENROUTER_API_KEY` (nossa); `SONIOX`/`LIVEKIT` (dev do
  cmtec-voice-platform); Apify (tokens existentes); Brave (free, a localizar). `.env.local`
  gitignored (ou `.env.dev.enc` sops).
- **Modelos baratos em dev:** pôr os slots `LIVE`/`ARCHITECT` num modelo barato do
  OpenRouter enquanto se itera; subir a qualidade só para o teste de entrevista a sério.
- **Seed:** script que cria 1 agência (IRIS) + 1 recrutador (Filipa) + 1 cliente + 1 vaga
  + 1 candidato — arranca com dados, evita o estado vazio a cada reset.

1. **Correr local** (Docker Compose, nossas chaves).
2. **E2E local:** criar cliente+vaga → briefing → **entrevista SIMULADA em tempo real**
   (Mateus + um amigo, pagando Soniox + ticks) → veredito ao vivo → parecer → Q&A.
3. **Validar custo** numa sessão ~1–2h (dashboard tokens + Soniox/hora) — provar a
   constância (`REVISAO-360` B6).
4. **Só depois** subir para a **Nossa infra** (Fase 1, este runbook) e mostrar à Filipa.

> **A Filipa só vê quando já funciona.** Local primeiro, sempre.

---

## 9. Estado

- **Nada construído ainda** — plano de infra/migração das Partes 1+2.
- ⚠️ **LEMBRETE VIVO** (memória `project_rh_automacao_copiloto_2026_06_17`): *não
  esquecer de migrar local → nossa infra → comprador, e correr o checklist do §3 em
  cada salto.*
