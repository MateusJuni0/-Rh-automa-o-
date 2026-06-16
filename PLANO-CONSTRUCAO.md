# Plano de Construção — passo a passo com garantias

> **Propósito:** eliminar o achismo do build. Cada passo tem uma entrada clara,
> uma saída verificável e uma garantia — o passo só fecha quando a garantia passa.
> Nada avança sem o anterior estar verde.

---

## Princípios que guiam a ordem

1. **Valor cedo, risco depois.** Os passos mais incertos (live audio, WhatsApp bot)
   ficam para o fim — quando já sabemos que o produto funciona.
2. **Cada passo é usável.** Filipa consegue fazer algo real com o produto desde o passo 3.
3. **Sem saltos.** Se um passo depende de outro, a dependência está explícita.
4. **Garantia = teste real, não "parece funcionar".** Cada garantia define o critério concreto.

---

## Fase 0 — Scaffold (fundação invisível)

### P0.1 — Ambiente e repositório
**Entrada:** zero  
**O que fazemos:** Next.js 15 (App Router) + Supabase (self-hosted VPS) + Auth + esquema base  
**Garantia:** `npm run dev` sem erros; login de recrutador funciona; `psql` mostra as tabelas base

Tabelas base:
```sql
agency, recruiter (liga a auth.users), job, candidate, document
```

### P0.2 — Multi-tenant desde o dia 1
**O que fazemos:** RLS no Supabase por `agency_id` em todas as tabelas  
**Garantia:** usuário da Agência A não vê dados da Agência B (testar com 2 contas)

---

## Fase 1 — Antes: preparar a entrevista

### P1.1 — Criar vaga (web app, upload A)
**Entrada:** recrutador logado  
**O que fazemos:** formulário de vaga + upload de PDF/texto dos requisitos do cliente  
**Claude:** Haiku extrai campos estruturados (role, nível, skills, contexto)  
**Garantia:** vaga criada com `requirements` JSON na DB; Filipa confirma que a extração faz sentido

### P1.2 — Role Profile (Camada de Conhecimento Externo)
**Depende de:** P1.1  
**O que fazemos:** ao criar vaga, trigger de web search (Exa) pelo role-type identificado  
**Claude:** Haiku estrutura o resultado em Role Profile JSON  
**Garantia:** tabela `role_profiles` tem entrada para "dev_frontend_react_pleno" com `competencias_esperadas` + `o_que_e_bom` + `linguagem_para_filipa` não-vazios

> **Este passo é o que elimina o achismo de avaliação técnica.** Sem ele, o bot não sabe o que é "bom".

### P1.3 — Adicionar candidato + CV
**Depende de:** P1.1  
**O que fazemos:** upload de CV (PDF/Word); Claude Haiku extrai perfil estruturado  
**Garantia:** tabela `candidates` tem entry com `skills_declaradas`, `experiencia_anos`, `gaps_cv`

### P1.4 — Análise candidato vs vaga
**Depende de:** P1.2 + P1.3  
**O que fazemos:** Claude Sonnet compara skills do candidato vs Role Profile + requisitos do cliente  
**Saída:** `match_score`, `gaps_a_investigar`, `pontos_fortes`  
**Garantia:** Filipa abre o candidato e vê o gap analysis em linguagem simples

### P1.5 — Gerar briefing (o roteiro)
**Depende de:** P1.4 + Role Profile + RAG do cliente (vazio no início)  
**O que fazemos:** Claude Opus gera roteiro com 5+ perguntas em 3 lentes  
- Lente 1: técnica/vaga (baseia-se em Role Profile)  
- Lente 2: cliente (baseia-se nos requisitos + RAG do cliente)  
- Lente 3: gaps do CV  
**Para cada pergunta:** `boa_resposta` esperada (extraída do Role Profile)  
**Garantia:** Filipa lê o briefing e diz que faz sentido para a vaga; cada pergunta tem uma "boa_resposta" não-genérica

---

## Fase 2 — Durante: copiloto ao vivo

### P2.1 — Captura de áudio (bot online)
**Depende de:** P1.5 (briefing pronto)  
**O que fazemos:** bot "entra" na call como participante (LiveKit headless ou Recall.ai)  
**Garantia:** bot recebe stream de áudio de uma call de teste com 2 participantes

### P2.2 — Transcrição + diarização ao vivo
**Depende de:** P2.1  
**O que fazemos:** Soniox streaming PT-BR com diarização — reusa `cmtec-voice-platform`  
**Saída:** frases com `falante_id` + `timestamp` em tempo real  
**Garantia:** call de teste de 5 min transcrita com identificação correta dos 2 falantes (>90% frases bem rotuladas)

