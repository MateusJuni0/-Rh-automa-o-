# Camada de Conhecimento — o que o bot sabe que a Filipa não sabe

> **Contexto (2026-06-16):** o Mateus levantou o problema central:
> "a gente não está treinando ele para ver o que realmente é bom."
> O bot recebe os documentos da Filipa — mas não sabe, de origem, o que constitui
> uma boa resposta técnica para um dev de React. Este documento resolve isso.

---

## O problema: o bot não tem chão epistemológico

A Filipa não é técnica. O cliente manda "quero um dev pleno de React" e ela vai ao
LinkedIn buscar alguém. Mas **quem avalia se a resposta do candidato foi boa?**

Sem uma camada de conhecimento externo, o bot só sabe o que a Filipa e o cliente
colocaram nos ficheiros — que também não são técnicos. **O bot ficaria a "achar"**,
e "achismo" é exatamente o que o Mateus quer eliminar.

---

## A solução: 3 sub-camadas de conhecimento

```
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA 3 — CONHECIMENTO                                        │
│                                                                 │
│  ① Web / Externo (agora)                                        │
│     "o que o mercado sabe sobre este role"                      │
│      → web search → role profile canônico                       │
│                                                                 │
│  ② Acumulado do cliente (a prazo)                               │
│     "o que ESTE cliente aprova e rejeita"                       │
│      → RAG por cliente (decisões §11 item RAG-por-cliente)      │
│                                                                 │
│  ③ Acumulado interno Filipa (longo prazo)                       │
│     "padrões que emergem dos nossos próprios vereditos"         │
│      → muda web search por RAG interno quando tivermos dados    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sub-camada ① — Web / Externo (o que construímos agora)

### Quando dispara

Sempre que uma nova vaga é criada e o role-type é identificado pela primeira vez
**nesta agência**. Exemplo: Filipa cria vaga "dev React pleno" → bot vai buscar o
que o mercado sabe sobre esse role.

### O que o bot busca

Via web search (Brave / Exa / DuckDuckGo — escolher na implementação):

| Consulta | O que extrai |
|---|---|
| `"React developer senior" skills 2025 interview` | competências esperadas por nível |
| `"frontend developer" interview questions behavioral` | perguntas comportamentais típicas |
| `"React" red flags junior masquerading senior` | sinais de que o nível declarado está errado |
| `"dev pleno" o que esperar` | definição em PT-BR do que é pleno vs sênior vs júnior |

### O que o bot produz (Role Profile)

Estrutura JSON guardada por role-type (não por vaga — reutilizável):

```jsonc
{
  "role_type": "dev_frontend_react_pleno",
  "criado_em": "2026-06-16",
  "nivel": "pleno",
  "fontes": ["url1", "url2"],
  "competencias_esperadas": [
    { "skill": "hooks (useState, useEffect, useCallback)", "nivel": "obrigatório" },
    { "skill": "reconciliation / re-render awareness", "nivel": "obrigatório" },
    { "skill": "Redux ou Zustand", "nivel": "desejável" },
    { "skill": "TypeScript", "nivel": "desejável pleno / obrigatório sénior" }
  ],
  "o_que_e_bom": {
    "React": "descreve o Virtual DOM sem decorar; explica quando NÃO usaria useEffect",
    "Testes": "distingue unit vs integration; já sofreu com falso positivo"
  },
  "sinais_de_nivel_errado": [
    "Diz '5 anos de React' mas não sabe citar um caso real de performance fix",
    "Confunde useCallback com useMemo na explicação"
  ],
  "perguntas_chave_tecnicas": [
    "Conta um momento em que o app ficou lento e o que fizeste.",
    "Como decides entre useState local e estado global?"
  ],
  "linguagem_para_filipa": {
    "React": "biblioteca que faz páginas web reagir às ações do utilizador sem recarregar",
    "pleno": "consegue trabalhar sozinho nas tarefas do dia a dia; ainda pede opinião em decisões grandes"
  }
}
```

### Como entra no copiloto

- **No briefing (Antes):** o roteiro de perguntas é gerado com base nas competências_esperadas + o_que_e_bom → o bot sabe o que é uma boa resposta e marca quando o candidato acerta ou erra.
- **Durante (estado vivo):** quando o candidato responde sobre React, o bot compara com `o_que_e_bom["React"]` e decide se "coberto" ou "investigar mais".
- **No parecer (Depois):** o bot mapeia o que o candidato demonstrou vs competencias_esperadas e explica em `linguagem_para_filipa`.

### Cache e atualização

- Role Profiles são guardados por role-type na DB (não por vaga).
- TTL: 90 dias (tecnologia muda; rebusting automático).
- Primeira vaga de um role-type: busca web. Seguintes: reusa o Role Profile existente.
- Filipa pode editar manualmente o Role Profile (campo "notas da Filipa") — a opinião dela tem prioridade sobre o mercado.

---

## Sub-camada ② — Acumulado do cliente (a prazo)

Já decidido (DECISOES-E-MVP.md §11 item "RAG por cliente"). Resumo de como alimenta esta camada:

- A cada veredito do cliente ("aprovado", "recusado — porquê?") → o perfil do cliente ganha um ponto de dados.
- Com 3+ vereditos: o bot começa a gerar perguntas "lente do cliente" baseadas no **histórico real**, não só nos requisitos escritos da vaga.
- Exemplo: o cliente recusou 2 devs que não tinham liderado equipa → na próxima vaga, mesmo sem estar escrito, o bot sabe que este cliente dá peso a isso.

**Trigger para construir:** após MVP funcional com ≥1 cliente real.

---

## Sub-camada ③ — Acumulado interno da Filipa (longo prazo)

A transição progressiva do externo para o interno:

```
Fase A (agora):     Role Profile = 100% web search
Fase B (5+ vagas):  Role Profile = 70% web + 30% padrões internos
Fase C (maturidade): Role Profile = 30% web + 70% padrões internos
```

O bot detecta automaticamente quando tem dados suficientes para diminuir a dependência do web search e diz à Filipa: *"já temos dados suficientes de devs React para afinar o perfil com base nos nossos próprios resultados."*

---

## Garantias desta camada (sem achismo)

| Risco de achismo | Como é resolvido |
|---|---|
| Bot não sabe o que é "boa resposta técnica" | Role Profile define o que é bom + sinais de nível errado, antes da entrevista |
| Filipa não entende o que o candidato disse | `linguagem_para_filipa` no Role Profile garante tradução consistente |
| Perguntas genéricas que não se aplicam ao cliente | Sub-camada ② afia com o histórico do cliente específico |
| Depender de web search para sempre | Migração progressiva para RAG interno (sub-camada ③) |
| Role Profile desatualizado | TTL 90 dias + Filipa pode invalidar manualmente |

---

## Nota de implementação

- Web search: testar Exa primeiro (melhor para conteúdo técnico); fallback Brave Search API.
- Extração: Claude Haiku com output estruturado (JSON Schema) → barato, rápido.
- Storage: tabela `role_profiles` no Supabase, indexada por `(agency_id, role_type_slug)`.

> ### CONFLITO resolvido (2026-06-17) — web search ao vivo
> **Contradiz:** a regra original *"não fazer web search durante a entrevista ao vivo"*.
> **Evidência nova:** o Mateus decidiu (2026-06-17) que o bot **pesquisa ao vivo** quando
> o candidato **dá um link / mostra um projeto / nomeia um repo** — ver
> `ARQUITETURA-TEMPO-REAL.md §9` ("Pesquisa ao vivo").
> **Resolução (não se contradizem, são dois usos distintos):**
> - **Role Profile / conhecimento do mercado** → continua no **"Antes"** (pesado, abrangente, preparado e em cache).
> - **Pesquisa pontual ao vivo** → **event-triggered** (só quando há uma referência verificável), **assíncrona** (nunca trava a call), **estreita** (aquele link/repo), e o resultado é **indício a confirmar**, não veredito. O grosso continua a ser preparado antes.

---

## Como esta camada é APLICADA — compreensão semântica, não palavras-chave (2026-06-17)

O Role Profile (`o_que_e_bom`, `sinais_de_nivel_errado`) **não** é usado como uma
lista de palavras a "caçar" na transcrição. É usado pela **Camada B** (compreensão
semântica — ver `ARQUITETURA-TEMPO-REAL.md §8–§9`) como **gabarito de significado**:

- O bot **interpreta** a resposta do candidato e compara o *significado* com o nível
  do rubric — não procura o token "reconciliation".
- Exemplo: o `o_que_e_bom["React"]` diz *"explica quando NÃO usaria useEffect"*. Se o
  candidato disser *"deixei de pôr lógica naquele sítio que corre depois do render
  porque estava a disparar duas vezes"* — **sem nomear `useEffect`** — a Camada B
  reconhece que ele demonstrou exatamente o critério e marca `coberto-com-prova`.
- Isto fecha o buraco do candidato que **sabe mas não fala "à manual"**, e do
  candidato que **decora o jargão sem substância** (diz "reconciliation" mas a
  explicação é oca → fica `raso`).

> O Role Profile dá o *chão epistemológico* (o que é bom); a Camada B dá a *leitura*
> (o candidato demonstrou isso?). Os dois juntos eliminam o achismo **sem** depender
> de gatilhos lexicais.

> **`o_que_e_bom` encoda SINAIS DE PROFUNDIDADE, não palavras-chave de tecnologia**
> (`FILOSOFIA-DAS-PERGUNTAS.md`): ex. "explica quando NÃO usaria X" / "dá um caso com
> número" — não "menciona React". As perguntas que daí saem são como/porquê/caso-real,
> julgáveis pela Filipa não-técnica; a competência prova-se pela profundidade.

---

## O bot é BILINGUE — tech ↔ recrutador ↔ cliente (decisão 2026-06-17)

A `linguagem_para_filipa` do Role Profile deixa de ser só um glossário estático e
passa a ser uma **competência de tradução em ambos os sentidos**. O bot fala três
"línguas" e converte entre elas sem que a Filipa tenha de se tornar técnica:

| Língua | Quem a usa | Exemplo |
|---|---|---|
| **Técnica** | o candidato | "fiz code-splitting e lazy loading das rotas" |
| **Recrutador** | a Filipa | "ele sabe deixar o site a abrir rápido?" |
| **Cliente** | a empresa | "garante boa experiência de utilizador em produção" |

> **Multi-idioma (2026-06-17):** a entrevista pode ser em **PT-PT/PT-BR/EN/FR** (a
> Filipa fala inglês). O bot traduz o significado de qualquer um destes para a saída em
> **PT** — a "tradução" não é só tech↔negócio, é também entre línguas. Ver
> `ARQUITETURA-TEMPO-REAL.md §2`.
>
> **Arranque a frio:** enquanto a calibração não ganha massa, a leitura semântica
> apoia-se no **Role Profile** + nos **`client_criteria` declarados** — e sinaliza
> confiança baixa em vez de fingir certeza (Regra 3). Ver `INTAKE-E-JULGAMENTO.md` Parte D.

### Q&A Filipa ↔ bot — linguagem natural nos dois sentidos
A Filipa pergunta **como a um colega**, e o bot responde por **RAG sobre a Camada A**
(transcrição completa) + os factos destilados:

```
Filipa: "o gajo aguenta liderar uma equipa ou é mais executor?"
Bot:    "Pelo que disse, mais executor com pendor para liderar: contou que
         'organizou as tarefas do trio e fez a ponte com o cliente' (34:12) —
         é coordenação informal, não gestão formal de pessoas. Não falou de
         avaliar/contratar/dar feedback. Se o cliente quer um líder a sério,
         vale confirmar isso." [trecho 34:12 ▸]
