# RH Automação — Copiloto de IA para Recrutamento

> Documento vivo de planejamento. Objetivo desta fase: **pensar antes de codar**.
> Atualize à medida que as decisões forem sendo tomadas.
>
> Companheiros deste doc:
> - [`DIA-A-DIA-RECRUTADOR.md`](./DIA-A-DIA-RECRUTADOR.md) — o que é chato no dia a dia e o que automatizar (por ordem de dor).
> - [`UI-DESIGN.md`](./UI-DESIGN.md) — princípios de design e telas (incl. o copiloto ao vivo).

---

## 1. O problema (na sua voz)

Somos uma **agência de RH**: entrevistamos e intermediamos profissionais para
empresas-clientes. Quando uma empresa precisa de um profissional (ex.: um dev
frontend), ela traz os requisitos e nós encontramos, entrevistamos e validamos
o candidato.

**A dor:** o recrutador perde muito tempo se preparando para cada entrevista.
Ele precisa estudar a vaga, entender a tecnologia exigida, montar perguntas de
filtro e, durante a conversa, julgar se a resposta do candidato foi boa — muitas
vezes sobre um assunto técnico que ele não domina.

---

## 2. A ideia

Um **copiloto de IA** que apoia o recrutador antes e durante a entrevista:

- Conhece a **vaga** (requisitos enviados pela empresa: stack, anos de
  experiência, idioma, etc.) e o **currículo** do candidato.
- **Antes:** gera um roteiro de entrevista personalizado (o que perguntar e como
  reconhecer uma boa resposta).
- **Durante:** acompanha a transcrição da conversa em tempo real e **sugere
  perguntas de follow-up** para o recrutador, destilando o que cada lado fala.

---

## 3. Diferencial

Já existem ferramentas globais nesse espaço (Metaview, BrightHire, Pillar). Nosso
ângulo é diferente e defensável:

1. **Foco em agência / intermediação** — o produto entende que existem 3 lados
   (agência, empresa-cliente, candidato), não só "empresa contrata candidato".
2. **Mercado BR + idioma PT** — interface, perguntas e LGPD pensados localmente.
3. **Banco de perguntas por competência** — o ativo que melhora com o uso.

---

## 4. Estratégia de produto: comece pequeno

A maior incerteza do negócio **não** é o tempo real — é se a **qualidade das
sugestões** convence os recrutadores. Validamos isso barato primeiro.

### Fase 1 — "Briefing do Recrutador" (assíncrono) ⭐ começar por aqui
Fluxo: cadastra vaga + cola currículo → IA gera um **roteiro de entrevista**:
- perguntas técnicas e comportamentais ordenadas;
- para cada uma: o que é uma **boa** vs **fraca** resposta;
- **gaps** do currículo a investigar (ex.: "diz React mas não cita testes").

**Por quê primeiro:** barato, sem infra de áudio, e prova o valor central.

### Fase 2 — Copiloto em tempo real
Bot entra na call → transcrição ao vivo → sugere perguntas conforme a conversa.
Reaproveita todo o "cérebro" da Fase 1. Mais caro e complexo (áudio, latência).

### Fase 3 — Pós-entrevista
Resumo automático, score do candidato vs requisitos, relatório pra empresa-cliente.

---

## 5. Arquitetura (rascunho)

```
[Web app]  →  [API backend]  →  [LLM Claude]
                   │
                   ├── Banco de dados (vagas, candidatos, roteiros)
                   └── (Fase 2) Serviço de transcrição em tempo real
```

- **Fase 1** não precisa de tempo real: requisição → resposta. Simples.
- **Fase 2** acrescenta: captura de áudio da reunião + transcrição (streaming) +
  WebSocket pra empurrar sugestões pra tela do recrutador.

### Stack sugerida (a confirmar)
| Camada | Sugestão | Observação |
|---|---|---|
| Frontend | Next.js + React | rápido de prototipar; bom pra web |
| Backend | Node.js (ou Python) | Node se quiser uma stack só em JS |
| IA | **Claude** (API Anthropic) | ver seção 6 |
| Banco | PostgreSQL | dados estruturados de vagas/candidatos |
| Transcrição (Fase 2) | a definir | streaming PT-BR é o ponto crítico |

> Nada disso está fechado — é ponto de partida pra discussão.

---

## 6. Modelos de IA

Usaríamos a **API da Anthropic (Claude)**. Recomendação inicial:
- **Claude Sonnet 4.6** para o uso geral (bom equilíbrio custo/latência/qualidade)
  — especialmente importante no tempo real da Fase 2.
- **Claude Opus 4.8** para tarefas de maior exigência (ex.: gerar o roteiro
  detalhado da Fase 1), onde a qualidade vale mais que o custo.

(IDs e preços devem ser confirmados na documentação oficial antes de implementar.)

---

## 7. LGPD e consentimento (não opcional)

Gravar/transcrever uma entrevista envolve dados pessoais e, às vezes, sensíveis.
Pontos obrigatórios:
- **Consentimento explícito** de candidato e empresa antes de gravar/transcrever.
- Aviso claro de que há IA assistindo a entrevista.
- Política de **retenção e exclusão** dos dados (quanto tempo guardamos?).
- Contrato/termo com as empresas-clientes cobrindo o tratamento de dados.

Isso precisa estar resolvido **antes** de a Fase 2 ir pra produção.

---

## 8. Decisões em aberto

- [ ] **MVP:** começamos pela Fase 1 (roteiro) ou já miramos a Fase 2 (tempo real)?
- [x] **Plataforma da entrevista:** ~~Meet/Zoom/Teams/presencial?~~ **Decidido:
      agnóstico de plataforma** — o copiloto é uma tela independente que recebe a
      transcrição venha de onde vier. Detalhes em `DIA-A-DIA-RECRUTADOR.md`.
- [ ] **Stack:** confirma Next.js + Node? Ou prefere Python no backend?
- [ ] **Idioma das entrevistas:** só PT-BR ou também inglês?
- [ ] **Quem usa a tela do copiloto:** só o recrutador, certo?

---

## 9. Próximos passos sugeridos

1. Você decide o **escopo do MVP** (Fase 1 vs Fase 2) e responde as decisões abertas.
2. Eu detalho a Fase escolhida em tarefas pequenas e começo o scaffold do código.
3. Migramos este conteúdo pro repositório próprio quando ele estiver acessível.
