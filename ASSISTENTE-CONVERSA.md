# O cérebro do chatbot — Q&A, comparação e conversa com a Filipa

> **Gap fechado (2026-06-17):** falávamos do "chat com o bot" em vários sítios
> (`ACESSO-E-CONHECIMENTO`, `CAMADA-CONHECIMENTO` §Q&A, `ARQUITETURA-TEMPO-REAL` §9
> chat ao vivo) mas **nunca escrevemos o que ele é por dentro**: o que faz, como
> raciocina, o que pode e não pode, e como **compara candidatos**. Este doc é esse
> cérebro. Faz parte da **Parte 1** (a inteligência), não da embalagem.

---

## 1. O que é (e o que NÃO é)

É o **mesmo cérebro** do copiloto ao vivo, mas **sem pressão de tempo** → corre em
**Opus 4.8** (qualidade), enquanto o ao vivo é Sonnet (latência). É um
**RAG ancorado**: responde **só** do que está guardado, **sempre com a fonte**.

| É | NÃO é |
|---|---|
| Um assistente que responde sobre **um candidato, um cliente, ou vários candidatos** | Um chatbot genérico que "sabe coisas" do mundo |
| Ancorado na **memória da entidade** + transcrição (Camada A) + pesquisa (`source_doc`) | Um modelo a opinar de cabeça |
| Cita **sempre** o trecho/segundo/url que fundamenta | Uma fonte de achismo |
| Fala na **língua da Filipa** (traduz jargão) | Técnico/cru |

---

## 2. Regra-mãe: ancoragem + "não sei é uma resposta"

```
Pergunta da Filipa
   │
   ▼
Procura (RAG) na memória da entidade + transcript_chunk + source_doc
   │
   ├─ ENCONTROU → responde + cita a fonte (trecho 34:12 ▸ / repo X obtido DD/MM)
   │
   └─ NÃO ENCONTROU → diz "isto não foi falado / não está provado"
                      e oferece "marcar como a confirmar com o candidato"
```

**Nunca inventa.** Se não está na memória, a resposta honesta é *"não foi dito"* —
e essa é exatamente a que protege a Filipa de prometer ao cliente algo que não se sabe.
Herda as **4 regras anti-achismo** (cita evidência · facto≠opinião · diz incerteza ·
linguagem simples) de `INTAKE-E-JULGAMENTO.md` Parte C.

---

## 3. Os quatro modos

### Modo A — Q&A sobre UM candidato *(o "tira-dúvidas sem ligar de volta")*
*"O João falou de testes?"* → trecho exato da entrevista (Camada A), mesmo que o bot
não tenha "marcado" testes ao vivo. É o 2º travão anti-ping-pong (`CAMADA-CONHECIMENTO`
§ anti-recontacto): a Filipa pergunta ao bot **antes** de incomodar o candidato.

### Modo B — Q&A sobre UM cliente
*"O que é que a SecureGPT costuma valorizar?"* → responde do `client_memory_fact` +
`client_criteria` + histórico de vereditos. Afia a lente do cliente nas próximas vagas.

### Modo C — ⭐ COMPARAR candidatos (o gap que o Mateus pediu)
*"Compara o Mateus e a Ana para a vaga da SecureGPT."* É onde a comparação vive — **no
fim, quando a Filipa conversa com o bot**, não um ecrã sempre presente.

**Como raciocina:**
1. Pega nos `process` dos candidatos para **a mesma `job`**.
2. Para cada um, lê o **estado final do frame** (cada requisito: provado / raso /
   contradito / não-tocado) + os `candidate_memory_fact` com evidência.
3. Alinha **lado a lado contra os `client_criteria`** (com os pesos must/normal/nice).
4. Produz uma **matriz critério-a-critério**:

```
Critério (peso)          | Mateus                    | Ana
-------------------------|---------------------------|---------------------------
IA / RAG (must)          | ✅ forte — Lince Brain     | 🟡 raso — só mencionou
Node.js backend (must)   | ✅ ok — mistura Python     | ✅ forte — 4 anos puro Node
Trabalho em equipa (must)| ⚠️ por provar (fundador)   | ✅ forte — 3 anos em squad
Azure (nice)             | 🔴 só teoria              | ✅ certificada
```

5. **Conclusão honesta, não um vencedor cego:** mostra o **trade-off** ("o Mateus é
   mais forte em IA; a Ana encaixa melhor em equipa") e **nunca elimina por um `nice`**
   (compensação holística — `INTAKE` Parte F). **A Filipa decide.**
6. Cada célula é **clicável até à prova** (trecho/timestamp/url).

> Regra: comparar é **alinhar evidência**, não inventar um ranking. Se um candidato
> tem um critério `não-tocado`, a matriz **assinala o buraco** em vez de assumir.

### Modo D — Chat AO VIVO (durante a entrevista)
Já em `ARQUITETURA-TEMPO-REAL.md §9`: a Filipa escreve no overlay (*"ele já falou de
salário?"*) e o bot responde do **estado vivo + transcrição corrente**, **sem parar a
captura**. É o Modo A, mas servido em tempo real.

---

## 4. Fontes que o cérebro lê (e a prioridade entre elas)

1. **`transcript_chunk` (Camada A)** — a fonte de verdade do que foi dito. Prioridade
   máxima; é o que cita com timestamp.
2. **`candidate_memory_fact` / `client_memory_fact`** — factos já destilados (recall
   rápido), com a sua proveniência.
3. **`source_doc`** — o que veio da pesquisa (repo/web), **marcado como indício**;
   citado com url + `obtido_em`, nunca apresentado como prova dada pelo candidato.
4. **frame final** (`interview_tick`/report) — o estado por requisito, para Modo C.

**RGPD:** factos `classificacao='personal'` / `usar_no_score=FALSE` servem para
**recall** (o bot pode responder) mas **nunca** entram num juízo de adequação/comparação.

---

## 5. Línguas

PT-PT/PT-BR por defeito; entende e resume conteúdo em **EN/FR** (entrevista pode ser
nessas línguas) → **saída sempre em PT**, com jargão traduzido. É a mesma competência
bilingue do `CAMADA-CONHECIMENTO.md`.

---

## 6. Onde aparece (a forma fica para a embalagem)

- Na **web app**: aba de chat por candidato/cliente + ecrã de comparação (Modo C).
- No **overlay desktop**: chat ao vivo (Modo D).
- *O visual e a navegação detalham-se em `UI-DESIGN.md`.* Aqui fixa-se o **cérebro**.

---

## 7. Modelo & custo

- **Opus 4.8** para Q&A/comparação (qualidade, sem pressão de tempo); **Sonnet 4.6**
  para o chat ao vivo (latência). Embeddings: `text-embedding-3-small` (RAG).
- Comparação é **1 chamada Opus** sobre estados já calculados (não re-analisa as 2h) →
  barato. O caro (analisar a entrevista) já aconteceu ao vivo.
