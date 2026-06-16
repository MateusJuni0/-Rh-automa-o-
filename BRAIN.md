# BRAIN — RH Automação

> Contexto vivo do projeto. Status rápido + decisões. Carregar no início de cada sessão.

## O que é
Copiloto de IA para **agência de RH** (intermedia profissionais para empresas-clientes).
Jornada: **Triagem de CVs → Briefing (roteiro) → Copiloto AO VIVO → Relatório**.

## Status (2026-06-16)
- Fase: **planeamento** ("pensar antes de codar"). Zero código de produto ainda.
- Repo próprio criado e arrumado: `MateusJuni0/-Rh-automa-o-` (clone local em `workspace/projects/rh-automacao`).
- Origem: docs nasceram por engano numa branch do repo `App-game` (jogo do impostor); migrados para cá e a branch errada foi apagada.

## Decisões fechadas
1. **MVP = copiloto AO VIVO desde o início** (não async-first). O "antes"/"depois" são assíncronos; o "durante" é tempo real.
2. **Transcrição:** tempo real + **diarização** (separar falantes) + análise ao vivo, sessões até 2h. Reusa **Soniox + LiveKit** do `cmtec-voice-platform`.
3. **Consentimento/LGPD:** não é bloqueador — tratado no onboarding (contrato + aceite no início da call). Não gastar energia a "preocupar-se" com isto.
4. Stack proposta: **Next.js + Supabase** (a confirmar). Modelos: Sonnet 4.6 ao vivo (latência), Opus 4.8 no roteiro/relatório.

## Crux de engenharia (o difícil/interessante)
Analisar 2h em tempo real a **custo constante**: manter um **estado vivo estruturado**
+ enviar ao Claude só a **janela recente** + **rolling summary** do resto + prompt caching.
Ver `ARQUITETURA-TEMPO-REAL.md §3`.

## Próxima decisão em aberto
- **Captura de áudio:** bot entra na call (A, melhor diarização, só online) vs captura local (B, cobre presencial) vs híbrido (C). Recomendação: começar por A. Ver `ARQUITETURA-TEMPO-REAL.md §5`.

## Estilo de trabalho com o Mateus (neste projeto)
- Ser **decisivo**, propor e avançar; não encher de ressalvas/edge-cases. Compliance/consentimento "a gente resolve no onboarding".
- Estamos a **planear em conversa, pergunta a pergunta** — uma decisão de cada vez.

## Docs
`README.md` · `PLANO.md` · `DIA-A-DIA-RECRUTADOR.md` · `UI-DESIGN.md` · `DECISOES-E-MVP.md` · `ARQUITETURA-TEMPO-REAL.md`
