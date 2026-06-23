# Telegram Bot — Especificação Completa de Conversas

> **Contexto (2026-06-16):** o Canal B (Telegram forward) é a forma mais natural
> de a Filipa encaminhar documentos e mensagens dos clientes sem abrir outra app.
> Este documento especifica os fluxos exatos de conversa, os commands e a
> integração com a web app — tudo o que é preciso para construir sem adivinhar.

---

## 1. O problema central que este bot resolve

O cliente manda à Filipa, no WhatsApp particular dela, a descrição da vaga, um áudio
a dizer "ah, e esqueci de mencionar que precisa de inglês avançado", ou um PDF de
requisitos. Hoje isso fica na cabeça dela ou perde-se no chat. Com o bot:

```
Cliente → WhatsApp da Filipa → Filipa encaminha para @VeraBot → memória atualizada
```

Mas há um problema que tem de ser resolvido: **quando Filipa encaminha, o bot não
sabe de qual cliente veio a mensagem.** O Telegram não preserva a identidade do
remetente original num forward. A solução está na secção §4.

---

## 2. Setup — ligar a conta da Filipa ao bot (1× por recrutadora)

Antes de usar o bot, Filipa precisa de ligar o seu Telegram à sua conta na web app.

```
Filipa: /start
Bot: "Olá! Sou o copiloto de RH da [agência].
      Para começar, vai à web app → Perfil → Telegram
      e copia o código de ligação que aparece lá.
      Manda-me esse código aqui."

Filipa: RH-A3B7-X9K2

Bot: "✅ Perfeito, Filipa! Conta ligada com sucesso.
      Já podes encaminhar documentos e mensagens dos teus
      clientes diretamente aqui. Manda /ajuda para ver
      o que faço."
```

**O que acontece nos bastidores:**
- A web app gera um código temporário (TTL 10 min, 1 uso) ligado ao `recruiter_id`.
- Quando o bot recebe o código, faz POST `POST /api/bot/register` com `{telegram_chat_id, code}`.
- O servidor valida, guarda `telegram_chat_id` no registo `recruiter` e devolve `recruiter_id`.
- A partir daí, o bot sabe quem é a Filipa por `telegram_chat_id`.

---

## 3. Commands disponíveis

| Command | O que faz |
|---|---|
| `/start` | Inicia o setup (liga conta) |
| `/vagas` | Lista vagas ativas com status resumido |
| `/nova_vaga [cliente]` | Abre sessão de criação de vaga nova |
| `/fechar_vaga` | Fecha a sessão de criação e mostra o resumo para confirmação |
| `/clientes` | Lista clientes da agência |
| `/ajuda` | Mostra esta lista |
| `/cancelar` | Cancela a operação atual (sessão de vaga, etc.) |

---

## 4. O problema de identificação do cliente — como é resolvido

Quando Filipa encaminha uma mensagem, o bot não sabe de qual cliente veio.
A solução usa **contexto de sessão** (30 min) + **seleção por botão**:

### Regra 1 — se Filipa tem exatamente 1 vaga ativa: assume e confirma
```
Bot: "Recebi uma mensagem! Parece ser sobre a vaga [Dev React - TechCorp].
      É para esta vaga?"
      [✅ Sim] [❌ Outra vaga]
```

### Regra 2 — se Filipa tem 2+ vagas ativas: pede seleção imediata
```
Bot: "Recebi uma mensagem. Para que vaga/cliente é este conteúdo?"
      [Dev React - TechCorp]
      [UX Designer - Startup Y]
      [Outro / nova vaga]
```

### Regra 3 — contexto de sessão (30 min)
Depois de Filipa selecionar uma vaga, o bot mantém esse contexto por 30 min.
Se ela encaminhar mais mensagens dentro desse período, o bot pergunta:
```
Bot: "Continua a ser para [Dev React - TechCorp]?"
      [✅ Sim] [❌ Outra]
```
Isto elimina a fricção quando o cliente manda vários áudios/mensagens seguidos.

---

## 5. Fluxo A — encaminhar requisitos de vaga (texto ou PDF)

```
[1] Filipa encaminha mensagem de texto ou PDF

[2] Bot: "Recebi! Para que vaga/cliente é este conteúdo?"
    [botões das vagas ativas] [Nova vaga]

[3] Filipa seleciona vaga

[4] Bot processa (Claude Haiku extrai):
    "Analisando... ⏳"

[5] Bot apresenta o que entendeu:
    "Entendi os seguintes requisitos:
    ✅ React pleno (obrigatório)
    ✅ Inglês intermediário (preferência)
    ✅ Remoto 100% (obrigatório)
    ⚠️ Salário: não mencionado

    Estes requisitos vão ser adicionados à vaga
    [Dev React - TechCorp].
    
    Está correto?"
    [✅ Confirmar] [✏️ Editar] [❌ Cancelar]

[6a] Filipa confirma → bot grava na DB
    Bot: "✅ Guardado! Os requisitos da vaga foram atualizados.
         Ver na web app → [link direto]"

[6b] Filipa edita → bot: "Manda o que quiseres corrigir em texto."
    Filipa: "o inglês é obrigatório, não preferência"
    Bot atualiza e volta ao passo [5]

[6c] Filipa cancela → bot: "Ok, nada foi guardado."
```

