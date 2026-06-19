# Arranque — o que preciso de ti ANTES do loop (para correr sem parar)

> Resposta honesta à pergunta "se me puseres em loop, constróis do início ao fim sem
> parar, sem erros, sem pedir info?". Quase — mas com a verdade abaixo. Quanto mais
> desta lista estiver pronto antes do `/loop`, mais longe ele corre sem te chamar.

---

## 1. O que EU faço sozinho (sem te pedir nada)

- Scaffold (monorepo `apps`+`packages`, Next.js + Drizzle + Docker Compose).
- Todo o esquema da DB + migrations + RLS (`MODELO-DADOS.md`).
- A pipeline "antes": criar vaga, Role Profile, match, briefing (`packages/ai`, `knowledge`).
- O parecer, a memória RAG (candidato + cliente), o chat-com-bot por entidade.
- Os bots de ingestão (Telegram + WhatsApp), o **app desktop** (overlay ao vivo +
  captura de áudio local, Electron/Tauri) e o servidor WebSocket.
- A plumbing do tempo real (LiveKit + Soniox, multi-idioma PT/EN/FR), contra os contratos.
- O assistente proativo (agenda + deteção de lacunas) na web app.
- **Em cada passo:** escrevo, corro o teste de aceitação (`TESTES-ACEITACAO.md`),
  corrijo erros até ficar verde, e só então commito. Erros acontecem — a função do
  loop é **detetá-los e corrigi-los**, não fingir que não existem.

> Honestidade: **não prometo "zero erros".** Prometo **verde verificado por passo** —
> nada avança sem o teste do passo passar. É a diferença entre achismo e garantia.

---

## 2. O que SÓ TU podes dar (senão alguns módulos não ligam/testam)

### 2a. Chaves / secrets — mete num `.env` antes do loop
| Secret | Já temos? | Ação |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ (CMTec) | reuso |
| `SUPABASE_*` / `DATABASE_URL` | ✅ (VPS self-hosted) | reuso |
| `EVOLUTION_API_*` (WhatsApp) | ✅ (VPS :8080) | reuso |
| `LIVEKIT_*` + `SONIOX_API_KEY` | ⚠️ existem no `cmtec-voice-platform` | **confirma que posso reusar** |
| `EXA_API_KEY` | ❌ | **OPCIONAL na v0** — criar conta Exa só quando ligarmos web search |
| `BRAVE_API_KEY` | ❌ | **OPCIONAL na v0** — Brave tem tier grátis ~2k buscas/mês |
| `TELEGRAM_BOT_TOKEN` | ❌ | **único obrigatório novo** — grátis no @BotFather |

> **Decisão de custo (2026-06-17):** o build arranca a **~€0**. Exa/Brave são
> **opcionais na v0** — o Role Profile usa primeiro só o conhecimento da Claude (cobre
> ~95%) e o web search liga-se depois como melhoria. Custo real só aparece com
> **entrevistas reais** (Soniox por hora de áudio + tokens Claude nos ticks).
> Único pré-requisito novo mesmo necessário: **Telegram bot token** (grátis) +
> confirmar **reuso de LiveKit/Soniox** do cmtec-voice-platform.

### 2b. Confirmações operacionais (1 linha cada)
- **VPS:** confirmo que deployo no `72.60.88.137` como nos outros projetos? (tenho SSH)
- **Domínio:** que subdomínio para a app? (ex.: `rh.cmtecnologia.pt` via túnel CF)
- **Reuso LiveKit/Soniox** do cmtec-voice-platform: sim? + **confirmar multi-idioma
  (PT-PT/PT-BR/EN/FR) e 3+ falantes** no plano Soniox atual.
- **App desktop:** distribuição é só interna (IRIS) → instalador simples chega; sem
  code-signing/loja na v1? (a confirmar)
- **Calendário do assistente proativo:** ✅ **Google Calendar (OAuth)** — decidido
  (Mateus, 2026-06-17). Preciso de criar credenciais OAuth Google + consentimento da
  Filipa. Input manual fica como fallback.

---

## 3. Quando é que EU PARO e te chamo (em vez de adivinhar)

Só nestes casos — e é de propósito (parar é melhor que achismo):
1. **Falta uma chave** da lista 2a e o carril que depende dela chega a vez.
2. **Decisão de produto que não está na spec** e que muda o resultado (raro — a spec cobre quase tudo).
3. **Validação humana real:** "as sugestões do copiloto são boas para a Filipa?" — isso
   exige a Filipa numa entrevista de verdade. O loop **constrói e prova tecnicamente**;
   não substitui o teste com utilizador real.
4. **Ação que gasta dinheiro/é externa** (criar conta paga, publicar algo) — pergunto antes.

Fora disto, eu sigo: construo → testo → corrijo → commito → próximo passo.

---

## 4. Resumo honesto

- **Do início até "produto que corre e passa os testes técnicos":** sim, em loop, em
  larga medida sozinho — desde que a lista 2 esteja pronta.
- **Até "validado pela Filipa em entrevistas reais":** não — isso precisa dela e de ti.
- **Sem erros:** vou ter erros; a diferença é que os **caço e corrijo**, com teste por passo.

> **Para o loop de amanhã correr o mais longe possível:** preenche o `.env` com as 3
> chaves em falta (Exa, Brave, Telegram) + responde às 3 confirmações do 2b. Com isso,
> arranco o Agente 1 (Fundação) e encadeio os carris 2–6 com o mínimo de paragens.