```

- A resposta é **rastreável** (cita o trecho com timestamp da Camada A).
- O bot traduz a pergunta coloquial da Filipa para o significado técnico, procura, e
  **devolve em linguagem dela** — com a fonte.

### Segundo travão ao ping-pong (anti-recontacto)
Quando o **cliente** manda uma pergunta nova depois da entrevista
(*"ele já trabalhou com bases de dados grandes?"*), a Filipa **pergunta ao bot
primeiro**. Se a resposta **está na transcrição** (Camada A), o bot responde **na
hora** — a Filipa nunca tem de recontactar o candidato por algo que já foi dito.
Só se **não estiver** lá é que se marca como "a confirmar com o candidato". Ver
também o primeiro travão (relatório critério-a-critério) em `RELATORIO-CLIENTE.md`.

---

## Calibração — agora fecha com o RESULTADO da colocação (decisão 2026-06-17)

A sub-camada ② (acumulado do cliente) ganha um sinal novo e mais forte que o veredito
da entrevista: **o que aconteceu DEPOIS de colocar**.

```
veredito da entrevista (bot disse "forte")
        │
        ▼
veredito do cliente (aprovou / recusou — porquê)        ← já existia (Camada 3a)
        │
        ▼
RESULTADO da colocação (ficou? saiu dentro da garantia?) ← NOVO sinal de verdade
```

- Se o bot disse "forte", o cliente contratou, e a pessoa **ficou** → confirma o
  julgamento. Se **saiu na garantia** → sinal de que o rubric ou a lente do cliente
  falhou algo (skill real? fit? expectativa mal alinhada?).
- Este resultado é o **ground-truth** mais valioso do sistema — vale mais que
  qualquer auto-avaliação. Alimenta a migração web→interno (sub-camada ③) com dados
  que são *outcomes reais*, não opiniões. Modelo: `placement_outcome` em
  `MODELO-DADOS.md`.

---

## ⭐ Nicho-agnóstico — a Filipa recruta MUITO além de tecnologia (decisão 2026-06-17)

> **O Mateus levantou:** a Filipa tem **mais nichos do que tecnologia** — pode estar a
> recrutar enfermeiros, comerciais, contabilistas, chefs, advogados. **O bot tem de se
> adaptar a qualquer área**, não pode assumir "dev". Todos os exemplos acima (React,
> hooks) são só **ilustração** — a máquina por baixo é a mesma para qualquer função.

**Como o desenho já aguenta isto (e o que o torna explícito):**

- **O `role_type_slug` é livre** — `dev_frontend_react_pleno`, `enfermeiro_uci`,
  `comercial_b2b_senior`, `contabilista_toc`. Não há taxonomia fixa de tecnologia.
- **O Role Profile é um molde neutro**: "que competências tem um bom *X*?", "o que é
  uma resposta forte vs fraca?", "que sinais dizem que o nível declarado está errado?"
  — estas perguntas funcionam para **enfermeiro** tal como para **dev**. A web search
  só muda as consultas (`"enfermeiro UCI" competências entrevista` em vez de `React`).
- **A `linguagem_filipa` generaliza**: traduzir jargão→simples vale para qualquer área
  (jargão clínico, jurídico, financeiro). A regra "a Filipa não é técnica" passa a "a
  Filipa não é especialista **da área da vaga**" — o bot traduz sempre.
- **A lente "técnica" passa a chamar-se lente "da função / competência"** — confirma se
  o candidato domina o que **aquela função** exige, seja código ou cuidados intensivos.
  (As 3 lentes mantêm-se: 🔧 da função · 🟢 do cliente · 🔍 gaps do CV.)

**Exemplo não-tech (prova de que generaliza) — vaga "Enfermeiro de UCI":**
```jsonc
{
  "role_type": "enfermeiro_uci",
  "competencias": [
    { "skill": "ventilação mecânica invasiva", "nivel": "obrigatório" },
    { "skill": "manejo de fármacos vasoativos", "nivel": "obrigatório" },
    { "skill": "suporte avançado de vida (SAV)", "nivel": "obrigatório" }
  ],
  "o_que_e_bom": {
    "ventilação": "explica como ajusta parâmetros perante uma dessaturação, não decora protocolo",
    "trabalho em equipa": "dá um caso real de comunicar uma intercorrência ao intensivista"
  },
  "sinais_de_nivel_errado": ["diz 'experiência em UCI' mas não sabe descrever um desmame ventilatório"],
  "linguagem_para_filipa": {
    "fármacos vasoativos": "medicamentos que controlam a tensão arterial em doentes graves",
    "desmame ventilatório": "tirar o doente do ventilador aos poucos, com segurança"
  }
}
```
> O cérebro não muda. Muda o **conteúdo** que a pesquisa traz. É isto que torna o
> produto vendável a uma agência que recruta para **qualquer** setor.

---

## ⭐ O que o bot FAZ com o que pesquisa (o ciclo de vida da pesquisa) — decisão 2026-06-17

> **O Mateus levantou:** "ele pega o conteúdo na internet e faz o quê? salva numa
> pasta, destila e põe na memória? como vai lidar com essa parte?". Faltava desenhar.
> Aqui fica o ciclo completo — vale para a pesquisa do **Antes** (Role Profile) **e**
> para a pesquisa **ao vivo** (link/repo do candidato).

```
  pesquisa (Exa/Brave) ou fetch de um link/repo
        │
        ▼
  ① GUARDA O CRU (rastreável)  → tabela `source_doc` (+ embedding)
     url · tipo (web/repo/site) · obtido_em · texto/resumo · liga a job|candidate|client
        │
        ▼
  ② DESTILA EM FACTOS (Haiku, output estruturado), COM PROVENIÊNCIA
     cada facto aponta para o `source_doc` (url + obtido_em) e leva CONFIANÇA
        │
        ├─ é sobre a FUNÇÃO/mercado  → alimenta o `role_profile` (cache, TTL 90d)
        ├─ é sobre o CANDIDATO (repo/portfólio)
        │     → `candidate_memory_fact` com `source_type='research'`,
        │       marcado **'indício — a confirmar com o candidato'** (NÃO entra no score
        │       até ele confirmar ao vivo; vira prova quando confirma)
        └─ é sobre o CLIENTE/empresa → `client_memory_fact` (`source_type='web_research'`)
        │
        ▼
  ③ FICA PESQUISÁVEL (RAG)  → o embedding do `source_doc` permite ao Q&A e ao
     parecer **citarem a fonte** ("segundo o repo X, obtido a DD/MM: …")
