# Acesso & Conhecimento — onde tudo vive e como a Filipa chega lá

> Regra-mãe: **destilar, separar e organizar não vale nada se a Filipa não
> conseguir aceder.** Tudo o que o bot produz tem de ser acessível por ela e
> **aberto** (exportável, não fechado num formato nosso).

---

## 1. A estrutura do conhecimento — 3 entidades, cada uma com a sua "pasta"

```
CLIENTE (empresa)                CANDIDATO (pessoa)
 ├─ o que pediu (vagas)           ├─ CV original
 ├─ o que valoriza (destilado)    ├─ perfil destilado (markdown)
 └─ histórico de SIM/NÃO  ◀──┐    ├─ memória das sessões (factos por competência, c/ timestamp)
                             │    └─ chat-com-bot (RAG só deste candidato)
        VAGA ────────────────┴── liga cliente ↔ candidato + requisitos
```

- **Candidato:** uma pasta que **engorda** a cada entrevista (memória RAG).
- **Cliente:** uma pasta que engorda a cada vaga + a cada veredito (ver §6).
- **Vaga:** o elo — junta o que o cliente pediu com os candidatos avaliados.

---

## 2. Como a Filipa acede (a web app é o "lar")

- Abre o **candidato** → lê o perfil, o resumo da entrevista e o parecer.
- **Descarrega** em markdown / PDF → manda ao cliente **ou** cola noutra LLM se quiser.
  *Aberto. Não prendemos nada.*
- **Conversa com o nosso bot**, focado naquela pasta (RAG): *"o João tem experiência
  com testes?"* → responde com **o trecho exato** da entrevista. É o futuro que
  pediste — ela tira dúvidas sobre o candidato **sem ter de ligar de volta a ele.**

> A "outra IA" pode ser a nossa **ou** a dela — o conteúdo é portável (markdown/PDF).
> O nosso bot é só o caminho mais cómodo, não uma jaula.

---

## 3. Durante a reunião — como as perguntas aparecem (resposta ao "popup?")

**Não é popup.** Popup que pisca no meio da fala é um anti-padrão (atrapalha a
conversa). O certo é um **painel lateral fixo**:

- Uma **janela estreita** que ela encosta ao lado do Meet/Zoom/Teams, ou num
  **2º monitor**, ou um **tablet/telemóvel** no presencial.
- **Calmo e glanceable:** uma sugestão em destaque por vez; as outras numa fila
  discreta. Ela olha 1 segundo e volta pra conversa.
- **Ritmo humano, não 1 pergunta/segundo:** começa com as **5 perguntas iniciais**
  (ou mais) que o bot preparou; durante a call, **novas perguntas surgem à medida
  que o candidato fala** sobre quem é. Sem enxurrada.
- Tudo o que aparece + tudo o que é dito vai sendo **guardado na pasta do candidato.**

---

## 4. Depois — o documento para o cliente (o ENTREGÁVEL)

Ao encerrar, o bot gera o **parecer** — é isto que a Filipa encaminha ao cliente:
- Resumo da entrevista + **o que o candidato sabe fazer**, mapeado contra **o que o
  cliente pediu**, com os **trechos que provam**.
- **Editável** pela Filipa antes de enviar; **exportável** (PDF / markdown);
  botão **"preparar email pro cliente"**.
- Fica também **gravado na pasta do candidato** (e ligado à vaga/cliente).

---

## 5. Linguagem — regra dura: a Filipa não é técnica

Nada de jargão cru. O bot **traduz sempre**:
- ❌ *"fit para pleno"* → ✅ *"consegue tocar tarefas sozinho, mas ainda precisa de
  apoio em decisões mais complexas de arquitetura."*
- ❌ *"domina hooks e memoization"* → ✅ *"sabe deixar o site rápido e sem travar."*

Isto vale **em todas as telas e no parecer final.** Se a Filipa não entende, falhámos.

---

## 6. Camada 3 (aprender com o cliente) — como encaixa no headhunting

Realidade da Filipa: o cliente pede *"um dev de site"* e ela vai **direto ao LinkedIn**
buscar a pessoa — **não** recebe 40 CVs nem posta em grupos. Logo a Camada 3 parte
em duas:

- **(a) Aprender com o SIM/NÃO do cliente** — vale **sempre**, mesmo com 1 candidato.
  Cada veredito do cliente ("aprovou", "recusou porquê") **afia o perfil do cliente**
  e a próxima recomendação. Encaixa perfeitamente no headhunting. → **núcleo (a prazo).**
