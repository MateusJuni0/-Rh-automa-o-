# A visão na voz da Filipa (north star)

> Este é o documento que mantém todos honestos. Se uma feature não ajuda a Filipa,
> não entra. Escrito na linguagem do problema real, com nomes — não em abstrato.

---

## Os três lados

- **Filipa** — recrutadora da agência. É **ela** quem usa o produto.
- **O cliente da Filipa** — a empresa que precisa de contratar (ex.: quer um dev
  frontend). Manda à Filipa os requisitos e espera dela um parecer confiável.
- **O candidato** — a pessoa entrevistada.

> O produto serve a Filipa. Mas o **norte** dela é deixar o **cliente** feliz com a
> informação que ela entrega sobre o candidato. Por isso o produto tem de **pensar
> como o cliente**, não só como um avaliador técnico genérico.

---

## A dor da Filipa (nas palavras dela)

1. **"Tenho de estudar a vaga e o cliente antes de cada entrevista."** Ela recebe a
   vaga e o CV, e perde tempo a perceber a tecnologia e o que o cliente realmente
   quer, muitas vezes sobre um assunto que ela não domina.
2. **"Durante, tenho de ouvir, avaliar e anotar ao mesmo tempo"** — e esquece-se
   sempre de perguntar alguma coisa.
3. **"Depois, tenho de dizer ao cliente se a pessoa serve"** — e justificar.

---

## A ideia, afinada

Um **copiloto ao vivo** que a Filipa liga antes da entrevista e que fica a trabalhar
**ao lado dela durante toda a conversa** (mesmo que dure 2h):

### Antes — ele estuda por ela
A Filipa dá ao bot **dois ficheiros + o CV**:
- **o que o cliente precisa** (requisitos da vaga, na forma crua que o cliente mandou);
- **o que o colaborador vai fazer** (descrição da função / contexto do cliente);
- **o CV do candidato**.

O bot **estuda tudo** e prepara o terreno: o que confirmar, os gaps do CV, e —
crucialmente — **o que este cliente em particular vai querer saber**.

### Durante — ele ouve, separa e pensa em tempo real
- Transcreve sozinho, **separando quem fala** (Filipa vs candidato), ao vivo.
- Analisa a conversa enquanto acontece e **sugere à Filipa as perguntas certas**, em
  três lentes:
  1. **Técnica/da vaga** — confirma se o candidato sabe o que a vaga exige.
  2. **🟢 Lente do cliente** — *"o cliente vai querer saber se ele já liderou um
     time; pergunta isso."* As perguntas que o **cliente dela** faria se estivesse
     na call. **É isto que faz a Filipa entregar um parecer que impressiona.**
  3. **Gaps do CV** — investiga o que está vago ou inconsistente.
- A Filipa só conversa; o copiloto marca o que já foi coberto e cutuca o que falta.

### Depois — ele dá-lhe o parecer pronto para o cliente
Resumo + o que o candidato é **capaz de fazer**, mapeado contra o que o **cliente**
pediu, com os trechos que provam. A Filipa revê e manda ao cliente.

---

## Em uma frase
> "A Filipa não estuda, não divide a atenção e não escreve relatório. O copiloto
> estuda a vaga e o cliente por ela, ouve a entrevista inteira, sugere as perguntas
> que **o cliente dela** quereria fazer, e entrega o parecer pronto. Ela faz só o
> que máquina nenhuma faz: conversar e decidir."

---

## Como guardamos o que foi dito — memória por candidato (RAG)

A transcrição **não** é guardada como um bloco de 2h de texto. É **destilada e
organizada como memória do candidato** (estilo RAG):
- partida em factos/afirmações com timestamp e falante;
- indexada por **competência** e por **requisito da vaga**;
- recuperável depois: *"o que é que o João disse sobre testes?"* → trecho exato.

Isto serve três coisas: alimenta o relatório com evidência, mantém o custo do tempo
real constante (ver `ARQUITETURA-TEMPO-REAL.md §2, andar 3`), e faz cada candidato
acumular um perfil reutilizável noutras vagas.

---

## Banco de candidatos — complemento, não o centro

Guardar os CVs e os perfis num **banco** faz sentido e fica no produto (é "construir
algo completo, não simples e chato"). Mas é **complemento**: o centro é o copiloto da
entrevista. O banco ganha valor sozinho à medida que cada candidato entrevistado
deixa a sua memória RAG — uma vaga futura reaproveita quem já conhecemos.

---

## O que isto adiciona aos outros docs
- `UI-DESIGN.md` Tela 6 (copiloto ao vivo): as sugestões passam a ter **3 lentes**,
  com destaque visual para a **lente do cliente**.
- `ARQUITETURA-TEMPO-REAL.md` andar 3: o "estado vivo" inclui os **requisitos do
  cliente** e gera perguntas na perspetiva do cliente; a memória é **persistente
  por candidato**, não só um buffer da sessão.