---

## 6. Fluxo B — mensagem de voz (áudio do cliente)

Caso muito frequente: o cliente manda um áudio de WhatsApp para a Filipa, ela encaminha.

```
[1] Filipa encaminha áudio (ex: 0:45s)

[2] Bot: "Recebi um áudio (0:45). Estou a transcrever... ⏳"

[3] Bot transcreve com Soniox (via VPS) em ~5–10s

[4] Bot mostra a transcrição + extração:
    "Transcrição:
    'Ah, e esqueci de dizer, a pessoa tem que ter experiência
    com gestão de equipas pequenas, mesmo que seja de 2 ou 3
    pessoas, e prefiro alguém de Lisboa ou Porto.'

    Entendi:
    ✅ Experiência em liderança de equipa pequena (obrigatório)
    ✅ Localização Lisboa ou Porto (preferência)

    Para que vaga/cliente é este áudio?"
    [botões das vagas ativas]

[5] → continua igual ao Fluxo A a partir do passo [3]
```

**Stack para transcrição de áudio:**
- O Telegram bot descarrega o ficheiro de áudio (`.ogg` por default).
- POST para VPS `/api/bot/transcribe` com o ficheiro → Soniox transcreve → texto devolvido.
- O mesmo Soniox que usamos para as entrevistas ao vivo; sem nova infra.

---

## 7. Fluxo C — sessão de vaga nova (multi-mensagem)

Quando o cliente ainda não existe ou a vaga ainda não existe, a Filipa cria uma nova.

```
[1] Filipa: /nova_vaga TechCorp
    (ou apenas /nova_vaga e o bot pergunta o cliente)

[2] Bot: "A criar vaga nova para TechCorp.
          Manda as informações — pode ser várias mensagens,
          PDFs, imagens ou áudios. Quando acabares, manda /fechar_vaga
          ou "terminei"."

[3] Filipa envia mensagem 1
    Bot: "✅ Recebido (1/n)"

[4] Filipa envia áudio
    Bot: "Transcrevendo... ✅ Recebido (2/n)"

[5] Filipa envia PDF
    Bot: "✅ PDF recebido (3/n)"

[6] Filipa: "terminei"
    Bot processa tudo em conjunto com Claude Haiku

[7] Bot apresenta resumo consolidado:
    "Aqui está o que recolhi para a nova vaga:

    Vaga: Dev Frontend React Pleno
    Cliente: TechCorp
    Requisitos:
    • React pleno - 3+ anos (obrigatório)
    • Inglês avançado (obrigatório)
    • Equipa pequena liderada (obrigatório)
    • Localização Lisboa/Porto (preferência)
    • Remoto 100% (obrigatório)
    Salário: não mencionado

    Criar esta vaga?"
    [✅ Criar] [✏️ Corrigir algo] [❌ Cancelar]

[8] Filipa confirma → bot cria vaga na DB + cria cliente se necessário
    Bot: "✅ Vaga criada!
         Ver na web app → [link direto]
         O Role Profile (o que é um bom candidato para este role)
         está a ser preparado em segundo plano. 🔍"
```

---

## 8. Fluxo D — encaminhar CV de candidato

```
[1] Filipa encaminha PDF de CV

[2] Bot deteta que é um CV (Claude Haiku classifica):
    "Parece ser um CV! Para que vaga é este candidato?"
    [botões das vagas ativas]

[3] Filipa seleciona vaga

[4] Bot extrai perfil:
    "Extraí este perfil:
    Nome: Pedro Silva
    Experiência: 5 anos React, 3 anos Node.js
    LinkedIn: não encontrado no CV
    Formação: Eng. Informática FEUP 2019

    Criar candidato para [Dev React - TechCorp]?"
    [✅ Criar] [✏️ Corrigir] [❌ Cancelar]

[5] Confirmado → candidato criado na DB
    Bot: "✅ Pedro Silva adicionado à vaga!
         Ver análise completa na web app → [link direto]
         A análise de match com a vaga vai estar pronta em ~30s. ⏳"
```

---

## 9. Fluxo E — atualização de característica pontual

O cliente manda "ah, e também tem de saber inglês" depois da vaga já estar criada.

