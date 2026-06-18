# Segurança & modelo de ameaças — a postura técnica (lente Cyber Neo)

> **Porquê (loop de segurança, 2026-06-18):** a Vera lida com **dados de terceiros**
> sensíveis (CV, contactos, **gravação/transcrição de entrevistas até 2h**, por vezes
> saúde em nichos clínicos). Decisão LOCKED: **RGPD = responsabilidade da agência;
> a SEGURANÇA TÉCNICA é NOSSA (é qualidade).** Este doc é o que é **nosso**: os controlos
> técnicos, o modelo de ameaças e o plano de testes. Auditado com a lente do **Cyber Neo**
> (auditoria read-only + flag-para-humano 🟦 + self-pentest gated, **fail-closed**).
>
> Liga-se a: `AUTH-CONTRACT.md` (claims/posse), `AUTENTICACAO.md` (login), `LEGAL-E-RGPD.md`
> (responsabilidade), `MODELO-DADOS.md` (schema/RGPD), `AGENTE-TOOLS-E-WS.md` (tools),
> `INFRA-E-MIGRACAO.md` + `ESCALA-E-OPERACAO.md` (infra/backup/DR), `RESILIENCIA-E-FALHAS.md`.

---

## 0. Princípio-raiz: isolar por defeito + CENTRALIZAR (mata classes inteiras de bugs)

O Mateus pediu para acertar **na raiz** agora (ainda é plano) e evitar dor depois. A regra
que paga isso: **não espalhar a defesa — centralizá-la num sítio obrigatório.** Três
"funis" únicos por onde TUDO tem de passar (uma defesa, não N):

| Funil único | O que obriga | Mata |
|---|---|---|
| **Repo de dados** (todo acesso à DB) | injeta `agency_id` em **todas** as queries | fuga cross-tenant (§1) |
| **Cliente HTTP guardado** (todo egress) | allowlist + bloqueio de IP interno | SSRF / exfiltração (§2) |
| **Validador de ingest** (todo upload) | tipo/tamanho/conteúdo/antivírus | exploit de parser / malware (§3) |

> Se cada tool/rota nova **tem** de passar pelo funil, uma feature futura não consegue
> reabrir o buraco por esquecimento. É o oposto de "validar caso a caso".

---

## 1. Isolamento multi-tenant — defesa-em-profundidade DESDE A v1 (não adiar para a v2)

**O risco-raiz (3 BLOQUEADORES convergentes da auditoria):** a v1 é single-tenant e a spec
dizia "RLS é da v2". Mas o produto vai ser **clonado para a VPS de cada comprador** → na v2
multi-agência, **uma** query sem filtro de `agency_id`, ou **um** uso de `service-role` no
caminho de request, vira **fuga de candidatos/clientes entre agências**. Corrigir isso depois
= caça a queries espalhadas por `apps/web`, `packages/knowledge` e `services/agent`.

**Decisões (aplicar já na v1, mesmo sem RLS ativa):**
1. **`agency_id` é predicado OBRIGATÓRIO em todo o acesso a dados** — o repositório de dados
   (Drizzle) recebe `agencyId` e injeta-o em **todas** as queries (`eq(agency_id, …)`),
   incluindo o RAG (`*_embedding`) e a query de posse do WS. Redundante na v1, **essencial**
   na v2. RLS passa a ser a **2ª** camada, nunca a única.
2. **Least-privilege de roles Postgres (não `service-role` no request path):** um role
   dedicado por serviço (`vera_web`, `vera_agent`, `vera_face`) com **grants mínimos** e RLS
   aplicável. `service-role` (god-mode) reserva-se a **migrações**, nunca a leitura/escrita
   de pedidos. O agente Python liga com um role **não-superuser** — assim um SSRF/RCE no
   agente **não** lê a base inteira.
3. **RLS por `agency_id` ligada na v2** (políticas em `MODELO-DADOS §RLS`) — mas o código
   acima já não depende dela para isolar.

> 🟦 Mateus: confirmar que o piloto IRIS (1 agência) aceita o custo (ínfimo) de já carregar
> `agency_id` em tudo — é a apólice de seguro do produto vendável.

---

## 2. Egress guardado — anti-SSRF (o produto PUXA conteúdo não-confiável da net)

