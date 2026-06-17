# UI / Design — RH Automação

> "Design é tudo." Especialmente aqui: o copiloto roda **enquanto o recrutador
> conversa com um ser humano**. Se a tela rouba atenção, a entrevista piora — e o
> produto vira um estorvo. Cada decisão de UI parte daí.

---

## Princípios de design

1. **Não competir com a conversa.** Durante a entrevista, o recrutador olha o
   candidato, não a tela. A UI precisa ser **lida num relance** (glanceable):
   uma olhada de 1 segundo entrega a próxima pergunta.
2. **Calma, não enxurrada.** A IA pode gerar muita coisa; a tela mostra **uma
   sugestão principal por vez**, não um mural de texto.
3. **Sempre o humano decide.** A IA **sugere**, nunca obriga. Tom de "copiloto",
   não de "chefe". O recrutador aceita, ignora ou edita.
4. **Confiança visível.** Quando a IA afirma algo ("candidato não citou testes"),
   mostrar **de onde tirou** (trecho da fala). Sem caixa-preta.
5. **Hierarquia por cor e tamanho, não por quantidade.** Verde = coberto,
   âmbar = falta investigar, vermelho = red flag. Pouca palavra, muito significado.
6. **Acessível e legível à distância:** fontes grandes, alto contraste — a pessoa
   está a ~60cm da tela e de olho na conversa.

---

## Tom visual (mood)

- **Profissional e tranquilo**, não "ferramenta de hacker" nem "fofo demais".
- Base clara, bastante respiro (espaço em branco), cantos arredondados suaves.
- **Uma cor de marca** (sugestão: um azul/teal sóbrio = confiança) + a escala
  semáforo (verde/âmbar/vermelho) só para status.
- Tipografia: uma sans legível (ex.: Inter). Tamanhos generosos no modo ao vivo.
- **Modo escuro** para o copiloto ao vivo (menos cansativo em call longa).

---

## Mapa de telas

```
Login → Dashboard (pipeline)
            ├── Vaga (criar/editar requisitos)
            ├── Triagem de candidatos (ranking de CVs)
            ├── Candidato (perfil + CV destrinchado)
            ├── Briefing pré-entrevista (roteiro)
            ├── ⭐ Copiloto ao vivo (durante a entrevista)
            └── Relatório pós-entrevista (resumo + score + feedback)
```

---

## Tela 1 — Dashboard / Pipeline

O "QG" do recrutador. Visão de funil por vaga (kanban):
`Novos → Triados → Entrevistar → Entrevistados → Enviados ao cliente`.
- Cartão de candidato mostra: nome, vaga, match % e o próximo passo.
- Topo: "Suas entrevistas de hoje" com botão grande **▶ Entrar no Copiloto**.

## Tela 2 — Vaga (requisitos)

Onde a vaga da empresa-cliente vira dado estruturado.
- Campos: cargo, senioridade, **stack/skills (chips)**, anos de experiência,
  idioma, faixa salarial, must-have vs nice-to-have.
