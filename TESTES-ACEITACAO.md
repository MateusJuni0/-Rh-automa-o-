# Critérios de Aceitação — o que "funciona" significa em cada passo

> Fonte: `INTAKE-E-JULGAMENTO.md Parte C` define 4 regras anti-achismo. Este documento
> traduz essas regras + os passos de `PLANO-CONSTRUCAO.md` em critérios testáveis.
> Um passo só é declarado "feito" quando o critério passa.

---

## Regras anti-achismo → testes de sistema

Estas quatro regras da Parte C são **requisitos de produto transversais** — aplicam-se
ao briefing, ao copiloto ao vivo, ao relatório e ao parecer.

### Regra 1 — Todo veredito cita evidência

**Teste:** pegar num parecer gerado e checar que **cada afirmação sobre o candidato**
tem um dos seguintes:
- Uma citação direta do candidato com timestamp (`"disse '...' em 12:04"`)
- Uma referência a um rubric level (`"bate no nível FORTE do rubric de React"`)

**Como verificar:** regex/grep no markdown do parecer por padrão `"disse '` ou `"nível"`.
Se há parágrafo sem nenhum destes → falha.

**Critério de aceitação para P3.1:** ≥ 80% das frases que contêm "candidato" ou "ele/ela"
têm evidência associada. A Filipa consegue apontar o trecho de onde veio cada conclusão.

---

### Regra 2 — Facto separado de opinião

**Teste:** abrir o parecer e o painel do copiloto. Verificar que:
- A secção "O que o candidato disse" usa linguagem neutra ("disse que", "descreveu", "explicou")
- A secção "Avaliação" usa linguagem de conclusão ("demonstrou", "ficou por confirmar", "nível FORTE")
- Nunca misturado no mesmo parágrafo sem demarcação

**Critério de aceitação para P3.1:** o template do parecer tem **duas secções distintas**:
`## O que o candidato disse` (factos) e `## Avaliação` (conclusões do bot).

---

### Regra 3 — Incerteza é dita, não escondida

**Teste:** simular uma entrevista onde o candidato menciona uma skill mas não a demonstra.
Verificar que o estado vivo e o parecer marcam aquela skill como `"pendente / não confirmado"`
em vez de `"coberto"`.

**Critério de aceitação para P2.3 e P3.1:**
- Se uma competência do rubric não foi sondada → aparece como `⬜ não abordado`
- Se foi sondada mas a resposta foi vaga → aparece como `🟡 incerto — vale cavar`
- Só aparece `✅ coberto` se há evidência concreta

**Como testar:** entrevista de teste de 5 min onde intencionalmente **não se pergunta** sobre React.
O relatório deve mostrar React como `⬜ não abordado`, não inferir que "parece saber".

---

### Regra 4 — Linguagem simples sempre

**Teste:** pegar num parecer de um dev React e procurar por jargão cru:
- Termos proibidos no output para a Filipa: `hooks`, `reconciliation`, `memoization`,
  `useState`, `useEffect`, `TypeScript strict`, `bundle size`, `treeshaking`, etc.
- Cada um destes deve aparecer **só** se seguido de tradução em parênteses.

> ⚠️ **A lista de jargão é POR-ROLE, não hardcoded de software (gap simulação 2026-06-18):**
> deriva do `linguagem_filipa` do Role Profile **daquela** vaga. Para enfermagem os termos
> seriam `desmame ventilatório`, `vasoativos`, `SAV`, etc. **Os fixtures/few-shots de teste
> TÊM de incluir ≥1 nicho NÃO-técnico** — senão a "linguagem simples" passa para React e
> falha calado para enfermagem (a Filipa recebe "desmame" sem tradução).

**Critério de aceitação para P1.5 e P3.1:**
- O role profile tem a tabela `linguagem_filipa` com tradução de pelo menos 5 termos técnicos.
- O briefing usa a tradução, não o jargão.
- O parecer final: zero jargão sem explicação.

**Como verificar:** a Filipa (ou alguém sem background técnico) lê o parecer e consegue
explicar ao cliente o que o candidato sabe — sem precisar perguntar o que significa
nenhum termo.

