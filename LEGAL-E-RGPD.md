# Legal & RGPD — o que falta decidir antes de gravar/vender pessoas reais

> **Gap encontrado na auditoria (2026-06-18):** toda a spec técnica é forte, mas a
> camada **legal/RGPD estava AUSENTE** (zero menção a consentimento do candidato,
> controlador/subcontratante, DPA, retenção concreta, IP do produto vendido). Isto
> **não é "depois"** — parte é **pré-requisito do próprio piloto** com dados reais da
> Filipa. Este doc nomeia as decisões; várias são do **Mateus/jurídico**, não minhas.

> ⚠️ **Não sou advogado.** O que segue é o enquadramento de engenharia + propostas de
> default. As decisões marcadas 🟦 precisam de validação humana/jurídica.

---

## 1. 🔴 Quem é o Controlador vs Subcontratante (por fase) + DPA

O produto processa **dados pessoais sensíveis** (gravações de voz, entrevistas que
revelam saúde/família/etc.; a Camada A guarda *tudo*). Falta definir o papel RGPD:

| Fase | Quem hospeda | Controlador | Subcontratante | Precisa |
|---|---|---|---|---|
| 1 — connosco | CMTec | **a agência (IRIS)** | **CMTec** | **Contrato de Subcontratação (Art. 28)** entre CMTec e IRIS |
| 2 — VPS do comprador | comprador | comprador | (CMTec sai) | DPA dissolve-se; comprador assume tudo |

- 🔴 **Bloqueador do piloto:** sem o **DPA Art. 28** (CMTec = subcontratante da IRIS) não
  há base legal para a CMTec sequer correr o piloto com dados reais. **Criar antes de
  ligar a Filipa a dados reais.** 🟦 Mateus/jurídico.

---

## 2. 🔴 Consentimento do candidato (ele nunca entra na app)

A decisão "consentimento é manual da Filipa, fora da app" + "o bot é visível como
transcritor" **não basta** sozinha:
- "Bot visível" prova **gravação**, não prova **avaliação automatizada por IA** (RGPD
  Art. 22 — decisão individual automatizada).
- Falta: **base legal** (interesse legítimo vs consentimento), **prova** (quando/como
  consentiu), e o **caminho do "recusou"**.

**Proposta (🟦 a validar):**
- **Texto-modelo** de aviso que a Filipa envia ao candidato antes da call (gravação +
  IA assistiva + direitos).
- **Registo no sistema:** `process.consent_status` (`pendente|dado|recusado`) +
  `consent_evidence_ref` (link/print/data) + `consent_at`. (Schema novo — ver §6.)
- **Caminho "recusou":** o produto **tem de suportar entrevista SEM o bot/captura** (a
  Filipa entrevista normal; sem copiloto ao vivo). Não pode ser um beco.
- **Escapar ao Art. 22:** deixar **escrito e no produto** que o juízo é **assistivo — a
  Filipa decide sempre** (já é a filosofia; aqui vira também salvaguarda legal).

---

## 3. 🔴 Reutilização de factos entre clientes — precisa de cláusula

Tecnicamente decidido (candidato global, sem `visibility_scope`). Mas RGPD: a
**finalidade** com que se recolheu para o Cliente X não cobre o Cliente Y (Art. 5,
limitação de finalidade). Dizer "é responsabilidade da Filipa" só protege a CMTec se
estiver **no contrato**: **a agência é a Controladora e assume a reutilização
cross-cliente.** 🟦 cláusula no contrato de venda/piloto.

---

## 4. 🔴 Segurança da transferência de dados na migração (entre hosts)

O runbook (`INFRA-E-MIGRACAO`) é forte em determinismo, mas **não protege o transporte**
dos dados pessoais (`rh_dump.sql.gz`, `storage.tar.gz` com CVs/áudios, `face_templates`
= dado biométrico). Fixar:
- **Cifrar o bundle** (estender o sops+age, já usado no `.env`, ao dump+storage) —
  cifrado em trânsito **e** em repouso durante o salto.
- **Prazo de purga da origem:** o §4 do runbook diz "não apagar a origem antes da janela
  de fallback" → mas falta **um prazo** (ex.: purga da nossa cópia **N dias** após
  cutover confirmado). Dados pessoais da agência **não podem ficar indefinidamente** na
  nossa infra após a venda. 🟦 definir N.
- **Cadeia de custódia:** quem transporta e quem assina a entrega.

---

## 5. 🟠 Tabela de retenção (números concretos — falta)

"Curta para pessoal, durável para profissional" é intenção, não política. O cron de
hard-delete depende de `retain_until`/`purge_after` que **ninguém preencheu com dias**.
**Proposta (🟦 a validar com jurídico):**

