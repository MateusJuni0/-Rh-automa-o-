# Decisões & MVP — continuando o raciocínio

> Os três primeiros documentos exploraram **o quê** e **por quê**. Aqui fechamos o
> **o quê primeiro** e o **como**. Cada recomendação vem com a razão; o que ainda
> é decisão do Mateus está marcado com 🟦 **DECISÃO DO MATEUS**.

---

## 1. A tensão que precisa ser resolvida

Há uma contradição saudável entre os documentos:

- `PLANO.md §4` prega **"comece pequeno"**: fazer só a **Fase 1** (roteiro
  assíncrono) primeiro, porque a maior incerteza é a **qualidade das sugestões**,
  não o tempo real.
- `DIA-A-DIA` e `UI-DESIGN` se empolgam (com razão) com a **jornada completa** e
  elegem o **copiloto ao vivo** como a estrela.

As duas coisas parecem brigar: "comece pequeno" vs "a estrela é o tempo real".
Elas não brigam — só foram ditas em níveis diferentes. A solução está em separar
**a jornada** (o valor) da **infra de tempo real** (o custo).

---

## 2. O insight que destrava: a jornada inteira pode ser assíncrona

Olhando a jornada `Triagem → Briefing → Copiloto → Relatório`, **só uma etapa
precisa de tempo real**: o copiloto *ao vivo* durante a call. Todo o resto —
triagem, briefing e relatório — é requisição → resposta. Assíncrono.

E o "cérebro" é o mesmo nas duas versões: as mesmas perguntas, o mesmo checklist
de cobertura, o mesmo julgamento de "boa vs fraca resposta". O tempo real só muda
**de onde vem a transcrição** (streaming ao vivo) e **quando** as sugestões
aparecem (durante vs depois). Não muda a inteligência.

> **Conclusão:** dá para entregar a **jornada completa de valor** sem nenhuma infra
> de áudio em tempo real. Basta o copiloto rodar sobre uma **transcrição já pronta**
> (colada ou de uma gravação) em vez de um stream ao vivo.

---

## 3. Escopo do MVP recomendado — "a jornada, mas assíncrona"

**MVP = `Triagem → Briefing → Relatório`, com um "copiloto sobre transcrição".**

| Etapa | No MVP (assíncrono) | Vira tempo real depois (Fase 2) |
|---|---|---|
| **Vaga** | Colar descrição crua → IA estrutura requisitos | — (igual) |
| **Triagem** | Subir N currículos → ranking por match + resumo | — (igual) |
| **Briefing** | Roteiro de perguntas + "boa vs fraca resposta" + gaps | É o que alimenta o copiloto ao vivo |
| **Entrevista** | Recrutador entrevista normalmente e **cola/sobe a transcrição** | Bot/captura entra na call e transcreve **ao vivo** |
| **Relatório** | IA gera resumo + score vs requisitos + rascunhos de e-mail | — (igual, só fica instantâneo) |

Por que este recorte é o certo:

1. **De-risca a aposta principal.** Se as sugestões e o relatório não convencem o
   recrutador **com a transcrição na mão**, nunca convenceriam ao vivo. Validamos a
   qualidade — a real incerteza — pelo caminho barato.
2. **Entrega o ciclo de valor inteiro**, não um pedaço. O recrutador sente alívio
   na triagem (porta de entrada) e o "uau" no relatório (saída).
3. **Reaproveita 100% do cérebro** quando a Fase 2 chegar: o ao vivo é "o mesmo
   produto, agora em streaming".
4. **Adia o que é caro e arriscado:** captura de áudio multiplataforma, latência,
   WebSocket e o peso de LGPD de **gravar** ao vivo.

⚠️ **SUPERSEDED (2026-06-16):** o Mateus decidiu ir **direto ao tempo real** — o
copiloto ao vivo é o MVP, não uma fase posterior. O raciocínio "async primeiro"
acima fica como registo do caminho que **não** seguimos. A arquitetura escolhida
está em **[`ARQUITETURA-TEMPO-REAL.md`](./ARQUITETURA-TEMPO-REAL.md)**.

O "antes" (triagem, briefing) e o "depois" (relatório) continuam assíncronos; o
**"durante" é ao vivo** desde o início.

---

## 4. Stack — recomendação fechada (a confirmar)

Uma stack só, alinhada com o que a CMTecnologia já domina e opera:

| Camada | Escolha | Razão |
|---|---|---|
| Frontend + Backend | **Next.js 15 (App Router)** — Route Handlers / Server Actions | uma linguagem só (TS); o MVP é todo request→response, não precisa de servidor à parte |
| Validação | **Zod** | contratos de vaga/candidato/roteiro validados na fronteira |
| IA | **API Anthropic (Claude)** | ver §5 |
| Banco | **PostgreSQL (Supabase)** | a CMTec já roda Supabase self-hosted; reuso de infra |
| Auth | **Supabase Auth** | recrutador faz login; multi-tenant por agência depois |
| Hospedagem | a definir (Vercel ou VPS CMTec) | mesma decisão que os outros produtos |

Por que **não** Python no backend: não há, no MVP, nada que justifique uma segunda
stack (sem ML caseiro, sem pipeline de dados pesado). Tudo é "chamar o Claude e
guardar no Postgres". Uma stack só = menos atrito, menos deploy, mais velocidade.

> **Reuso importante para a Fase 2:** a CMTec já tem transcrição PT-PT/PT-BR em
> produção no `cmtec-voice-platform` (Soniox + LiveKit). O serviço de transcrição
> ao vivo da Fase 2 provavelmente **não precisa ser construído do zero** — herda-se
> dali. Isso reforça deixar o tempo real para depois: ele já tem caminho.

🟦 **DECISÃO DO MATEUS:** confirmar Next.js + Supabase, e onde hospedar.

---

## 5. Modelos de IA — por tarefa

Confirmado contra a referência atual da Anthropic (jun/2026):

| Tarefa | Modelo | ID | Razão |
|---|---|---|---|
| Estruturar vaga (colar → campos) | Haiku 4.5 | `claude-haiku-4-5-20251001` | extração simples, barato e rápido |
| Triagem / match de CVs | Sonnet 4.6 | `claude-sonnet-4-6` | volume (N CVs) com bom julgamento; custo controlado |
| Gerar o **roteiro** (briefing) | Opus 4.8 | `claude-opus-4-8` | é o "uau" de qualidade; vale o custo, é 1× por vaga |
| Relatório pós-entrevista | ~~Sonnet 4.6~~ → **Opus 4.8** | `claude-opus-4-8` | **reclassificado 2026-06-17:** é o entregável ao cliente, sem pressão de tempo → qualidade. Ver `MODELOS-E-API.md §2` |
| Copiloto ao vivo (Fase 2) | Sonnet 4.6 | `claude-sonnet-4-6` | latência manda no tempo real |

Princípio: **Opus onde a qualidade é o produto** (roteiro), **Sonnet no grosso**,
**Haiku no trivial**. Reavaliar com dados reais de custo depois do MVP.

---

## 6. Outras decisões em aberto — posição recomendada

- **Idioma da interface:** PT-BR apenas no MVP. (As entrevistas em si podem ser
  PT ou EN — o Claude lida com ambos; a *UI* é que fica PT-BR primeiro.)
- **Quem usa o copiloto:** só o recrutador. Confirmado pelos docs; não muda nada.
- **Plataforma da entrevista:** já decidido — agnóstico. No MVP isso fica trivial,
  porque a transcrição é colada/subida; a plataforma nem importa.
- **Nome/marca e paleta:** azul-teal é ponto de partida. 🟦 **DECISÃO DO MATEUS.**

---

## 7. Modelo de dados (rascunho da Fase 1)

```
agencia (1) ──< recrutador
agencia (1) ──< vaga ──< candidato ──< entrevista ──1 relatorio
                  │           │
                  │           └─ cv (texto extraído) + match (score, gaps)
                  └─ requisitos (skills[], senioridade, idioma, must/nice)

roteiro  : pertence a (vaga + candidato) — perguntas[] com {texto, tipo, boa_resposta}
relatorio: pertence a entrevista — {resumo, scores[], pontos_fortes, red_flags, rascunho_email}
```

Tabelas mínimas para o MVP: `agencia`, `recrutador`, `vaga`, `candidato`,
`roteiro`, `entrevista`, `relatorio`. Multi-tenant por `agencia_id` desde o dia 1
(RLS no Supabase) — barato agora, caro de retrofitar depois.

---

## 8. LGPD no MVP (mais leve, mas não zero)