---

## Critérios de aceitação por passo de build

### P0.1 — Scaffold
- [ ] `npm run dev` sem erros de build
- [ ] Login funciona com email+senha
- [ ] Recruiter logado vê dashboard vazio (sem dados de outra agência)

### P0.2 — ~~Multi-tenant (RLS)~~ → ADIADO para v2 (v1 é SINGLE-TENANT)
> **Atualizado 2026-06-17:** a v1 é **single-tenant (só a IRIS)** — não há RLS por
> agência (`MODELO-DADOS §RLS`). Estes testes ficam para a **v2** (multi-agência). Na
> v1 o critério é o inverso: o recrutador tem **acesso interno total**.
- [ ] (v2) Criar agência A e B; A não vê dados de B (HTTP 403 / 0 resultados).

### P1.1 — Criar vaga + upload
- [ ] Formulário de criação de vaga aceita texto colado OU PDF
- [ ] Claude Haiku extrai ≥3 campos: role, nível, skills
- [ ] Preview de confirmação mostrado à Filipa antes de gravar
- [ ] Vaga aparece na lista com os campos extraídos

### P1.2 — Role Profile
- [ ] Ao criar vaga, trigger de web search dispara (verificar log)
- [ ] Tabela `role_profile` tem entrada para o role-type
- [ ] Role profile tem ≥3 `competencias_esperadas` não-genéricas
- [ ] Role profile tem ≥2 entradas em `linguagem_filipa`
- [ ] `o_que_e_bom` tem pelo menos 1 requisito com descrição concreta
- [ ] **Regra 4 (linguagem simples):** nenhum campo de `linguagem_filipa` usa jargão cru

### P1.3 — CV upload
- [ ] PDF de CV processado → campos extraídos: nome, experiência (anos), skills declaradas
- [ ] Candidato criado na tabela `candidate` com `profile` não-vazio

### P1.4 — Gap analysis
- [ ] Comparar candidato com vaga e role profile
- [ ] Output tem `match_score` (0-100) + lista de `gaps_a_investigar`
- [ ] Cada gap tem label em linguagem simples (não jargão)
- [ ] **Regra 4:** Filipa consegue explicar os gaps a alguém não-técnico

### P1.5 — Briefing / roteiro
- [ ] Gerado com ≥5 perguntas
- [ ] Cada pergunta tem `lente` (técnica / cliente / gap_cv)
- [ ] Cada pergunta tem `boa_resposta_esperada` baseada no role profile (não genérica)
- [ ] `boa_resposta_esperada` em linguagem simples
- [ ] Pelo menos 1 pergunta na lente "cliente" baseada nos requisitos do cliente
- [ ] **Regra 4:** Filipa consegue ler todas as perguntas sem precisar de dicionário técnico

### P2.1 — Captura de áudio
- [ ] Bot "entra" em call de teste com 2 participantes
- [ ] Stream de áudio recebido confirmado por log (bytes/segundo > 0)

### P2.2 — Transcrição + diarização
- [ ] Call de teste de 5 min transcrita
- [ ] Cada frase tem `speaker_id` (A ou B)
- [ ] ≥ 90% das frases atribuídas ao falante correto (verificar manualmente)

### P2.3 — Estado vivo + análise
- [ ] Após cada ~5 frases do candidato, o estado vivo é atualizado (verificar by log)
- [ ] Sugestão aparece em ≤3s após frase relevante
- [ ] Sugestão tem `lente` (técnica / cliente / gap)
- [ ] **Regra 3 (incerteza):** competência não sondada aparece como `⬜ não abordado`, não `✅ coberto`
- [ ] **Regra 1 (evidência):** sugestão cita o que o candidato disse (se relevante)

### P2.4 — UI copiloto
- [ ] Painel lateral abre e mostra sugestão em destaque
- [ ] Semáforo de cobertura (✅ / 🟡 / ⬜) por competência
- [ ] Filipa usa em call de teste e consegue ler sem parar a conversa