**O risco (BLOQUEADOR):** a Vera faz `fetch` a **URLs/repos dados pelo candidato ou cliente
ao vivo** (`ARQUITETURA-TEMPO-REAL §9`), e usa Exa/Brave/Apify + `document_tools`
(`url_to_pdf`/`screenshot_url` via Playwright — SSRF particularmente perigoso). Tudo na
**mesma rede Docker** (Supabase :8000, Lince :18794, Postgres :5432, Redis :6379, LiveKit
:7880). Um candidato hostil dá `http://169.254.169.254/...` (metadata cloud),
`http://127.0.0.1:8000` (Supabase), etc. → leitura de serviços internos / exfiltração. Pior:
estas tools têm `efeito: leitura` → **não passam pela porta de confirmação**.

**Contrato (todo egress por UM cliente HTTP guardado):**
- **Allowlist de esquema:** só `https` (e `http` para destinos explicitamente permitidos).
- **Bloqueio de IP interno**, resolvido por DNS **antes E depois** de redirects
  (anti-DNS-rebinding): recusar `RFC1918` (10/172.16/192.168), `127.0.0.0/8`, `169.254/16`
  (link-local/metadata), `100.64/10` (CGNAT), `::1`, ULA IPv6.
- **Sem seguir redirects** para IP interno; **timeout** + **cap de tamanho** de resposta.
- Corre num **egress namespace** sem rota para a rede interna do compose (defesa de rede,
  não só de código).
- **`join_interview {meetingUrl}`** valida contra **allowlist de domínios de reunião**
  (meet/zoom/teams) — não junta o bot a uma URL arbitrária (evita gravar terceiros + SSRF).
- **Regra de tools:** qualquer tool de `efeito: leitura` que toca a rede **é obrigada** a
  usar este cliente. Adicionar tool nova de rede = usar o funil, sem exceção.

---

## 3. Ingest de ficheiros guardado — o CV é um vetor de ataque

**O risco (BLOQUEADOR):** CVs entram por **3+ portas** (upload web, Telegram, arrastar ao
vivo) e vão a parsers PDF/docx + Storage. A spec só validava bytes na biometria. Faltam:
zip-bomb/tamanho, **magic bytes** vs extensão, **XXE** em docx (é ZIP+XML), **path
traversal** no `filename`→`storage_path`, e malware (a Filipa **reenvia** o ficheiro).

**Contrato (todo upload por UM validador):**
- **Cap de tamanho** (anti zip-bomb/DoS de disco).
- **Allowlist de MIME por CONTEÚDO** (magic bytes), não pela extensão (um `.pdf` que é HTML).
- **Parser com entidades XML/DTD desativadas** (anti-XXE no docx).
- **`storage_path` gerado pelo SERVIDOR** (UUID), **nunca** o nome do utilizador (anti path
  traversal).
- **Scan antivírus (ClamAV)** antes de persistir/reencaminhar.
- Fail-closed: ficheiro que não passa → recusado com mensagem clara (sem falha silenciosa).

---

## 4. Storage (Supabase) — bucket privado, acesso por agência, signed URLs

**O risco (BLOQUEADOR):** o RLS clonado cobre tabelas, mas **nenhum doc definia a política do
bucket** onde vivem CVs, áudios e pareceres PDF (PII). Bucket público (default fácil no
Supabase self-hosted) = link de CV/parecer enumerable/partilhável fora da agência.

**Contrato:**
- Bucket(s) **privado(s)**; caminho prefixado por **`{agency_id}/...`**.
- Acesso **só via signed URL de curta duração** emitida pelo backend **após** verificar a
  sessão e a posse — **nunca** `getPublicUrl`.
- Política de Storage por `agency_id` (a par do isolamento de dados, §1).

---

## 5. Caminho de captura — posse + consentimento aplicados no SERVIDOR

**O risco (ALTO):** a posse da entrevista está provada no **WS de leitura**, mas o **áudio do
candidato** (a PII mais sensível) entra por outro caminho (token LiveKit de `/api/interviews`).
E o gate de consentimento (`consent_status='dado'`) era "regra de produto", não preso ao ingest.

**Contrato:**
- **Token LiveKit single-use, scoped** à `interview_id` do dono (`recruiter_id`) — não serve
  para entrar noutra sala.