```

**Regras (sem achismo):**
- **Tudo o que vem da web é INDÍCIO, não veredito.** A prova final é o que o candidato
  **explica/confirma**. Um facto de pesquisa sobre o candidato entra como
  `'a confirmar'` e só passa a `coberto-com-prova` quando ele o confirma ao vivo.
- **Proveniência obrigatória:** todo facto destilado aponta para o `source_doc` (url +
  `obtido_em`). Sem fonte, não se grava.
- **Confiança explícita:** fonte fraca/contraditória → confiança baixa, **dita** (Regra 3).
- **Frescura:** Role Profile TTL 90d; pesquisa sobre o candidato = **snapshot** mantido
  (é evidência do momento da entrevista); sobre o cliente = durável, re-pesquisável.
- **Custo:** a destilação é Haiku; o cru pesado não vai a cada tick do LLM (só o facto
  destilado entra no estado vivo) — coerente com o §3 (latência) e §8 (Camada A) de
  `ARQUITETURA-TEMPO-REAL.md`.

> Tabelas novas (`source_doc` + `source_doc_embedding`) e os campos de proveniência web
> nos `*_memory_fact`: ver `MODELO-DADOS.md` (Evolução — ciclo de pesquisa).

---

## Como se compila o Rubric (de onde saem as linhas) — fecha o G3

O **rubric** (o gabarito fraco/ok/forte por requisito) não nasce do nada — é
**compilado** (Opus, no "Antes") de **duas fontes**, e cada linha guarda a sua origem:

```
role_profile.competencias  ─┐
  (o que o MERCADO espera)  │
                            ├─►  RUBRIC (1 linha por requisito)