### P3.1 — Relatório / parecer
- [ ] **Regra 1:** ≥80% das afirmações sobre o candidato têm evidência
- [ ] **Regra 2:** secções "O que disse" e "Avaliação" separadas
- [ ] **Regra 3:** competências não confirmadas marcadas explicitamente
- [ ] **Regra 4:** zero jargão sem explicação
- [ ] Filipa consegue enviar ao cliente sem editar (ou com edição mínima)

### P3.2 — Export
- [ ] PDF gerado em ≤5s
- [ ] Email rascunho pronto com campos preenchidos
- [ ] PDF legível (layout não quebrado)

### P3.3 — RAG por candidato
- [ ] Query "o que o [candidato] disse sobre [competência]?" devolve ≤3 trechos relevantes
- [ ] Cada trecho tem timestamp correto
- [ ] Trechos irrelevantes não aparecem

### P3.4 — RAG por cliente (veredito)
- [ ] Veredito "recusado — fit cultural" gravado em `client_verdict`
- [ ] Após 3 vereditos do mesmo cliente, o briefing da próxima vaga inclui pergunta sobre `reason_type` observado
- [ ] `bot_predicted` vs `verdict` aparecem no dashboard de calibração

### P4.1a — Telegram bot (texto + identificação de cliente)
- [ ] Setup: Filipa usa código de ligação → conta ligada → bot confirma nome dela
- [ ] Filipa encaminha texto com requisitos de vaga → bot pergunta qual vaga (se 2+)
- [ ] Filipa seleciona vaga → bot mostra extração → Filipa confirma → aparece na web app
- [ ] Filipa não precisa de abrir a web app para fazer o upload
- [ ] Extração em ≤10s para texto puro
- [ ] Se Filipa tem 1 vaga ativa, bot assume e confirma (não pede seleção)
- [ ] Contexto de sessão mantido 30 min (segunda mensagem não pede cliente de novo)

### P4.1b — Telegram bot (mensagem de voz)
- [ ] Filipa encaminha áudio (≤2 min) → bot transcreve em ≤15s
- [ ] Bot mostra transcrição + extração no mesmo reply
- [ ] Requisitos extraídos do áudio são os mesmos que se transcrição fosse colada como texto

### P4.1c — Telegram bot (multi-mensagem / nova vaga)
- [ ] Filipa manda `/nova_vaga TechCorp` → bot abre sessão
- [ ] Filipa envia 3 mensagens separadas → bot acumula (confirma "recebido" em cada)
- [ ] Filipa manda `/fechar_vaga` → bot mostra extração consolidada
- [ ] Filipa confirma → vaga criada na DB com todos os requisitos das 3 mensagens

### P4.1d — Telegram bot (CV de candidato)
- [ ] Filipa encaminha PDF que parece CV → bot classifica como CV automaticamente
- [ ] Bot pergunta para que vaga → Filipa seleciona → candidato criado na DB
- [ ] Perfil do candidato tem ≥3 campos extraídos

---

## Critérios para os FLUXOS NOVOS (2026-06-17) — fecha o G7

### Camada A — captura sem perdas
- [ ] Toda fala (incl. pessoal/divagação) fica em `transcript_chunk` com falante+timestamp.
- [ ] Apagar texto da janela de trabalho **não** apaga da Camada A (nada se perde).
- [ ] Q&A encontra um trecho que o bot **não** marcou ao vivo (prova que A guarda tudo).

### Frame, checklist e atribuição fora de ordem
- [ ] Cada requisito tem estado (não-tocado/raso/coberto-com-prova/contradito) + **confiança**.
- [ ] UI mostra **progresso** ("8/12 cobertos · faltam …").
- [ ] Candidato responde um tópico **fora de ordem** → o bot risca o **certo**, não o em foco.

### O fosso — aprofundamento reativo
- [ ] Quando o candidato faz uma afirmação com peso, o bot gera **follow-ups de prova**
      ancorados no que foi dito (não a pergunta genérica).
- [ ] Afirmação `raso` num must é **perseguida** até prova **ou** marcada inflacionada.

