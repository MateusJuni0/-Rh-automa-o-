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
- **Não fazer web search durante a entrevista ao vivo** — caro, lento, e o Role Profile já foi preparado. O web search acontece só no "Antes".
