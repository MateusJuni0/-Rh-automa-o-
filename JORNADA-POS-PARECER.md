# Jornada depois do parecer — do envio à garantia (fecha a cauda do ciclo)

> **Gap encontrado na auditoria (2026-06-18):** a metade "preparar → entrevistar →
> parecer" estava sólida, mas **depois do parecer o produto deixava de ter fluxo.**
> `process.stage` (`submitted|client_iv|offer|placed`) e `placement_outcome`
> (ficou/saiu na garantia) existiam no schema **sem nenhum motor que os percorresse** —
> e é nesta metade que está a comissão da Filipa. Este doc fecha isso.

---

## 1. As transições de etapa (o motor que faltava)

O `process` tem etapas até à colocação. Cada transição é **um gesto explícito** (botão
na web app **ou** o assistente, via a tool `mover_process(stage, motivo)` — efeito
`gravar`, com confirmação). Nada avança sozinho sem rasto.

```
screening → interview → submitted → client_iv → offer → placed
                 │           │          │          │        └─► placement_outcome (§2)
                 │           │          │          └─ negociação (§3)
                 │           │          └─ cliente entrevista (§4)
                 │           └─ enviar o parecer AVANÇA para 'submitted' (efeito atómico)
                 └─ no-show → volta a 'screening' + reagendar (§5)
```

- **Enviar o parecer ao cliente** (`send_email`/`enviar_parecer`) **move o stage para
  `submitted`** como **efeito atómico** — acaba o desencontro "enviei o email numa tela,
  atualizei o pipeline noutra". (Era um gap: dois gestos desconexos.)
- O **kanban da Tela 1** ganha as colunas em falta: `Enviados → Entrevista do cliente →
  Oferta → Colocado`. A Filipa vê o funil **até ao fim**, não até "enviado".

---

## 2. ⭐ Capturar o resultado da colocação (`placement_outcome`) — o ground-truth

`placement_outcome` (`hired/stayed/left_in_guarantee`) é o **sinal mais forte da
calibração** (`INTAKE §D.1`) — mas só se sabe **semanas/meses depois**. Faltava quem o
recolhesse. Resolução: **o assistente proativo** (`ASSISTENTE-PROATIVO`) agenda um
**follow-up automático**:

- Ao marcar `placed`, grava-se `guarantee_until` (fim do período de garantia).
- Em `guarantee_until − X dias`, o assistente pergunta à Filipa: *"O candidato Y ficou
  na empresa Z, ou saiu dentro da garantia?"* → grava `guarantee_result`.
- Também pergunta o `decision`/`decline_reason` quando uma oferta é recusada (ex.:
  contraproposta) — alimenta a calibração e o ângulo de venda futuro.

> Sem isto, `placement_outcome` era tabela morta e o diferencial "medimo-nos, não é fé"
> ficava sem o seu melhor sinal. Agora fecha o loop.

---

## 3. Oferta / negociação (etapa `offer`)

Acompanhamento leve (não é um CRM completo): o `process` em `offer` regista o estado
(proposta enviada / contraproposta / aceite / recusada) e o assistente ajuda a
**redigir/responder** (tool `gen`/`send` com confirmação) e a **detetar risco de
contraproposta** (já capturado na entrevista — `INTAKE Parte E`). Outcome → §2.

---

## 4. A entrevista do CLIENTE — o parecer prepara-a (valor quase-grátis)

Não construímos um copiloto para o cliente. Mas o parecer (versão Cliente) ganha uma
secção **"Para a tua entrevista"**: as **3–4 perguntas que o cliente ainda deve fazer**
— geradas dos critérios que ficaram `raso`/`não-tocado` (a mesma fonte do frame da
Camada B). Fecha o ciclo e reforça o anti-ping-pong, sem feature nova.
*(Atualiza `RELATORIO-CLIENTE.md` — secção nova na versão Cliente.)*

---

## 5. No-show / cancelamento (fecha o lado de jornada do H6)

A sala LiveKit fecha por timeout (já previsto). **Falta o pipeline:** no-show →
o `process` **volta a `screening`** (não fica preso em `interview`) + o assistente
proativo **propõe novo horário** (já tem agenda + Google Calendar). Sem isto, cada
no-show deixava lixo no funil que a Filipa limpava à mão.

---

## 6. Comparar candidatos — gatilho proativo (não só a pedido)

A comparação (`ASSISTENTE-CONVERSA Modo C`) dependia de a Filipa **se lembrar de
pedir**. Como o modelo permite **N candidatos por vaga** (`process` UNIQUE candidate×job),
o assistente proativo **deteta ≥2 `process` em `submitted`/`client_iv` para o mesmo
`job`** e **sugere a comparação** (push). Assim a capacidade não fica por usar.

---

## 7. O que isto toca (resumo p/ a construção)

- **Schema:** nada novo — usa `process.stage`, `placement_outcome`, `agenda_event` que
  já existem. Liga `enviar_parecer`→`submitted` e `placed`→agenda follow-up de garantia.
- **Tools do agente** (`AGENTE-TOOLS-E-WS`): +`mover_process(stage, motivo)` (efeito
  `gravar`). As de email/agenda já existem.
- **UI:** kanban com as colunas até `Colocado`; secção "Para a tua entrevista" no parecer.
- **Proativo** (`ASSISTENTE-PROATIVO`): follow-up de garantia + sugestão de comparação +
  reagendamento de no-show.