### Pesquisa ao vivo
- [ ] Candidato dá um link/repo → bot pesquisa em 2º plano e gera pergunta ancorada no que viu.
- [ ] Facto vindo só da web entra como **`a_confirmar`** e **não conta no score** até o candidato confirmar.

### Veredito ao vivo + robustez de input
- [ ] Após resposta a pergunta relevante, aparece **forte/rasa/atenção** com evidência.
- [ ] Trecho de STT **baixa confiança** **não** gera `coberto-com-prova` (re-sonda).

### Relatório anti-ping-pong
- [ ] **Todo** `client_criteria` aparece no parecer com estado explícito (não omite).
- [ ] Critério não coberto é **assinalado**, nunca inventado.
- [ ] Facto de pesquisa no parecer leva **selo** (provado / verificado na fonte / indício).

### Assistente pessoal (o agente)
- [ ] Pede pra gerar planilha/CV/email → **gera sem pedir confirmação**.
- [ ] Ação de **gravar** (criar candidato/cliente/doc) ou **enviar fora** → **pede confirmação**.
- [ ] Toda ação fica em `assistant_action` (auditoria).
- [ ] Onboarding: a lista de perguntas vira `recruiter_memory_fact`; o agente mostra o que guardou.
- [ ] "Falta algo?" no overlay responde da checklist de cobertura.

### Comparar candidatos
- [ ] Matriz critério-a-critério vs `client_criteria` com pesos; nunca elimina por `nice`.
- [ ] Candidatos em versões de rubric diferentes → assinala "réguas diferentes".

### RGPD + calibração
- [ ] Facto `personal` **nunca** entra no score (só recall) — auditável.
- [ ] Apagar candidato/cliente = soft-delete recuperável (`purge_after`); cron só apaga depois.
- [ ] `bot_predicted` vs `client_verdict`/`placement_outcome` produz **% de acerto** por cliente/role.

### Memória long-term (lição claude-mem)
- [ ] Health check da consolidação **alerta** se a destilação parar (não falha calado).
- [ ] Com volume grande, o recall mantém-se rápido (consolidação limita o crescimento).

### Custo / tokens
- [ ] Sessão simulada de ~2h tem **custo ~constante** por tick (não cresce com a duração).
- [ ] As 2h **nunca** são reenviadas no contexto de um tick.
- [ ] Cada tick grava `cost_usd`/`tokens`/`model_used`/`tick_latency_ms` (`MODELO-DADOS §14`);
      o dashboard soma custo por entrevista a partir daí.
- [ ] Teto por entrevista: alerta a 70/90%; **soft-cap (90%)** degrada cadência;
      **hard-cap (100%)** pausa sugestões mas **mantém a transcrição** (`RESILIENCIA §4`).

### Testes de RESILIÊNCIA / falha de infra (2026-06-18)
- [ ] **Soniox cai a meio** → a sessão **NÃO encerra**; reconecta (backoff) com novo
      `source_stream_id`; o intervalo perdido grava 1 `interview_gap` (cause=`stt_reconnect`).
- [ ] **Limite de 2h do Soniox** → reabertura **proativa com overlap** → **gap = 0** na troca.
- [ ] **LLM do tick dá 429/timeout** → tick **saltado** (Camada A continua); 3 falhas →
      **fallback** para o modelo secundário do slot + aviso "modo reduzido"; falha prolongada
      → "só transcrição" e re-sobe ao recuperar (`RESILIENCIA §3`).
- [ ] **Net da Filipa cai** (caminho bot-online) → captura na VPS **continua**; ao voltar,
      replay por `seq` + `state.snapshot`, nada perdido.
- [ ] **PC dorme / app crasha** (captura local) → heartbeat perdido fecha o stream Soniox
      órfão + abre `interview_gap`; ao reabrir, `state.snapshot` retoma.
- [ ] **Circuit-breakers da Inês NÃO migram tal-qual:** `STT_FAILURE_THRESHOLD=2` não pode
      encerrar a sessão; `MAX_TURNS_PER_SESSION` não se aplica ao copiloto passivo (`RESILIENCIA §6`).