- **Gate de consentimento central server-side:** um único guard `assertCaptureAllowed(process_id)`
  chamado por **todos** os pontos que iniciam/retomam captura (desktop, `/api/interviews`,
  `join`, reconexão do `RESILIENCIA §1/§2`). Recusa se `consent_status != 'dado'`. O indicador
  🔴 no HUD é UI — o **controlo** é este guard, no servidor.
- Cobrir em `TESTES-ACEITACAO` (já há gate de consentimento; falta amarrar a captura).

---

## 6. Dados em repouso + backups cifrados + logs sem PII

**O risco (ALTO):** "encriptação em repouso" estava como **frase sem mecanismo**; os backups
diários (`pg_dump → /opt/backups/*.sql.gz`) ficavam **em claro** (toda a PII), inconsistente
com o bundle de migração (que é cifrado); e `assistant_action.args`/logs podiam **vazar PII**
(corpo de email, conteúdo de CV) — incl. para Langfuse (externo).

**Contrato:**
- **Em repouso:** no mínimo volume cifrado (LUKS) + **bucket de Storage cifrado**; idealmente
  **cifra a nível de coluna** (pgcrypto/app-layer) para `transcript_chunk.text`, contactos e o
  áudio — chave em **sops+age**, fora da DB. (A biometria já cifra templates AES-GCM — alinhar.)
- **Backups cifrados:** `pg_dump | age -r <chave> > dump.sql.gz.age`; chave **fora** da VPS;
  restore cifrado testado no drill mensal. (Detalhe operacional em `ESCALA-E-OPERACAO §5`.)
- **Logs/auditoria sem PII:** `assistant_action.args` guarda **referências/hashes**, não o
  payload; corpo de email/CV fora do trilho; **scrubber de PII** antes de qualquer sink
  externo. Langfuse **off por defeito** para conteúdo com PII. (Mantém-se a hash-chain de
  integridade.)

---

## 7. Subprocessadores de IA — OpenRouter no caminho da PII exige zero-retention

**O risco (ALTO):** **todo** o conteúdo sensível (transcrição ao vivo, CV, parecer, saúde)
passa por **OpenRouter**, que roteia para fornecedores terceiros — alguns retêm/treinam por
defeito. É **segurança técnica** (logo, nossa), mesmo com o RGPD do lado da agência.

**Contrato:**
- O **registry de modelos** (`MODELOS-E-API §3`) ganha uma flag **`no_logging`/`zdr`
  (zero-data-retention)**; o roteamento OpenRouter é **restrito a providers com retenção
  zero** (header de data-policy) para **slots que veem PII** (`LIVE`, `ARCHITECT`, `EXTRACTOR`).
- Provider sem essa garantia → **não elegível** para slots com PII (recusa, fail-closed).
- 🟦 Mateus: validar a política de dados do OpenRouter/providers escolhidos por deployment.

---

## 8. Autenticação — endurecer as duas portas

**O risco (ALTO/MÉDIO):** o email+senha é **alternativa direta** com acesso total e **sem
rate-limit/lockout** especificado; o anti-spoof facial está em **SOMBRA** (uma foto destrava);
o consumo do veredito facial precisa de ser **atómico** (anti-replay); o `device-id` é gerado
no cliente; o webhook do Telegram pode ser forjado.

**Contrato:**
- **Rate-limit + lockout progressivo + alerta** em `signInWithPassword` e nos endpoints
  `/auth/face/*` (brute-force). (Detalhe de WAF/rate-limit de borda em `ESCALA-E-OPERACAO §6`.)
- **Consumo atómico do veredito facial:** `UPDATE face_verdicts SET consumed_at=now() WHERE
  session_id=$1 AND consumed_at IS NULL RETURNING 1` como pré-condição do `/complete`.
- **`device-id` assinado pelo servidor** no 1º registo (via magic-link de binding), não aceite
  arbitrário do cliente.
- **Validar `X-Telegram-Bot-Api-Secret-Token`** em cada update; `telegram_chat_id` é lookup,
  nunca prova de identidade.
- **Anti-spoof `ANTISPOOF_ENFORCE=true`** antes de vender / >1 utilizador (porta já existente).
- 🟦 Mateus: decidir se a via email+senha exige **2FA** no piloto.

---

## 9. Prompt-injection / conteúdo não-confiável (o mesmo agente tem tools de `enviar_fora`)