### P2.3 — Estado vivo + análise por tick
**Depende de:** P1.5 (briefing/roteiro) + P2.2 (transcrição)  
**O que fazemos:** a cada ~5 frases do candidato, Claude Sonnet atualiza o estado:
```json
{ "requisitos": {"React": "coberto"}, "interesses_cliente": [...], "proxima_sugestao": {...} }
```
**Garantia:** numa call de 15 min, o estado muda ≥10 vezes; a sugestão aparece em <3s após frase relevante

### P2.4 — UI copiloto (painel lateral)
**Depende de:** P2.3  
**O que fazemos:** WebSocket → painel lateral no browser com sugestão em destaque + semáforo  
**Garantia:** Filipa usa em call de teste real; consegue ler a sugestão sem interromper a conversa

---

## Fase 3 — Depois: parecer e memória

### P3.1 — Relatório / parecer
**Depende de:** P2.3 (estado vivo final) + transcrição completa  
**O que fazemos:** Claude Opus gera parecer em linguagem simples, mapeado contra requisitos do cliente  
**Garantia:** parecer tem ≥3 evidências concretas ("em 12:04 o candidato disse..."); nenhuma frase usa jargão; Filipa consegue enviar ao cliente sem editar

### P3.2 — Export md/pdf + "preparar email"
**Depende de:** P3.1  
**Garantia:** PDF gerado em <5s; email rascunho pronto para copiar

### P3.3 — Memória RAG por candidato
**Depende de:** P2.3 (estado vivo) + transcrição  
**O que fazemos:** transcrição destilada em factos por competência + indexada (embeddings Supabase pgvector)  
**Garantia:** query "o que o João disse sobre testes?" devolve trecho com timestamp correto

### P3.4 — RAG por cliente (aprender com veredito)
**Depende de:** P3.1 (parecer) + veredito do cliente  
**O que fazemos:** Filipa marca "aprovado" / "recusado — motivo: X" → Claude Haiku extrai o que o cliente valoriza e atualiza o perfil do cliente  
**Garantia:** após 3 vereditos, o briefing da próxima vaga deste cliente tem perguntas que refletem o padrão observado

---

## Fase 4 — Ingestão natural (sem copy-paste)

### P4.1 — Telegram bot (Canal B)
**Depende de:** P1.1 + P1.3 (fluxo web funcional)  
**O que fazemos:** Filipa encaminha msg/doc do cliente para @RHCopiloto_bot → bot processa + confirma  
**Garantia:** doc de requisitos chega via Telegram, é extraído, e aparece na vaga correta na app — sem Filipa abrir a web app para upload

### P4.2 — Captura presencial (microfone local)
**Depende de:** P2.1-P2.4 (bot online funcional)  
**O que fazemos:** app PWA que capta microfone local + stream para Soniox  
**Garantia:** call presencial de teste transcrita com qualidade equivalente ao online

---

## Sequência resumida

```
P0.1 → P0.2 → P1.1 → P1.2 → P1.3 → P1.4 → P1.5
                                                │
                                         P2.1 → P2.2 → P2.3 → P2.4
                                                               │
                                                        P3.1 → P3.2
                                                        P3.1 → P3.3 → P3.4
                                               (paralelo após P1.5)
P4.1 (após P1.1 funcional)
P4.2 (após P2.x funcional)
```

---

## O que está em aberto (decisões que ainda faltam)

| # | Decisão | Impacto | Owner |
|---|---|---|---|
| D1 | Qual web search API? (Exa vs Brave) | P1.2 | CLAUDE propõe, Mateus decide |
| D2 | Bot que entra na call: próprio (LiveKit headless) ou Recall.ai? | P2.1 | CLAUDE pesquisa, Mateus decide |
| D3 | Embeddings: pgvector (Supabase) ou serviço separado? | P3.3 | CLAUDE recomenda pgvector (já na infra) |
| D4 | Hosting: Vercel (Next.js app) + VPS (WebSocket server) ou tudo na VPS? | P0.1 | Mateus decide |
| D5 | WhatsApp Canal C: só quando Canal B (Telegram) estiver validado? | P4.x | Sim, como proposto |

---

## Próximo passo imediato

Fechar as 5 decisões em aberto (D1–D5) → arrancar P0.1 (scaffold).
Com scaffold + P1.1 + P1.2 funcionais, Filipa já consegue criar uma vaga e ver
o Role Profile — primeiro "uau" técnico, antes de qualquer entrevista ao vivo.