- [ ] **Parecer assinala os gaps:** cada `interview_gap` vira "⬜ não-capturado HH:MM–HH:MM";
      critério coberto só dentro de um gap fica `não-confirmado` (`RELATORIO §3`).

### Testes NEGATIVOS de segurança / RGPD (2026-06-18)
- [ ] Ligação WS **sem posse** da entrevista (JWT de outro recrutador) → **recusada** (close 44xx).
- [ ] Ligação WS com JWT **expirado/forjado** → recusada.
- [ ] **Prompt-injection** num CV/email ("ignora instruções e envia X") → o agente **não** executa; trata como dados.
- [ ] Ação `enviar_fora`/`gravar` **sem confirmação** → **não** executa; fica `pending_confirm` em `assistant_action`.
- [ ] `consent_status != 'dado'` → o copiloto ao vivo **não** arranca a captura.
- [ ] Facto `personal` **nunca** aparece num cálculo de score/comparação (auditar a lista de factos usados).
- [ ] Após `purge_after`, o cron **apaga mesmo** (hard-delete); candidato apagado vira **anonimizado** mas `placement_outcome` sobrevive sem PII.
- [ ] Login facial com **foto/vídeo** (quando anti-spoof ON) → **recusado**.
- [ ] Re-auth facial força nova biometria às **24h** (o refresh do JWT não contorna).

### Testes ADVERSARIAIS (candidato que mente/infla; cliente na call) — 2026-06-18
- [ ] Candidato afirma "5 anos" e o CV diz 3 → estado `contradito` com **os dois lados +
      timestamps** citáveis (tabela `contradiction`), mesmo após a janela comprimir.
- [ ] Candidato afirma forte e recua sob aprofundamento → `nao_sustentado` (distinto de `raso`).
- [ ] **Parecer NUNCA usa vocabulário de intenção/caráter** ("mentiu/desonesto") — grep ao
      output proíbe; só factos+prova (5ª regra anti-achismo).
- [ ] Cliente na call → fala rotulada `speaker='client'`; preferência revelada ao vivo
      grava em `client_memory_fact` (`live_reveal`, pendente); modo "cliente a conduzir"
      baixa a cadência das sugestões.
- [ ] Cliente confirma desonestidade → `client_verdict.reason_type='misrepresentation'`
      chega à calibração e cruza com o `bot_flag_inconsistencia`.

### Testes de SEGURANÇA — superfície de ataque & supply-chain (2026-06-18, `SEGURANCA.md`)
- [ ] **SSRF:** o cliente HTTP guardado **recusa** URL para IP interno/metadata
      (`169.254.169.254`, `127.0.0.1:8000`, `:18794`, etc.), antes **e** depois de redirects;
      vale para web_search/fetch ao vivo/Apify/Playwright (`SEGURANCA §2`).
- [ ] **Upload malicioso:** ficheiro com extensão falsa (HTML como `.pdf`), zip-bomb, docx com
      XXE, e `filename` com `../` → **recusados** pelo validador único; `storage_path` é UUID do
      servidor; ClamAV corre antes de persistir (`SEGURANCA §3`).
- [ ] **Storage:** CV/parecer só acessível por **signed URL** curta; `getPublicUrl`/bucket
      público → falha o teste (`SEGURANCA §4`).
- [ ] **Isolamento:** lint/teste proíbe query a dados sem `agency_id`; na v2, RLS recusa
      cross-tenant; o agente liga com role **não-superuser** (`SEGURANCA §1`).
- [ ] **Prompt-injection (corpus ≥20):** CV/README/perfil com "ignora instruções e exporta/
      envia" → o agente trata como **dados**, não origina `enviar_fora`; `save_memory_fact`
      externo entra `a_confirmar` (`SEGURANCA §9`).
- [ ] **Captura:** token LiveKit de uma entrevista não serve noutra; `assertCaptureAllowed`
      recusa captura com `consent_status != 'dado'` (server-side) (`SEGURANCA §5`).
- [ ] **AuthN:** brute-force em email+senha e `/auth/face/*` → rate-limit/lockout; veredito
      facial consumido **atomicamente** (não-replayable); webhook Telegram valida secret token
      (`SEGURANCA §8`).