**O risco (ALTO):** "conteúdo externo = dados, não instruções" estava **declarado sem
mecanismo**. O agente partilha o motor (Lince Brain) que tem `send_email`/`export_data`. Como
o fetch é `leitura` (flui livre) e o resultado entra no contexto, um README/perfil malicioso
pode tentar encadear *"exporta os candidatos / envia email"*. E `save_memory_fact` inferido
sem prompt abre **memory-poisoning** silencioso.

**Contrato:**
- Conteúdo não-confiável (web/CV/transcrição) entra **num canal de dados marcado**
  (delimitado/estruturado), **nunca** no slot de system/instrução.
- O planeador **não pode originar** ações `enviar_fora`/`gravar` **a partir de texto fetchado**
  — só a pedido explícito da Filipa (a porta de confirmação continua, mas a origem é vedada).
- `save_memory_fact` derivado de fonte externa é **sempre `a_confirmar`** + auditado (nunca
  auto-persistido como `direto`). (Alinha com `MODELO-DADOS §7` `estado_prova`.)
- Corpus de teste de injeção (≥20 payloads) em `TESTES-ACEITACAO` (§10 abaixo).

---

## 10. Plano de testes de segurança (porque lidamos com dados)

O `TESTES-ACEITACAO` já tem testes **negativos** (authz, JWT forjado, consent, anti-spoof) e
**adversariais**. Falta, e adiciona-se ao **gate da Fase 3**:
- **SCA / supply-chain:** `pip-audit`/Dependabot + **fixar versões** do agente vendorizado
  (`lince-brain-local` vem **sem `requirements.txt`** → dívida cega — `REUSE-MAP §2`).
- **Secret-scanning no CI/pre-commit** (`B6-pre-commit-secret-guard` já existe na CMTec; o
  projeto já teve incidente de chave vazada — MEMORY).
- **SAST** (semgrep) nas apps/serviços.
- **Fuzz de upload:** corpus de PDFs/docx malformados (zip-bomb, XXE, magic-byte mismatch).
- **Corpus de prompt-injection** (≥20 payloads), não 1 caso.
- **Testes de SSRF:** URL interna/metadata recusada pelo cliente guardado (§2).
- **Testes de isolamento:** query sem `agency_id` é proibida (lint/teste); na v2, RLS recusa
  cross-tenant.

---

## 11. Cyber Neo `--redteam` — self-pentest gated da própria Vera

Quando a Vera estiver de pé (staging), corre-se o **Cyber Neo** em modo `--redteam` contra a
**própria instância** (defesa = atacar o que é nosso para achar entradas e auto-corrigir):
- **Gate `engagement-scope.yml`** (fail-closed, `scripts/check_scope.py`): alvo
  `staging.rh.cmtecnologia.pt` com **`confirmed: true`** explícito do Mateus; **destrutivo só**
  em `env:staging` com flag. Fora da lista → recusa. (Metodologia: memória `project_cyber_neo_human_layer_2026_06_03`.)
- Loop: recon → probes **não-destrutivos** (authz-bypass/IDOR, SSRF, injection, upload) →
  **propõe-fix-para-aprovação** (alinha com a regra CMTec "não modificar sem aprovação") →
  re-testa.
- Baseline = este doc + os testes do §10. O redteam valida que os funis (§0) seguram.

---

## 12. Gates de segurança antes de ENTREGAR / VENDER (não impedem codar)

| Gate | Estado |
|---|---|
| `agency_id` em todo o acesso + roles least-privilege | desenhar na Fundação P0.1 (raiz) |
| Cliente HTTP guardado (anti-SSRF) + allowlist de reunião | antes de ligar pesquisa ao vivo |
| Validador único de upload (magic/AV/path) | antes de aceitar CVs reais |
| Bucket Storage privado + signed URLs | antes de pôr PII real |
| Cifra em repouso + backups cifrados + logs sem PII | antes de pôr PII real |
| OpenRouter ZDR para slots com PII | antes de pôr PII real |
| Rate-limit/lockout + anti-spoof ON + 2FA? 🟦 | antes de vender / >1 utilizador |
| SCA + secret-scan + fuzz + injeção no CI | gate da Fase 3 |
| Cyber Neo `--redteam` em staging | antes de vender |

> Nada disto impede **codar** — impede **entregar com PII real**. O barato é decidi-los na
> raiz (Fundação), não retrofitar depois de um incidente.
