# Filosofia das perguntas — profundidade, não checklist

> **Mateus (2026-06-18):** a Filipa não é técnica. A contratar um AI Engineer, ela não
> deve perguntar "que tecnologias mexes" — isso ela nem julga, e a parte de *mexer na
> ferramenta* é cada vez mais feita pela IA. As perguntas têm de ser **mais profundas**:
> **como** ele trabalha, **o que** faz, **como decide**. Este doc fixa esse princípio —
> governa a geração de perguntas no briefing (`CAMADA-CONHECIMENTO`) e ao vivo (o "fosso",
> `ARQUITETURA-TEMPO-REAL §9`).

## O princípio
> **Uma pergunta vale pelo sinal que extrai, não pelo tópico que toca.** Um checklist de
> tecnologias é o sinal mais fraco: é memorizável, inflacionável, e a Filipa não o
> consegue julgar. O sinal forte é o **raciocínio** — e esse é **julgável por qualquer
> pessoa**, técnica ou não.

## As 7 regras de uma boa pergunta (a Vera gera assim)
1. **COMO/PORQUÊ, não O-QUÊ.** Não "usas X?" mas *"como resolveste / como decidiste /
   como soubeste que estava bom?"*. O raciocínio não se decora.
2. **Caso real, não hipótese.** *"Conta-me uma vez em que…"* extrai evidência; *"sabes
   fazer X?"* extrai um "sim".
3. **O que correu MAL.** *"O que falhou? como apanhaste?"* — erros + como os geriu revelam
   profundidade e honestidade melhor que qualquer sucesso.
4. **Trade-offs e decisões.** *"Porquê A e não B?"* revela julgamento — o que distingue
   quem percebe de quem repete.
5. **Ownership / iniciativa.** *"O que farias diferente? onde foste além do pedido?"*
6. **Traduzida para a Filipa.** Sai na linguagem dela e a resposta é **avaliável por ela**
   (uma boa história de raciocínio nota-se; um recital de stack não). Zero jargão cru.
7. **A competência PROVA-SE pela profundidade.** Não se risca um requisito por um "sim" —
   risca-se quando a pessoa **mostra como** (o fosso aprofunda até à prova).

## Exemplo — o caso do próprio Mateus (AI Engineer)
- ❌ Fraco (checklist): *"Que frameworks de RAG e agentes usas? Sabes LangGraph?"*
- ✅ Forte (profundidade): *"Conta-me um sistema de IA que puseste em produção a sério —
  qual era o problema, como decidiste a arquitetura, o que correu mal, e como soubeste
  que estava bom?"* → e aprofundar: *"o que fizeste quando a IA dava respostas erradas?
  como mediste? o que mudarias?"*
- Isto revela se ele **construiu de verdade** vs **montou com ferramentas** — exatamente
  o que a nossa validação já tinha apanhado (a pergunta C3 do `validacao-caso-01`:
  *"leste o código ou só aprovaste o que a IA gerou?"*). Profundidade > stack.

## Onde isto entra no produto
- **Role Profile / `o_que_e_bom`** (`CAMADA-CONHECIMENTO`): os critérios encodam
  **sinais de profundidade** ("explica quando NÃO usaria X", "dá um caso com número"),
  **não** palavras-chave de tecnologia.
- **Briefing (antes):** as 3 lentes geram perguntas no nível COMO/porquê/caso-real.
- **Ao vivo (o fosso, §9):** cada afirmação é perseguida com *"como exatamente? dá um
  caso. o que correu mal?"* até prova — é a regra 7 em ação.
- **Veredito/parecer:** "forte" exige a **prova do raciocínio**, não a menção do tópico.

> Nota honesta: a competência técnica **ainda importa** (o cliente pode exigi-la, e está
> no rubric como must). O princípio não é "nunca falar de tecnologia" — é **nunca ficar
> pelo checklist**: a tecnologia prova-se pela profundidade do como/porquê, que é o que a
> Filipa consegue conduzir e julgar.