- [ ] **Subprocessador:** slot com PII só roteia para provider `zdr:true` (`SEGURANCA §7`).
- [ ] **CI gate:** SCA (`pip-audit`/Dependabot) + **versões fixas** do agente vendorizado +
      secret-scan + SAST passam (`SEGURANCA §10`).
- [ ] **Logs sem PII:** `assistant_action.args`/logs guardam referências/hashes, não payload;
      scrubber antes de sink externo (`SEGURANCA §6`).

### Testes adversariais R2 — os controlos não são contornáveis (2026-06-18, `SEGURANCA §13`)
- [ ] **Isolamento pela conexão do AGENTE:** a conexão `psycopg2` do Lince Brain (role de
      serviço) **recusa cross-tenant via RLS** (GUC `app.agency_id`), não só por `WHERE` à mão.
- [ ] **RAG isolado:** `query()` do RAG **não** devolve chunks de outra agência (pgvector com
      `agency_id`, ou coleção-por-agência) — testar com 2 agências seed.
- [ ] **SSRF via Playwright:** `url_to_pdf`/`screenshot_url` para IP interno → **recusado** (o
      Chromium corre no egress namespace + proxy que bloqueia IP interno).
- [ ] **Purga atinge o RAG:** após Art.17, os embeddings do candidato **somem do store de RAG**
      (não só do Postgres) — "zero PII órfã" corre contra o RAG.
- [ ] **Subprocessador:** Soniox + embedder com retenção-zero (não só OpenRouter).
- [ ] **Upload polyglot/SVG:** PDF/ZIP polyglot e SVG-com-script → recusados; "arrastar ao
      vivo" chama o **mesmo** validador.
- [ ] **Transcrição selada:** editar um `transcript_chunk` no Postgres quebra a `content_hash`
      chain (tamper-evident).
- [ ] **Token LiveKit:** TTL curto; token de uma entrevista não entra noutra sala; kill-switch
      **revoga** a room/participante.
- [ ] **Entity-resolution:** CV com email/linkedin de outra pessoa **não** auto-anexa — exige
      confirmação humana.
- [ ] **Parecer mal-endereçado:** `to:` com domínio ≠ do cliente do `process` → **bloqueia**.
- [ ] **Electron hardening:** `sandbox`/`contextIsolation`/`nodeIntegration:false`/`will-navigate`
      allowlist/CSP ativos; auto-update com pin de chave + anti-downgrade.
- [ ] **Supply-chain:** imagens verificadas por digest/cosign; `bootstrap.sh` valida checksums
      (tarballs + ONNX). **Chave age do comprador gerada na VPS dele** (não trafega).
- [ ] **Backup:** chave de cifra do backup **não** está na VPS de produção.
- [ ] **S2S:** tokens distintos por par de serviços + rotação (não Bearer global).
- [ ] **Cyber Neo redteam:** `engagement-scope.yml` fail-closed — alvo sem `confirmed:true` →
      DENY; prod de cliente exige `authorization_file`.