- **(b) Rankear muitos CVs** (triagem em massa) — só faz sentido quando **há volume**
  (empresas nichadas, 10+ candidatos por vaga). → **feature opcional**, não a porta
  de entrada.

> Correção de rota: os docs iniciais tratavam a triagem de 40 CVs como dor #1 / porta
> de entrada. Para a Filipa **não é** — ela caça direto. O centro do MVP é a jornada
> de **UM** candidato: **estudar → entrevistar → parecer → pasta acessível.**

---

## 7. Tech (rascunho — a confirmar na implementação)

| O quê | Como |
|---|---|
| Docs destilados | **Markdown** no storage (Supabase Storage/DB) — legível e portável |
| Memória / chat por entidade | **RAG** (embeddings + busca) sobre a pasta do candidato/cliente |
| Bot de perguntas | **Claude** responde usando só a pasta daquela entidade |
| Export | download **md/pdf**; a Filipa leva pra qualquer LLM se quiser |
| Parecer | gerado por **Claude Opus** (qualidade), editável, exportável |

---

## 8. Como chegam os documentos do cliente → à pasta

> **Problema:** o cliente manda os requisitos via WhatsApp, mensagem particular, ou PDF
> informal. A Filipa não vai copiar-colar tudo numa app — tem de ser natural para ela.

### Canais de ingestão (por prioridade de construção)

**Canal A — Web app (MVP, construir primeiro)**
- Filipa abre a app, cria a vaga, e faz **upload direto** (PDF, Word, imagem) ou **cola o texto** da mensagem do cliente.
- Claude Haiku extrai os requisitos estruturados + pede confirmação: *"Encontrei vaga para dev React pleno. É isto?"*
- Mais atrito que os outros canais, mas simples de construir e valida o fluxo completo.

**Canal B — Telegram forward (MVP+, construir logo a seguir)**
- Felipa recebe requisitos do cliente no WhatsApp/Telegram → encaminha para o nosso **Telegram bot** (@RHCopiloto_bot ou similar).
- O bot deteta o tipo (requisitos de vaga, CV, ou pergunta avulsa), processa com Claude Haiku, e responde: *"Guarda como nova vaga para o cliente [X]?"*
- Se sim: cria a vaga, extrai requisitos, atualiza a pasta do cliente — **tudo automático**.
- A Filipa nunca abre a web app para fazer upload; a ingestão acontece no próprio chat.

**Canal C — WhatsApp direto (Fase 2)**
- Evolution API já corre no VPS (:8080). Um número WhatsApp dedicado recebe os encaminhamentos da Filipa.
- Fluxo idêntico ao Canal B, mas sem sair do WhatsApp.
- Construir só quando o Canal B estiver validado (mesmo fluxo, mais simples tecnicamente).

### O que o bot faz ao receber um documento

```
Documento chega (upload / forward)
        │
        ▼
Claude Haiku: que tipo de documento é?
  ├─ Requisitos de vaga   → extrai estrutura (role, nível, skills, contexto do cliente)
  ├─ CV de candidato      → extrai perfil (nome, experiência, skills declaradas)
  ├─ Feedback do cliente  → extrai veredito (SIM/NÃO + razão) → atualiza RAG do cliente
  └─ Mensagem genérica    → encaminha para Filipa responder manualmente
        │
        ▼
Confirmação com a Filipa: preview do que foi extraído + "guardar assim?"
        │
        ▼
Guarda na pasta certa (vaga / candidato / cliente) + liga as entidades
```

### Garantia anti-erro

- **Nunca guarda silenciosamente.** O bot mostra sempre o que extraiu e pede confirmação antes de gravar.
- **Filipa pode corrigir** o preview antes de confirmar (campo editável).
- Se o documento for ambíguo: bot pergunta ("É para o cliente Empresa X ou Y?") em vez de adivinhar.

### Por que isto importa

Com o Canal B ativo, o fluxo real da Filipa fica:
1. Cliente manda msg no WhatsApp → Filipa encaminha para o bot.
2. Bot processa + confirma.
3. Filipa aceita. Pasta atualizada.
4. Quando chegar a hora da entrevista, tudo já está na app.

Zero copy-paste, zero abertura de outra app, zero trabalho duplicado.
