# Prompt para o ChatGPT — revisão do git da Vera (pós loop de segurança)

> Cola o bloco abaixo no ChatGPT (com acesso ao repo). Atualizado 2026-06-18, depois das
> 3 rondas de simulação + 2 rondas de segurança. Estado: **só SPEC, sem código** (Fase 3 =
> codar, será noutra sessão).

---

Estás a rever a **especificação** de um produto que ainda **não tem código** (estamos na
fase de spec; a fase de código vem a seguir, à parte). Quero uma revisão crítica e técnica,
não elogios.

**Produto:** "Vera" (nome interno "Lince") — um **copiloto de IA para recrutamento ao vivo**.
Serve uma recrutadora **não-técnica** ("Filipa", agência IRIS). Estuda a vaga + o cliente,
**ouve a entrevista ao vivo** (até 2h, com diarização), sugere perguntas em 3 lentes
(técnica / lente-do-cliente / gaps do CV) e **aprofunda** as respostas, e entrega um
**parecer pronto**. Lida com **dados sensíveis de terceiros** (CV, contactos, gravação/
transcrição de entrevistas, por vezes saúde em nichos clínicos). **É um produto para vender**
a outras agências: hospedado por nós primeiro, depois migrado para a VPS do comprador como
**instância independente** (sem cordão umbilical).

**Stack:** Next.js 15 (App Router) + serviços Python (FastAPI: realtime/agent/face) +
Supabase self-hosted (Postgres + pgvector + Auth + Storage) + WebSocket próprio +
LiveKit/Soniox (transcrição/diarização ao vivo) + biometria clonada (cmtec-face) + agente
clonado (Lince Brain: LangGraph + tools + auditoria hash-chain + kill switch) + app desktop
Electron (overlay). Modelos de chat via OpenRouter (slots agnósticos); embedder OpenAI e STT
Soniox **não** passam pelo OpenRouter. Segredos sops+age. Tudo em Docker Compose, túnel
Cloudflare. **v1 = single-tenant** (só IRIS, sem RLS ativa); **v2 = multi-agência**.

**Repo:** https://github.com/MateusJuni0/-Rh-automa-o- — **branch `spec/evolucao-2026-06-17`**.
Começa pelo `README.md` (índice de 40 docs + "Portas" + "Decisões 🟦"). Docs-chave:
`BUILD-READY.md`, `ARQUITETURA-INTEGRACAO.md` (monorepo/contratos), `ARQUITETURA-TEMPO-REAL.md`
(copiloto ao vivo), `MODELO-DADOS.md` (33 tabelas), `SEGURANCA.md`, `ESCALA-E-OPERACAO.md`,
`AUTH-CONTRACT.md`, `INFRA-E-MIGRACAO.md`, `RESILIENCIA-E-FALHAS.md`, `engagement-scope.yml`.

**O que mudou desde a tua última revisão (faz 2 saneamentos):**

*Saga de simulação (3 rondas):* arranque a frio a meio de entrevista; runtime do agente
descido ao schema (conversa/contexto/jobs/dedup/órfã); cenário adversarial (candidato que
infla, cliente na call → anti-difamação, contradição persistida); falha de infra a meio de 2h
(reconexão STT, fallback de modelo, teto de custo por entrevista, intervalos não-capturados).

*Saga de segurança (2 rondas — auditoria + red-team com a nossa metodologia "Cyber Neo"):*
- **Isolamento de tenant como defesa-em-profundidade desde a v1** (`agency_id` predicado
  obrigatório em todo o acesso; roles Postgres least-privilege; service-role só em migrações).
  **Correção importante:** o **agente Python** (psycopg2, role único) contornava isto — a RLS
  por `auth.uid()` é inerte para um serviço → usa-se **GUC `app.agency_id`** + RLS por
  `current_setting`. E o **RAG real era ChromaDB global sem tenant** → passa para **pgvector**.
- **Anti-SSRF centralizado** (o bot puxa URLs do candidato + Exa/Brave/Apify) — um cliente
  HTTP guardado que bloqueia IP interno; **o Playwright fura isto** (browser não usa o cliente
  Python) → corre em **egress namespace sem rota interna + proxy**.
- **Validador único de upload de CV** (magic-bytes, XXE, polyglot, SVG, path-traversal, ClamAV).
- **Storage** privado + signed URLs por `agency_id`; **cifra em repouso** + **backups cifrados
  com chave off-VPS**; **OpenRouter ZDR** + estendido a **Soniox e ao embedder** (veem 100% da
  PII e não passam pelo OpenRouter).
- **authN** (rate-limit/lockout, veredito facial atómico, device-id assinado, Telegram secret
  token); **transcrição selada** (hash-chain, é a fonte de verdade do parecer); **S2S por par
  + rotação**; **TTL/revogação do token LiveKit**; **anti entity-resolution poisoning**;
  **parecer anti-mal-endereçado** (destinatário validado contra o domínio do cliente);
  **hardening do Electron** (sandbox/contextIsolation/CSP) + **auto-update com pin de chave**;
  **supply-chain** (cosign + digest + checksums no bootstrap).
- **Escala agregada:** capacidade de entrevistas simultâneas (worker pool + teto + recusa
  graciosa); **blast-radius** (limites de container — a Vera não pode derrubar outros serviços
  da VPS partilhada); crescimento de dados (partição + tiering + purga em cascata); pgvector
  HNSW; **backup do Storage + DR (RPO/RTO + restore drill)**.
- **`engagement-scope.yml`** — gate fail-closed para o nosso self-pentest (Cyber Neo
  `--redteam`), staging com `confirmed:false` até ordem.

**Decisões em aberto (🟦) que deixámos para o dono do negócio — diz se concordas com o
default ou se mudarias:** (1) v2 instância-por-agência vs multi-tenant partilhado; (2) o
admin do comprador pode ver PII de candidatos?; (3) verificar identidade do candidato
(proxy-interview)?; (4) onde vive a chave de backup; (5) data-policy de Soniox/embedder;
(6) 2FA na via email+senha; (7) custódia da chave age do comprador; (8) IP/licença/code-signing.

**O que quero de ti (revê e responde a isto):**
1. **Furos que ainda restam** — vê especialmente o caminho do **agente Python** vs os controlos
   pensados para o caminho Next/Supabase (achámos que era a maior fonte de bypass; confirma ou
   acrescenta). E o **caminho ao vivo** (LiveKit/Soniox/realtime).
2. **Coerência e exequibilidade** — algo na spec se contradiz, é impossível de construir como
   está, ou tem um pressuposto errado sobre a stack?
3. **Privacidade/RGPD técnico** — a postura (cifra, retenção, purga em cascata incl. RAG, ZDR
   de subprocessadores) é suficiente para PII sensível? (Nota: a **responsabilidade RGPD é da
   agência**; a **segurança técnica é nossa** — foca o técnico.)
4. **Escala** — os tetos/decisões de raiz (capacidade simultânea, particionamento, pgvector a
   alto volume, blast-radius, backup/DR) estão certos? falta algum ponto cego agregado?
5. **As 8 decisões 🟦** — para cada uma, qual recomendarias e porquê?
6. **Prioridade** — o que é mesmo gate antes de pôr PII real / vender, vs o que pode esperar.

Sê específico (aponta ficheiro:secção), cético, e diz o que **não** farias. Lembra que é spec
viva — propõe correção concreta, não generalidades.