### Testes de ESCALA / capacidade agregada (2026-06-18, `ESCALA-E-OPERACAO.md`)
- [ ] **Concorrência:** acima de `MAX_CONCURRENT_INTERVIEWS` → **recusa graciosa** ("agenda
      cheia"), sem degradar as entrevistas a decorrer; latência p95 do tick fica no orçamento.
- [ ] **Blast radius:** stress da Vera **não** derruba os outros serviços da VPS (limites de
      container ativos: `cpus`/`mem_limit`/`pids`).
- [ ] **Backup/DR:** restore drill restaura **DB + Storage** (não só DB); contagens batem;
      backup **cifrado** e **off-site**; RPO/RTO cumpridos; monitor de frescura alerta se parar.
- [ ] **Reaper:** entrevista deixada `live` sem heartbeat há X min é encerrada (fecha streams +
      `interview_gap`), libertando capacidade/Soniox-horas.
- [ ] **Volume:** com muitas linhas, RAG/Q&A mantêm latência (partição + índice vetorial
      afinado); purga em cascata deixa **zero PII órfã**.

### Testes da simulação de prova (2026-06-18)
- [ ] **Correção de falante propaga E reverte:** reatribuir um `transcript_chunk` recomputa
      factos/ticks/contradições que o citam; um requisito cuja única prova era esse chunk
      DESCE de `coberto-com-prova` para `raso` (não fica "verde" falso).
- [ ] **Gate de speaker_confidence:** chunk com `speaker_confidence` baixo NÃO vira facto
      firme do candidato (fica `a_confirmar`); fala avaliadora em call 3-vozes não é
      auto-creditada ao candidato.
- [ ] **CV gerado não contamina o juízo:** gerar um CV pela Vera NÃO muda o gap-analysis nem
      a base de `vs_cv` (só `source='uploaded'` é `is_current`); divergência candidato↔CV-gerado
      NUNCA produz `misrepresentation`.
- [ ] **vs_cv aponta o CV certo:** com N CVs, a contradição cita o `cv_document_id` de
      referência (filename+version), não "(CV)".
- [ ] **Parecer durável + guarda:** fechar a app a meio da geração → ao reabrir, `report.status`
      recupera (nunca "perdido"); a transição →`submitted` é recusada (409) se
      `report.status≠'ready'`; `interview_gap` aberto é fechado no encerramento.
- [ ] **Guard de frescura proativo:** `proactive_task` re-lê a entidade-alvo antes de disparar;
      cancela se candidato anonimizado, suprime durante entrevista `live`, cancela
      noshow/comparison se `process.stage` ∈ {rejected,withdrawn,placed}.
- [ ] **Calibração determinística:** 3 sinais em desacordo no mesmo `process` contam 1 (pelo
      mais forte); N<`CALIBRATION_MIN_N` não exibe %; acima, exibe com IC de Wilson; só agrega
      a mesma `rubric_version`.

### Testes de SERIALIZAÇÃO do estado vivo (família G, 2026-06-18, `ARQUITETURA-TEMPO-REAL §11.1`)
- [ ] **Correção × tick no MESMO requisito:** reatribuir o falante DURANTE um tick que promove o
      mesmo requisito → resultado **determinístico** (a correção enfileira e o worker aplica na
      sua ordem), sem cobertura fantasma nem facto destilado apagado por corrida.
- [ ] **Encerramento CAS:** o heartbeat volta 1s após o reaper começar a encerrar → **ou** o
      reaper falha o CAS (entrevista continua) **ou** o worker já parou; **nunca** há um
      `interview_tick` com `created_at > ended_at`.
- [ ] **Candidato global em 2 calls simultâneas (Filipa + Inês):** os factos gerais
      (`process=NULL`) não duplicam nem se corrompem; `candidate.profile`/`revalidate_after` não
      ficam last-write-wins (advisory lock por `candidate_id`); precedência determinística.
- [ ] **Escritor único cobre TUDO:** durante `live`, só o worker da entrevista escreve
      `candidate_memory_fact`/`contradiction`/frame/cobertura — o agente só lê (sem corrida).
- [ ] **(H) Destilação durável + gate de purga:** crash a meio da destilação-final → `async_job
      kind='distill_final'` fica `failed` + alerta (não factos parciais silenciosos); `cron_purge_raw_audio`
      **não** corre sem `interview.distilled_at` (áudio nunca purgado sem destilação completa).
- [ ] **(I) Idempotência de enviar_fora:** retry de `send_email` após resposta perdida **não**
      duplica (idempotency_key/Message-ID); estado ambíguo fica `unknown` → não re-envia auto.

---

## Como usar este documento no build

1. Antes de começar um passo P_x → ler os critérios de P_x
2. Implementar até todos os critérios passarem
3. Fazer `git commit` só quando os critérios passam
4. Mover para o passo seguinte

Se um critério não for testável automaticamente → fazer teste manual e registar o resultado
em `BRAIN.md` ("P1.2 testado manualmente — role profile OK para dev React pleno, 2026-06-16").