```
[1] Filipa encaminha a mensagem

[2] Bot identifica que é um requisito novo (não uma vaga completa):
    "Novo requisito detetado para [Dev React - TechCorp]:
    '+ inglês avançado (obrigatório)'

    Adicionar ao que já temos?"
    [✅ Adicionar] [✏️ Editar] [❌ Ignorar]

[3] Confirmado → bot atualiza `client_memory_fact` com proveniência
    Bot: "✅ Requisito adicionado! A vaga foi atualizada."
```

---

## 10. Consultas rápidas (sem web app)

```
Filipa: "o que tenho sobre a TechCorp?"
Bot: "TechCorp:
     📋 2 vagas ativas: Dev React, UX Designer
     🎯 Valoriza: liderança de equipa, inglês avançado, remoto
     ✅ Aprovaram 2 candidatos | ❌ Rejeitaram 1 (fit cultural)
     Última atividade: hoje 14:23"

Filipa: "quem são os candidatos para a vaga de React?"
Bot: "Dev React - TechCorp:
     👤 Pedro Silva — match 87% — entrevista agendada
     👤 Ana Costa — match 72% — aguarda briefing
     👤 João Matos — rejeitado na triagem (fit 45%)"
```

---

## 11. Estados de erro e edge cases

| Situação | O que o bot faz |
|---|---|
| Filipa não está registada | "Para usar o bot, liga a tua conta primeiro. Vai à web app → Perfil → Telegram." |
| Nenhuma vaga ativa | "Ainda não tens vagas ativas. Abre a web app para criar a primeira!" |
| Extração falha (Claude retorna erro) | "Não consegui perceber bem o conteúdo. Podes enviá-lo diretamente na web app para mais controlo." |
| Ficheiro demasiado grande (>20MB) | "Ficheiro demasiado grande para o Telegram. Sobe-o diretamente na web app." |
| Sessão expirada (30 min sem atividade) | "A sessão anterior expirou. Qual vaga estás a trabalhar agora?" [botões] |
| Mensagem ambígua (não é vaga, CV, ou requisito) | "Não percebi o tipo de conteúdo. É: (A) requisitos de vaga / (B) CV de candidato / (C) feedback do cliente / (D) outra coisa?" |

---

## 12. API endpoints que o Next.js precisa expor (para o bot)

O bot Telegram é um serviço Node.js separado (VPS) que chama a API do Next.js:

| Endpoint | Method | Descrição |
|---|---|---|
| `/api/bot/register` | POST | Liga telegram_chat_id a recruiter via código |
| `/api/bot/intake` | POST | Processa mensagem/ficheiro encaminhado, devolve extração |
| `/api/bot/confirm-intake` | POST | Confirma extração e grava na DB |
| `/api/bot/transcribe` | POST | Transcreve áudio via Soniox |
| `/api/bot/context` | GET | Devolve contexto da Filipa (vagas ativas, cliente atual) |
| `/api/bot/create-job` | POST | Cria vaga nova após confirmação |
| `/api/bot/create-candidate` | POST | Cria candidato após confirmação |
| `/api/bot/query` | POST | Responde a pergunta em linguagem natural sobre os dados |

**Autenticação:** cada request do bot inclui um `X-Bot-Secret` header (env var partilhado entre bot e Next.js). O bot não usa auth de utilizador — o `telegram_chat_id` é resolvido para `recruiter_id` no middleware da API.

---

## 13. Integração com o PLANO-CONSTRUCAO.md

O Canal B (Telegram bot) corresponde ao **P4.1** do plano de construção e só começa
depois de **P1.1** (criar vaga via web app) estar funcional. A ordem:

1. P1.1 funcional → web app já tem vagas + clientes na DB
2. P0.2 (RLS multi-tenant) garante que o bot não acede dados de outras agências
3. P4.1: registar bot no BotFather, subir serviço Node.js na VPS, implementar flows A→E
4. Testar com a Filipa em ≥3 documentos reais antes de avançar para Canal C (WhatsApp)

**Garantia do P4.1:** documento chega via Telegram, é extraído, e aparece na vaga
correta na web app — sem Filipa ter de abrir a web app para fazer upload.

---

## 14. Tech stack do bot

| Componente | Escolha | Razão |
|---|---|---|
| Biblioteca Telegram | `grammy` (TypeScript) | Moderno, bem mantido, bom suporte a middleware |
| Hosting | VPS CMTec (processo Node.js, PM2) | Telegram requer webhook HTTPS; VPS já tem nginx + TLS |
| Transcrição de áudio | Soniox via VPS (reutilizando cmtec-voice-platform) | Zero infra nova |
| Extração de texto | Claude Haiku via Next.js API | Barato + consistente com o resto |
| Sessões de conversa | Redis (já corre na VPS :6379) | TTL nativo, sem tabela extra |
| Identificação de contexto | Redis key `bot:session:{chat_id}` TTL 30min | Simples e descartável |