| Dado | Retenção proposta |
|---|---|
| Áudio cru / transcrição crua (`transcript_chunk`) | **30 dias** após a entrevista |
| Factos `personal` (`usar_no_score=FALSE`) | **90 dias** |
| Factos `professional` (perfil do candidato) | enquanto candidato ativo no pool + **N anos** |
| `face_templates` (biometria) | enquanto a utilizadora estiver **ativa** + 30 dias |
| Soft-delete → hard-delete (`purge_after`) | **30 dias** de janela de recuperação |

---

## 6. Schema/produto a acrescentar (suporta o acima)
```sql
ALTER TABLE process ADD COLUMN consent_status TEXT NOT NULL DEFAULT 'pendente'; -- pendente|dado|recusado
ALTER TABLE process ADD COLUMN consent_evidence_ref TEXT;
ALTER TABLE process ADD COLUMN consent_at TIMESTAMPTZ;
-- caminho "sem captura": interview.capture_type ganha 'none' (entrevista sem bot, candidato recusou)
```
> ⚠️ Regra de produto: **se `consent_status != 'dado'`, o copiloto ao vivo NÃO arranca a
> captura** — a Filipa entrevista sem o bot. Vira critério de aceitação (`TESTES`).

---

## 7. 🟠 IP, licenciamento, code-signing e responsabilidade do produto vendido

Decidimos "instância independente, vendorizada, sem cordão umbilical" (técnico ✅). Falta
o legal (🟦 Mateus/jurídico):
- **IP/licença:** a CMTec **retém o IP e licencia**, ou **vende outright**? (muda tudo).
- **Code-signing (`APP-DESKTOP D6`):** o instalador assina em nome de **quem**? Assinar
  com cert CMTec faz-nos aparecer como autores de software que já não controlamos →
  risco se o comprador o adulterar. Provável: comprador assina com o cert dele.
- **Responsabilidade pelo output:** um parecer errado leva a agência a recomendar mal →
  **cláusula de limitação de responsabilidade** (o juízo é assistivo, a recrutadora
  decide). Liga ao Art. 22 (§2).

---

## 8. 🟠 Apify / sourcing — ToS e tokens

Trocar browser-automation por Apify tirou-nos do território cinzento, **mas** o Apify a
fazer scraping do LinkedIn **continua a violar o ToS do LinkedIn** (só muda quem o faz).
E os "5 tokens Apify" são **nossos** → vender uma instância que depende deles **contradiz
o "sem cordão umbilical"** e expõe a nossa conta.
- **Fix:** ao vender, o comprador traz a **sua própria conta/tokens Apify**; e fica
  escrito que o sourcing (e o seu ToS) é **responsabilidade dele**. Na fase piloto
  (connosco) usamos os nossos com parcimónia. 🟦 nota no contrato.

---

## 9. 🟠 Anti-spoof da biometria — gate antes de vender

O anti-spoof passivo está **DESLIGADO** (`AUTENTICACAO §6 C2`), aceitável "para 1
utilizadora de confiança na v1". **Mas isto é um produto para vender** — o 1º comprador
pode ter **>1 recrutador** ou um não-confiável, e aí uma **foto/vídeo destrava o login**.
- 🔴→🟠 **Gate explícito:** o anti-spoof tem de estar **ON antes de qualquer deployment
  com >1 utilizador OU venda externa** — não só "antes da v2". (Atualizar `AUTENTICACAO`.)

---

## 10. Resumo — o que é decisão do Mateus/jurídico vs engenharia

| # | Item | Tipo | Quando |
|---|---|---|---|
| 1 | DPA Art. 28 (CMTec=subcontratante IRIS) | 🟦 jurídico | **antes do piloto com dados reais** |
| 2 | Consentimento candidato (texto+prova+recusa+Art.22) | 🟦 jurídico + 🛠️ schema | antes de gravar alguém |
| 3 | Cláusula reutilização cross-cliente | 🟦 contrato | antes da venda |
| 4 | Cifra+purga na migração | 🛠️ engenharia + 🟦 prazo | antes da 1ª migração |
| 5 | Tabela de retenção (dias) | 🟦 jurídico | antes do cron de purga |
| 7 | IP/licença/code-signing/responsabilidade | 🟦 jurídico | antes da venda |
| 8 | Apify: tokens do comprador + ToS | 🟦 contrato | antes da venda |
| 9 | Anti-spoof ON antes de venda/>1 user | 🛠️ engenharia | antes de vender |

> **Nada disto bloqueia continuar a SPEC.** Mas os 🔴 (#1–#4) **bloqueiam pôr dados reais
> de uma pessoa** (o teste com a Filipa) e **bloqueiam vender**. São decisões a tomar
> antes da Fase 3 entregar, não antes de a planear.
