# Relatório — desenhado contra os critérios do cliente (anti-ping-pong)

> **Decisão 2026-06-17:** o parecer deixa de ser um "resumo bonito da entrevista" e
> passa a ser uma **resposta antecipada às perguntas que ESTE cliente sempre faz**.
> O objetivo é matar o **ping-pong**: o cliente recebe o relatório e **não tem mais
> perguntas** — porque já estão todas respondidas, com prova.

Este doc detalha o entregável que `ACESSO-E-CONHECIMENTO.md §4` e `PLANO-CONSTRUCAO.md
P3.x` referem. Renderiza-se a partir do **frame de avaliação da Camada B**
(`ARQUITETURA-TEMPO-REAL.md §9`) — cada frase é **rastreável** a um trecho da Camada A.

---

## 1. O problema que resolve: o ping-pong

Hoje a Filipa manda um resumo, o cliente lê e responde *"sim, mas ele já liderou
equipa? e aguenta pressão? e quanto pede?"* — e começa o vai-e-vem, às vezes
recontactando o candidato. Cada ida e volta custa dias e desgasta a relação.

**Dois travões (desenhados em conjunto):**
1. **Relatório critério-a-critério** (este doc): responde de antemão a tudo o que o
   cliente costuma perguntar.
2. **Q&A Filipa↔bot** (`CAMADA-CONHECIMENTO.md`): se o cliente pergunta algo novo, a
   Filipa pergunta ao bot; se está na transcrição, responde na hora sem recontactar.

---

## 2. De onde vêm os "critérios do cliente"

- Capturados no **setup** do cliente/mandato (`INTAKE-E-JULGAMENTO.md` — critérios do
  cliente) → tabela `client_criteria` (`MODELO-DADOS.md`).
- Reforçados ao longo do tempo pelas **preferências reveladas** (o cliente recusou 2
  perfis sem liderança → "liderança" vira critério com peso, mesmo sem estar escrito).
- Cada critério **vira linha do rubric** → a entrevista é conduzida para **obter prova**
  de cada um (a escada de prioridade da Camada B prioriza must-haves por cobrir).

> Resultado: quando se gera o relatório, **já há prova (ou ausência assinalada)** para
> cada critério que o cliente liga.

---

## 3. Estrutura do relatório (a versão CLIENTE)

```
1. Veredito de uma linha        "Recomendo avançar — forte em X e Y, a confirmar Z."
2. Resposta critério-a-critério  para CADA client_criteria:
     • critério (na linguagem do cliente)
     • resposta: coberto-com-prova / raso / não-confirmado / contradito
     • CITAÇÃO + TIMESTAMP  ("'refiz o pipeline da equipa' — 34:12")
     • leitura em 1 frase, linguagem do cliente
3. Forças                        em linguagem do cliente (não jargão)
4. Riscos / o que sondar         o que ficou raso ou por confirmar (honesto)
5. Logística                     salário, aviso prévio, disponibilidade, remoto,
                                 risco de contraproposta
6. Ângulo de venda               porque é que este candidato encaixa nos drivers do
                                 cliente (ajuda o cliente a decidir)
7. Fontes                        ligações aos trechos (Camada A) que provam tudo acima
```

### Regra dura — critério não coberto assinala-se sozinho
Se um `client_criteria` ficou `não-tocado`/`raso` na entrevista, o relatório **não o
esconde nem inventa**. Escreve, no próprio sítio do critério:

> *"**Liderança de equipa** — ⬜ não confirmado nesta entrevista. Recomendo perguntar
> ao candidato / numa próxima conversa."*

Isto mantém a confiança: o cliente sabe exatamente o que está provado e o que não está.
(É a **Regra 3 anti-achismo** — incerteza dita, não escondida — aplicada ao relatório.)

---

## 4. Duas versões, uma fonte

| | **Interna** | **Cliente** |
|---|---|---|
| Para | a Filipa (leitura rápida) | a empresa-cliente |
| Tom | telegráfico, com notas e dúvidas | polido, apresentável, linguagem do cliente |
| Inclui | tudo + raciocínio + flags do bot | só o que serve a decisão do cliente |
| Acesso | sempre | 1 clique a partir da interna |