client_criteria             │     { requisito, peso(must/normal/nice),
  (o que ESTE cliente pede) ─┘       fraco/ok/forte, linguagem_filipa, origem }
```

- **`role_profile`** dá os requisitos da **função** + o que é resposta forte/fraca.
- **`client_criteria`** dá os requisitos **deste cliente** (incl. os inferidos de
  vereditos passados) + o **peso** (must/normal/nice).
- **Fusão:** quando os dois tocam o mesmo requisito, o **peso do cliente manda**; o que
  só vem do cliente entra na mesma (ex.: *"já liderou equipa?"* mesmo que o mercado não
  o liste). Cada linha do rubric leva `origem` = `role_profile` | `client_criteria` |
  `ambos`, para o parecer saber se um critério é "de mercado" ou "exigência do cliente".
- É o rubric resultante que o frame ao vivo (`ARQUITETURA-TEMPO-REAL §9`) usa para
  decidir `fraco/ok/forte` e que pesos aplicar na compensação holística (`INTAKE` Parte F).

### Versionamento — o cliente muda os requisitos a meio (fecha o gap H4)

O cliente acrescenta/muda um requisito **depois** de o rubric e o briefing estarem
feitos (às vezes a meio das entrevistas). Regra para não se perder:
- **Rubric e requisitos têm versão** (`rubric.version`, carimbada na geração). Mudar um
  requisito → o bot **recompila** o rubric (nova versão) e **avisa a Filipa** do que
  mudou (*"o cliente acrescentou 'inglês fluente' — atualizei o roteiro"*).
- **O frame ao vivo adota a versão nova** a partir daí; o que já foi provado **não se
  perde** (os factos do candidato continuam válidos, só se reavalia contra a lista nova).
- **O parecer diz contra que versão avaliou:** *"avaliado contra os requisitos de
  17/06 (v2); o critério 'inglês' foi acrescentado depois de 2 entrevistas."* — honesto,
  sem fingir que tudo foi medido desde o início (Regra 3 anti-achismo).
- Candidatos avaliados em versões diferentes → a **comparação** (`ASSISTENTE-CONVERSA`
  Modo C) assinala que não foram medidos pela mesma régua.