A versão assíncrona **não grava a call ao vivo**, o que reduz muito o risco. Ainda
assim trata dados pessoais (CVs, transcrição colada). Mínimos para o MVP:

- Termo de consentimento do **candidato** para processar o CV / transcrição.
- Aviso de que há IA assistindo a avaliação.
- Política de **retenção/exclusão** (quanto tempo guardamos CVs e transcrições?).
- O peso maior — consentimento de **gravação ao vivo** — só entra na Fase 2.

---

## 9. Plano de Fase 1 — fatias finas (cada uma entrega algo usável)

1. **Scaffold:** Next.js + Supabase + Auth + esquema base (`agencia`/`recrutador`/`vaga`).
2. **Vaga:** tela de criar vaga + "colar descrição → IA pré-preenche" (Haiku).
3. **Triagem:** subir CVs → match + ranking + resumo (Sonnet). *(maior alívio, dor #1)*
4. **Briefing:** gerar o roteiro a partir de vaga+candidato (Opus). *(o "uau")*
5. **Entrevista assíncrona:** colar/subir transcrição e associar à entrevista.
6. **Relatório:** resumo + score vs requisitos + rascunho de e-mail (Sonnet).
7. **Polimento de UI** segundo `UI-DESIGN.md` (glanceable, semáforo, calmo).

Ordem pensada para **mostrar valor cedo**: já no passo 3 o recrutador sente o
produto; passos 4–6 fecham a jornada. Tempo real (Fase 2) só depois de validar isto.

---

## 10. O que falta para arrancar o código

1. ✅ **Escopo do MVP:** jornada assíncrona completa (§3). **DECIDIDO 2026-06-16.**
2. **Stack/hosting:** confirma Next.js + Supabase e onde hospedar? *(em discussão)*

Com isso, o passo seguinte é abrir as fatias do §9 como tarefas pequenas e começar
pelo scaffold (passo 1).

---

## 11. Discussão de planeamento (decisões finas, uma a uma)

Registo das decisões à medida que as fechamos com o Mateus.

- [x] **2026-06-16 — Escopo do MVP:** jornada completa, com **copiloto ao vivo desde o início** (não async-first). Ver [`ARQUITETURA-TEMPO-REAL.md`](./ARQUITETURA-TEMPO-REAL.md).
- [x] **2026-06-16 — Transcrição:** **tempo real, com diarização** (separar falantes), análise ao vivo, sessões longas (2h). Reusa Soniox+LiveKit do `cmtec-voice-platform`.
- [x] **2026-06-16 — Consentimento/LGPD:** não é bloqueador; tratado no onboarding (contrato + aceite no início da call).
- [x] **2026-06-16 — Captura de áudio:** **híbrido (C)** — online (bot na call) + presencial (captura local). Construir online primeiro, presencial logo a seguir. Ver `ARQUITETURA-TEMPO-REAL.md §5`.
- [x] **2026-06-16 — Lente do cliente:** o copiloto sugere também as perguntas que **o cliente da Filipa** quereria fazer (não só avaliação técnica genérica). Diferencial central. Ver `VISAO-FILIPA.md`.
- [x] **2026-06-16 — Inputs antes da call:** ficheiro do que o cliente precisa + ficheiro do que a função faz + CV do candidato → o bot estuda e prepara.
- [x] **2026-06-16 — Armazenamento:** transcrição guardada como **memória RAG por candidato** (factos indexados por competência/requisito), não como bloco de texto.
- [x] **2026-06-16 — Banco de candidatos:** entra como **complemento** (construir completo), alimentado pela memória RAG; o centro é o copiloto ao vivo.
- [x] **2026-06-16 — RAG por cliente:** os clientes repetem → guardamos um **perfil/RAG por cliente** (o que ele valoriza, acumulado a cada vaga) + a vaga específica. Afia a lente do cliente automaticamente nas vagas seguintes.
- [x] **2026-06-16 — Fluxo real = headhunting, não triagem em massa:** a Filipa caça direto no LinkedIn (1 candidato de cada vez). Centro do MVP = jornada de **um** candidato (estudar→entrevistar→parecer→pasta). Triagem de muitos CVs = feature **opcional** (só com volume/nicho). Ver `ACESSO-E-CONHECIMENTO.md §6`.
- [x] **2026-06-16 — Entregável final:** o bot gera o **parecer para o cliente** (editável + exportável PDF/markdown + "preparar email"). Ver `ACESSO-E-CONHECIMENTO.md §4`.
- [x] **2026-06-16 — Linguagem simples (regra dura):** zero jargão cru; o bot traduz sempre (a Filipa não é técnica). `ACESSO-E-CONHECIMENTO.md §5`.
- [x] **2026-06-16 — Ritmo:** 5+ perguntas iniciais antes da call; durante, novas surgem conforme o candidato fala (não 1/seg).
- [x] **2026-06-16 — Formato durante a call:** **painel lateral fixo** (janela estreita / 2º ecrã / tablet), **não popup**. `ACESSO-E-CONHECIMENTO.md §3`.
- [x] **2026-06-16 — Acesso (regra-mãe):** tudo o que o bot destila é acessível pela Filipa via web app + **chat-com-bot por entidade (RAG)** + export aberto (md/pdf). Não fechado. `ACESSO-E-CONHECIMENTO.md`.
- [x] **2026-06-16 — Intake automático:** a Filipa reenvia docs/mensagens do cliente → o bot extrai, **mostra o que entendeu para confirmação** e atualiza a memória do cliente/vaga **com proveniência**. `INTAKE-E-JULGAMENTO.md` Parte A.
- [x] **2026-06-16 — Julgamento via conhecimento externo + rubric:** o bot busca conhecimento de fora (mundo + pesquisa) e, antes da call, gera um **rubric** (fraca/ok/forte por requisito); o julgamento é "bate em que nível?", não palpite. `INTAKE-E-JULGAMENTO.md` Parte B.
- [x] **2026-06-16 — Garantia anti-achismo (4 regras):** todo veredito cita evidência; facto separado de opinião; incerteza é dita; linguagem simples. Viram requisitos + testes. Parte C.
- [x] **2026-06-16 — Calibração:** registamos o veredito do cliente (aprovou/recusou/porquê) → mede-se a precisão do bot ao longo do tempo (Camada 3a). Parte D.
- [x] **2026-06-16 — D4 Hosting:** **Tudo na VPS** (Docker Compose: web Next.js + WebSocket + Supabase). Sem Vercel.
- [x] **2026-06-16 — D1 Web search:** **Exa (principal) + Brave (fallback)** para o Role Profile.
- [x] **2026-06-16 — D2 Bot na call:** **LiveKit próprio desde já** (reusa cmtec-voice-platform; ~3–5 sem → carril "antes" entrega valor primeiro).
- [x] **2026-06-16 — D5 Ingestão:** **Telegram + WhatsApp em paralelo** (não esperar validação do Telegram; mesmo motor de ingestão, WhatsApp via Evolution API).
- [x] **2026-06-16 — D3 Embeddings:** pgvector no Supabase self-hosted (confirmado).
- ✅ **Todas as decisões D1–D5 fechadas → spec build-ready (2026-06-16).** Ver `BUILD-READY.md`.

### Evolução de design — 2026-06-17 (validadas hoje)
- [x] **Memória em duas camadas (mata "gatilhos"):** Camada A = captura **sem perdas** (transcrição completa diarizada + chunks/embeddings, nada descartado); Camada B = **compreensão semântica** (interpreta significado, não casa palavras). Ver `ARQUITETURA-TEMPO-REAL.md §8`.
- [x] **Frame de avaliação ao vivo:** estado por requisito (não-tocado→raso→coberto-com-prova/contradito) + **escada de prioridade** da sugestão + rede de segurança no fim + limiar de silêncio/rapport + PORQUÊ por sugestão. `ARQUITETURA-TEMPO-REAL.md §9`.
- [x] **Candidato = entidade GLOBAL** (talent pool, cross-cliente); cliente = mandato (multi-vaga); **`process` = candidato × vaga**. `MODELO-DADOS.md` (Evolução).
- [x] **Relatório contra os critérios do cliente** (anti-ping-pong): critério-a-critério com citação+timestamp; assinala o não-coberto; **duas versões** (interna/cliente). `RELATORIO-CLIENTE.md`.
- [x] **Q&A Filipa↔bot bilingue** (tech↔recrutador↔cliente), RAG citado; segundo travão ao ping-pong (responde sem recontactar o candidato). `CAMADA-CONHECIMENTO.md`.
- [x] **Input da Filipa tipado** (alvo + intenção); confirmação antes de escrita durável; correções marcam o facto `corrigido_pela_filipa`. `INTAKE-E-JULGAMENTO.md` Parte A.
- [x] **Cobrir o resto do recrutador:** motivação/drivers + logística (salário/aviso/contraproposta) + bot ajuda a **vender** a vaga + **resultado da colocação** (ficou/saiu na garantia) volta para calibração. `INTAKE-E-JULGAMENTO.md` Parte E.
- [x] **RGPD:** factos pessoais etiquetados, **nunca entram no score** (só recall), retenção curta; transcrição crua com janela de retenção. `MODELO-DADOS.md §RGPD`.
- ✅ **Revisão 360°** do ciclo completo → `REVISAO-360-2026-06-17.md` (gaps priorizados).

### Evolução de design — 2026-06-17 (ronda 2)
- [x] **App desktop de secretária** (Electron; Tauri alt.) para o overlay ao vivo: always-on-top, sem moldura, arrastável, cara do bot, 1 sugestão de cada vez que **auto-desaparece** (~30s ou quando já perguntada/respondida). **Também capta o áudio local.** A **web app mantém-se** para todo o resto. Mesmo backend. `ARQUITETURA-INTEGRACAO`, `UI-DESIGN`.
- [x] **STT multi-idioma:** PT-PT, PT-BR, inglês e francês (+ misturas); a Filipa fala inglês; saída em PT. `ARQUITETURA-TEMPO-REAL §2`.
- [x] **Assistente proativo** (além do RAG): consciência da **agenda** (resumo de preparação antes das reuniões) + **deteção de lacunas** no mandato. **Calendário = Google Calendar (OAuth), decidido 2026-06-17**; manual é fallback. `ASSISTENTE-PROATIVO.md` (NOVO).
- [x] **Diarização:** caminho principal = **falante ativo da plataforma** (bot na call); fallback = voz + **enrollment da Filipa**; suporta **3+ vozes** (cliente na call → preferências reveladas ao vivo); **correção de falante num toque**. Sugestões/avaliação **privadas** no overlay. `ARQUITETURA-TEMPO-REAL §2/§6`.
- [x] **Chat com o bot AO VIVO** no overlay (responde do estado/transcrição corrente sem parar a captura).
- [x] **Desambiguação:** o bot **nunca adivinha** o alvo — confirma sempre (web: escolhe cliente→vaga; chat: propõe match + contexto ativo). `INTAKE` desambiguação.
- [x] **Pesos + compensação holística:** requisito **obrigatório vs desejável**; **nunca eliminar por um desejável**; bot mostra o trade-off, a Filipa decide. `INTAKE` Parte F, `MODELO-DADOS` (peso).
- [x] **Reutilização de factos do candidato ENTRE clientes = permitida** (consentimento é responsabilidade da Filipa). Cai o bloqueador de limitação de finalidade.
- [x] **Consentimento manual da Filipa** (não in-app) + **apagamento por ordem dela** = soft-delete **com recuperação** (`purge_after`).
- [x] **v1 single-tenant (só IRIS):** acesso interno total; **sem RLS por agência** (adiado p/ v2). `MODELO-DADOS §RLS`.
- [x] **Override da Filipa ao veredito alimenta a calibração**; **arranque a frio** apoia-se no Role Profile + critérios declarados. `INTAKE` Parte D.
- ✅ **REVISAO-360 atualizada:** 4 dos 6 bloqueadores resolvidos; sobram auth do desktop/WS + validação com a Filipa.

### Decisões — 2026-06-17 (ronda 3: autenticação)
- [x] **Auth (LOCKED) — biometria facial primeiro, email+senha alternativa.** Reusa o **engine/código** do `cmtec-face` (YuNet+SFace+liveness FSM; veredito single-use → sessão Supabase via `generateLink`) **CLONADO numa instância própria do RH** — **não** partilha o serviço do painel (regra do Mateus: não misturar projetos). Identidade/sessão = **Supabase Auth (JWT)** nos dois caminhos. Magic-link (GoTrue/SMTP VPS) = device-binding + recuperação. **Fecha o bloqueador #5.** Desenho + adaptador desktop + caveats em [`AUTENTICACAO.md`](./AUTENTICACAO.md).
- [x] **Auth do WebSocket:** JWT na 1ª mensagem (não em query-string) → servidor WS valida assinatura Supabase + extrai `recruiter_id` + **verifica posse da `interview_id`**. Refresh silencioso a meio das 2h.
- [ ] **A resolver ANTES de clonar (outro dia, na origem — não nesta fase de spec):** bug de enroll/flash liveness do `cmtec-face` (cadastra rápido demais, sem tela colorida). `AUTENTICACAO.md §6 C1`; memória `project_cmtec_face_enroll_bug_2026_06_17`.

### Parte 1 (o cérebro) — refinamentos validados 2026-06-17 (FECHAR antes da embalagem)
- [x] **O FOSSO = aprofundamento reativo ao vivo** (não a pergunta de topo, que recrutadora+ChatGPT já geram). Validado no caso #1 (Filipa fez quase as mesmas 🟢; C2 ela falhou = valor nosso). O bot decompõe a afirmação dita em follow-ups de prova ancorados no que foi DITO. `ARQUITETURA-TEMPO-REAL §9` ("Aprofundamento reativo") + `validacao-caso-01-mateus-securegpt.md`.
- [x] **Pesquisa AO VIVO** quando o candidato dá link/projeto/repo: o bot pesquisa (D1 Exa+Brave, agora também ao vivo) + lê o link/código e ancora os probes/veredito no que VIU. Compensa a falta de contexto da empresa-cliente. Indício, não veredito; marca incerteza. `ARQUITETURA-TEMPO-REAL §9`.
- [x] **Veredito de resposta ao vivo** (forte/rasa/atenção) para a Filipa, quase em tempo real, em linguagem simples, citando evidência (anti-achismo). Surfacing da máquina de estados+rubric, não juízo novo. Visual (pulso/semáforo/animação) = criatividade na embalagem (`UI-DESIGN` Tela 6); aqui fixa-se o comportamento. `ARQUITETURA-TEMPO-REAL §9`.
- ⚠️ **REGRA DO MATEUS:** **não avançar para a spec da embalagem antes de fechar TODA a Parte 1.**

### Parte 1 — fecho de gaps do cérebro (2026-06-17, ronda profunda)
Mapa do cérebro revisto (Antes/Durante/Depois) → 7 gaps encontrados. Fechados:
- [x] **Nicho-agnóstico:** o bot serve QUALQUER área (enfermeiro, comercial, advogado…), não só tech. `role_type_slug` livre, Role Profile é molde neutro, `linguagem_filipa` traduz qualquer jargão, lente "técnica"→"da função/competência". Exemplo não-tech (Enfermeiro UCI) na spec. `CAMADA-CONHECIMENTO`.
- [x] **Ciclo de vida da pesquisa:** o que o bot faz com o conteúdo da web/repo → ① guarda o cru (`source_doc`+embedding, rastreável/RAG) ② destila em factos COM proveniência+confiança → role_profile / candidate_memory_fact (`'a_confirmar'`, fora do score até o candidato confirmar) / client_memory_fact ③ fica citável. Web=indício, não veredito. `CAMADA-CONHECIMENTO` + `MODELO-DADOS §7`.
- [x] **CONFLITO resolvido:** "sem web search ao vivo" (antigo) vs pesquisa ao vivo (novo) → Role Profile no Antes; pesquisa pontual ao vivo event-triggered/assíncrona/indício. `CAMADA-CONHECIMENTO`.
- [x] **Cérebro do chatbot (NOVO doc `ASSISTENTE-CONVERSA.md`):** RAG ancorado (cita sempre fonte, nunca inventa, "não foi dito" é resposta válida), Opus. 4 modos: A=Q&A candidato, B=Q&A cliente, **C=COMPARAR candidatos** (matriz critério-a-critério vs client_criteria+pesos, trade-off honesto, nunca elimina por nice, Filipa decide), D=chat ao vivo. RGPD: pessoal só recall, fora do juízo.
- [x] **Confiança por requisito:** frame carrega `alta/média/baixa`; parecer di-la ("forte mas confiança baixa — só 1 menção"); apanha inflação sem acusar. `ARQUITETURA-TEMPO-REAL §9`.
- [x] **Compilação do rubric (G3):** rubric = fusão `role_profile.competencias` + `client_criteria` (peso do cliente manda); cada linha guarda `origem`. `CAMADA-CONHECIMENTO`.
- [x] **Parecer puxa da pesquisa/código visto** com selo de origem (✅ provado / 🔎 verificado na fonte / 🔎 indício a confirmar); só-pesquisa não conta como capacidade provada. `RELATORIO-CLIENTE §5`.
- [x] **Métrica de calibração (D.1):** precisão = % de acerto de `bot_predicted` vs `client_verdict` e vs `placement_outcome` (ground-truth), por cliente/role; erro recorrente por `reason_type`→regra explícita; alimenta migração web→interno; mostrada à Filipa. `INTAKE` Parte D.1.
- ✅ **PARTE 1 (o cérebro) FECHADA — 7/7 gaps resolvidos.** Pronto para, quando o Mateus quiser, atacar a **embalagem** (app desktop/WS/overlay/captura áudio/clone biometria) dispatch-ready.

### Modelos & API — AGNÓSTICA ao fornecedor + produto-para-vender (2026-06-17) — NOVO doc `MODELOS-E-API.md`
- [x] **Agnóstico ao modelo (correção do Mateus):** o sistema chama **CAPACIDADES (slots)**, não "Claude". Slots: `EXTRACTOR`/`ARCHITECT`/`LIVE`/`EMBEDDER`/`STT`, cada um config (`model_id`), trocável por OpenRouter ou direto. O comprador pode pôr Gemini/Voyage/Deepgram/etc. **Defaults = nossa recomendação** (Haiku/Opus/Sonnet/text-embedding-3-small/Soniox), NÃO requisito.
- [x] **3 amarras ao trocar (não partir):** (1) EMBEDDER muda dimensão pgvector → re-index (escolher no arranque); (2) LIVE tem de ser baixa-latência (avisa se passa 1-3s); (3) JSON/tool-use obrigatório em LIVE+ARCHITECT.
- [x] **Via OpenRouter** (chave única; Mateus paga enquanto connosco; vender = trocar chaves+modelos+host, zero reescrita; interface fina por capacidade = adapter por fornecedor). Chaves por deployment (sops+age). Custo dominante = STT/hora + ticks LIVE.
- [x] **Produto para VENDER ("sair de nós"):** pronto a apresentar **já com APIs ligadas**; multi-tenant v2 (agency_id na costura); futura VPS do comprador (Docker Compose portável).
- [x] **Comportamentos ao vivo afinados (`ARQUITETURA-TEMPO-REAL §9`):** pesquisa ao vivo = **varredura em 2º plano da ESTRUTURA do projeto**; **progresso de cobertura** ("riscar até fechar tudo", X/Y cobertos, fecha a checklist antes do fim).
- ✅ **Calendário/proativo já no escopo** (`ASSISTENTE-PROATIVO.md` — Google Calendar OAuth, `agenda_event`): o bot tem acesso à agenda da Filipa + resumo de preparação antes das reuniões + deteção de lacunas.

### Re-exame honesto "fechámos a Parte 1?" (2026-06-17) — +4 itens fechados
Mateus desafiou ("tem certeza?"). Não estava 100%. Fechados agora:
- [x] **Atribuição fora de ordem:** candidato responde tópico 5 enquanto no 1 → Camada B roteia o significado ao requisito certo, risca esse, atualiza memória ao vivo; Camada A guarda tudo na hora. `ARQUITETURA-TEMPO-REAL §9`.
- [x] **Disciplina de tokens** (regra dura "não chupar token à toa"): nunca reenviar as 2h; prompt caching do fixo; Camada A guardada≠reenviada (RAG sob procura); Haiku nos ticks banais; sem chamada sem motivo; output estruturado curto. `ARQUITETURA-TEMPO-REAL §3`.
- [x] **v1 só OpenRouter (chat) + Filipa troca o modelo na app** (seletor com catálogo+preço por slot); embedder/STT fora do OpenRouter. `MODELOS-E-API §2`.
- [x] **Robustez de input:** STT de baixa confiança NÃO vira prova → re-sonda (reconexão de áudio = embalagem; a regra de juízo = cérebro). `ARQUITETURA-TEMPO-REAL §9`.
- [x] **Re-entrevista (H3):** factos gerais reutilizam-se; específicos-do-process só contexto; memória velha re-validada ao vivo. `ASSISTENTE-CONVERSA §4.1`.
- ⏸️ **HONESTO: fica para a embalagem/config (não cérebro):** canal dos lembretes proativos + antecedência (`ASSISTENTE-PROATIVO §4`); rascunho de feedback ao candidato (A5, produto). **Agora sim a Parte 1 (cérebro) está sólida.**