- **Mesma fonte** (o frame da Camada B); muda só a renderização.
- A versão Cliente é **editável** pela Filipa antes de sair, **exportável** (md/pdf), e
  tem botão **"preparar email pro cliente"**. Campos em `report` (`content_md` interna,
  `content_client_md` cliente, `content_edited` edição) — `MODELO-DADOS.md §5`.

---

## 5. Rastreabilidade (porque é defensável)

Cada afirmação do relatório aponta para o(s) `transcript_chunk` que a fundamentam.
Clicar numa citação abre o trecho (texto + timestamp + falante) na Camada A. Sem
caixa-preta: o cliente (e a Filipa) podem **auditar** qualquer conclusão até à fala
original. É isto que separa o nosso parecer de um "resumo de IA" genérico.

### O parecer também puxa da PESQUISA (link/código visto) — com selo de prova (2026-06-17)

Quando houve **pesquisa ao vivo** (o candidato deu um repo/portfólio/link — ver
`ARQUITETURA-TEMPO-REAL §9` e `CAMADA-CONHECIMENTO` ciclo de pesquisa), o parecer pode
usá-la — mas **nunca a confunde com prova dada pelo candidato**. Cada afirmação leva um
**selo de origem**:

| Selo | Vem de | No parecer |
|---|---|---|
| **✅ provado** | o candidato **disse/explicou** (`transcript_chunk`) | citação + timestamp clicável |
| **🔎 verificado na fonte** | `source_doc` (repo/site) **+** o candidato **confirmou** ao vivo | cita o trecho **e** a url + `obtido_em` |
| **🔎 indício (a confirmar)** | só `source_doc`, **sem** confirmação do candidato | aparece como *contexto*, nunca como capacidade provada; sugere confirmar |

- Um facto que é **só** pesquisa (`estado_prova='a_confirmar'`) **não conta** como
  capacidade demonstrada — entra como *"segundo o repo X (obtido DD/MM): … — a confirmar
  com o candidato"*. É a mesma Regra 3 (incerteza dita) aplicada à pesquisa.
- Exemplo: *"o repo do Lince Brain mostra 262 testes (obtido 17/06); o candidato
  confirmou e explicou um bug que um teste apanhou (41:30) → **🔎 verificado na fonte**."*
  vs. *"o repo aparenta usar LangGraph, mas não foi falado na entrevista → **indício**."*

---

## 6. Garantias / critérios de aceitação (resumo — detalhe em TESTES-ACEITACAO.md)
- Todo `client_criteria` aparece no relatório, com estado explícito.
- Todo critério `coberto-com-prova` tem citação + timestamp clicável.
- Critério não coberto é **assinalado**, nunca omitido nem inventado.
- Versão cliente: zero jargão sem tradução (Regra 4).
- Secções logística e ângulo de venda presentes quando há dados; quando faltam dados,
  assinalado ("pretensão salarial não recolhida").

---

## 7. Perguntas em aberto
- **Pré-visualização ao cliente:** mandamos PDF, link partilhável, ou ambos? (link
  permite ver os trechos clicáveis; PDF é mais "fechado".) → decidir.
- **Quanto da logística** (ex.: salário) entra na versão **cliente** por defeito vs
  fica só na interna até a Filipa decidir? → provável: salário só com aval da Filipa.
- ✅ **Feedback ao candidato (dor #7):** RESOLVIDO — é uma **capacidade do assistente
  pessoal** (gera o rascunho a pedido), não vive no parecer. `ASSISTENTE-PESSOAL §3`.

## 8. Envio de email — provider (fecha o gap A6/13)
O botão "preparar email" e o envio do assistente precisam de um provider:
- **Decisão:** **Resend** (configurável por deployment), igual ao padrão do IRIS —
  precisa de `RESEND_API_KEY` (gap conhecido, mesmo do IRIS). Alternativa de arranque:
  o **GoTrue SMTP da VPS** já configurado (`smtp.gmail.com`) para volume baixo.
- O envio é uma ação `enviar_fora` → passa pela **porta de confirmação** (`ASSISTENTE-PESSOAL §2.1`).
- ⚠️ Pendência operacional (não bloqueia spec): pôr a chave no deployment (igual ao IRIS).