- Atalho: **colar a descrição crua do cliente** e a IA pré-preenche os campos
  (resolve a dor #6 — pedido vago vira requisito).

## Tela 3 — Triagem (ranking de CVs)

Resolve a dor #1. Lista de candidatos **ordenada por match**, cada linha com:
- match % + barra; chips verdes (requisitos atendidos) e cinzas (faltantes);
- 1 linha de resumo ("8 anos React, sem inglês comprovado");
- ações rápidas: ✓ avançar / ✗ descartar / 👁 ver perfil.
- Filtro no topo; o recrutador processa 40 CVs em minutos, não horas.

## Tela 4 — Candidato

CV "destrinchado": experiências, skills, formação — e os **gaps** vs a vaga
destacados. Linha do tempo da relação (e-mails, entrevistas, status).

## Tela 5 — Briefing pré-entrevista (o roteiro)

Resolve a dor #4. Antes da call, uma página enxuta:
- Resumo do candidato vs vaga (o que confirmar, o que investigar).
- **Roteiro de perguntas** agrupado (técnicas / comportamentais / sobre o CV),
  cada uma com "o que é uma boa resposta" recolhível.
- Botão **▶ Iniciar entrevista** → abre o Copiloto já carregado com esse roteiro.

---

## ⭐ Tela 6 — Copiloto ao vivo (o coração)

Esta é a tela que decide se o produto é amado ou abandonado.

### Layout (barra lateral / segunda tela, ~360px)
Pensada para ficar **ao lado** da janela do Meet/Zoom/Teams, ou em segundo
monitor / tablet / celular no presencial. Não cobre o rosto do candidato.

```
┌───────────────────────────────┐
│ 🔴 Entrevista — Frontend Sr    │  ← contexto + cronômetro
│ João Silva · 12:34             │
├───────────────────────────────┤
│ PRÓXIMA PERGUNTA               │  ← 1 sugestão grande, fonte alta
│ "Você falou em React há 5      │
│  anos — como lida com          │
│  performance em listas         │
│  grandes?"                     │
│ 💡 porquê: afirmação rasa num  │  ← o PORQUÊ, 1 frase (sempre)
│    must-have; falta prova      │
│        [ Usei ]  [ Pular ]     │
├───────────────────────────────┤
│ na fila (toque p/ ver)         │  ← sugestões secundárias, discretas
│ · Testes automatizados?        │
│ · Experiência com TypeScript?  │
├───────────────────────────────┤
│ ESTADO DOS REQUISITOS          │  ← frame de avaliação, glanceable
│ ✅ React (prova 12:03)         │     ✅ coberto-com-prova
│ 🟡 5+ anos (raso)              │     🟡 raso (mencionado, sem prova)
│ ⬜ Inglês   ⬜ Liderança       │     ⬜ não-tocado
│ ⚠ Testes (contradiz CV)       │     ⚠ contradito
└───────────────────────────────┘
```

> **Os 4 estados** vêm direto do frame de avaliação da Camada B
> (`ARQUITETURA-TEMPO-REAL.md §9`): `não-tocado` ⬜ · `raso` 🟡 · `coberto-com-prova`
> ✅ (mostra o timestamp da prova) · `contradito` ⚠. O semáforo é a UI dessa máquina
> de estados — a Filipa lê o estado real, não um "sim/não" achado.

### Comportamentos-chave
- **Uma pergunta em destaque por vez.** As outras ficam numa fila discreta.
- A sugestão **reage à conversa**: quando o tópico é coberto, vira ✅ e some da
  fila sozinha — o recrutador não precisa gerenciar nada.
- **Toques únicos:** "Usei" (registra que perguntou) / "Pular". Nada de digitar.
- **Marcar momento:** um botão "★" salva o instante atual pro relatório
  ("revisitar essa resposta depois").
- **Transcrição opcional**, escondida por padrão (atrás de uma aba). O default é
  o mínimo: pergunta + checklist.
- **Indicador de gravação/consentimento** sempre visível (🔴) — exigência de LGPD
  vira também um elemento de confiança na tela.
- **Silêncio é uma feature:** se está tudo coberto, a tela fica calma e diz
  "✅ no caminho — siga a conversa". Não inventar pergunta só pra preencher. O
  limiar de silêncio respeita momentos sensíveis (não interrompe rapport/motivação).
- **Cada sugestão traz o PORQUÊ** numa frase (qual degrau da escada de prioridade a
  fez subir — `ARQUITETURA-TEMPO-REAL.md §9`). A Filipa decide com o motivo à vista.
- **Rede de segurança no fim:** ao sinalizar "a fechar" (ou perto do tempo), a tela
  levanta os **must-have ainda por cobrir** — *"Antes de terminar: falta confirmar
  Inglês e Liderança."* É o seguro contra o "esqueci-me de perguntar".

### Anti-padrões a evitar
- ❌ Parede de texto rolando (a transcrição inteira na cara).
- ❌ Pop-ups que piscam no meio da fala.
- ❌ Mais de ~3 itens "exigindo ação" ao mesmo tempo.
- ❌ Som/notificação sonora (atrapalha a call).

---

## Tela 7 — Relatório pós-entrevista (duas versões)

Resolve as dores #3, #7, #8. Gerado automaticamente ao encerrar. **Spec completa em
`RELATORIO-CLIENTE.md`.** Pontos de UI:

- **Duas abas no topo:** **`Interna`** (leitura rápida da Filipa) e **`Cliente`**
  (versão polida, 1 clique). A mesma fonte (frame da Camada B), duas renderizações.
- **Estruturado critério-a-critério** contra os **critérios do cliente**: cada um
  responde com **citação + timestamp** (clicável → abre o trecho na Camada A).
- Se um critério do cliente **não foi coberto**, o relatório **assinala sozinho**:
  *"⬜ não confirmado — recomendo perguntar."* (não finge que está respondido).
- Forças na **linguagem do cliente** · riscos + o que sondar · **logística**
  (salário/aviso/disponibilidade/contraproposta) · **ângulo de venda** · fontes.
- **Editável** antes de enviar · **export** md/pdf · botão **"preparar email pro
  cliente"** · momentos marcados com ★ · 1 clique pra **atualizar o pipeline**.

## Tela 8 — Pergunta ao bot (Q&A por candidato/cliente)

A Filipa fala **como com um colega**; o bot responde por RAG sobre a transcrição
completa (Camada A) + factos, **na linguagem dela** e **com a fonte**.

```
┌───────────────────────────────────────────┐
│ 💬 Perguntar sobre: João Silva  ▾          │  ← escolhe a entidade (candidato/cliente)
├───────────────────────────────────────────┤
│ Filipa: ele aguenta liderar ou é executor? │
│                                            │
│ Bot: Mais executor com pendor p/ liderar — │
│  "organizou as tarefas do trio e fez a     │
│  ponte com o cliente" (34:12). Coordenação │
│  informal, não gestão formal. Se o cliente │
│  quer líder a sério, vale confirmar.       │
│                         [ ▸ ouvir 34:12 ]  │
└───────────────────────────────────────────┘
```

- **Bilingue:** traduz a pergunta coloquial → significado técnico → resposta em
  linguagem de recrutador. A Filipa nunca tem de "falar técnico".
- **Segundo travão ao ping-pong:** cliente manda pergunta nova → a Filipa pergunta
  aqui primeiro. Se está na transcrição, resposta na hora, **sem recontactar o
  candidato**. Só se faltar é que vira "a confirmar".
- Tom de copiloto: se não sabe, **diz que não sabe** ("não foi falado na entrevista")
  em vez de inventar.

---

## Decisões de design em aberto

- [ ] **Formato do copiloto ao vivo:** barra lateral na web, app separado no
      celular, ou extensão de navegador? (provável: começar como web em janela
      estreita / segundo monitor)
- [ ] **Idioma da interface:** PT-BR apenas no início?
- [ ] **Marca/nome e paleta final** (azul-teal é só ponto de partida).
- [ ] **Quanto a IA "fala" sozinha** durante a call vs só quando solicitada.

---

## Resumo

O produto é uma jornada — **Triagem → Briefing → Copiloto ao vivo → Relatório** —
amarrada por um design que, no momento mais crítico (a entrevista), **some de
cena**: entrega a próxima pergunta num relance e deixa o recrutador fazer o que
máquina nenhuma faz, que é conversar com gente.
