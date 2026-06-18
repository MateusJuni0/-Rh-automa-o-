# Legal & RGPD — responsabilidade da AGÊNCIA; nós damos a ferramenta

> **Postura LOCKED (Mateus, 2026-06-18):** **o RGPD é 100% responsabilidade da agência
> (a Filipa), NADA nosso.** A CMTec **fornece a ferramenta**; os dados são da agência;
> as decisões legais (base legal, consentimento, retenção, apagamento) são **dela**.
> Este doc NÃO nos põe obrigações de compliance — só (a) garante **uma cláusula
> contratual** que deixa isso claro, e (b) lista o que o **produto oferece** para que
> ela consiga cumprir se quiser.

> ⚠️ Não sou advogado. O abaixo é enquadramento de produto, não aconselhamento jurídico.

---

## 1. Quem é responsável — a AGÊNCIA, ponto final

- **A agência (Filipa) é a Controladora dos dados** e **assume toda a responsabilidade
  RGPD**: base legal, consentimento dos candidatos, retenção, apagamento, direitos dos
  titulares. **A CMTec é só o fornecedor da ferramenta.**
- **Única coisa do nosso lado:** **uma cláusula** no contrato de uso/venda a dizer
  exatamente isto — *"a agência é a Controladora e a única responsável pelo cumprimento
  do RGPD; a CMTec fornece o software e não responde pelo uso que a agência faz dos
  dados."* 🟦 Mateus mete isto no contrato. **Não criamos DPA pesado nem obrigações de
  subcontratante para nós** — a responsabilidade é dela.
- Vale em todas as fases: connosco a hospedar (piloto) ou na VPS dela/do comprador.

---

## 2. O que o PRODUTO oferece para ela cumprir (features, não obrigações nossas)

O produto **dá-lhe as ferramentas** para ela ser responsável — usá-las é decisão dela:
- **Marca de consentimento por candidato:** `process.consent_status`
  (`pendente|dado|recusado`) + `consent_evidence_ref` + `consent_at`. Ela regista como
  obteve o consentimento. *(O produto não obriga; oferece o sítio para guardar a prova.)*
- **Caminho "candidato recusou":** o produto **suporta entrevista SEM o bot/captura**
  (`interview.capture_type = 'none'`) — ela entrevista normal, sem copiloto ao vivo.
- **Retenção configurável + apagamento:** soft-delete recuperável (`purge_after`) + cron
  de hard-delete; os **prazos são configuráveis por ela** (não impomos números — só
  defaults sugeridos, §3).
- **Factos pessoais fora do score** (`usar_no_score=FALSE`) + auditável — ajuda-a a
  mostrar que o juízo não pesou dados sensíveis, se ela precisar.
- **O juízo é assistivo — a Filipa decide sempre** (não é decisão automatizada). É a
  filosofia do produto e, de borda, ajuda-a com o Art. 22.

> Tudo isto **serve a Filipa**; a responsabilidade de usar é dela. Nós não validamos o
> consentimento dela nem auditamos o uso — só damos as alavancas.

---

## 3. Retenção — defaults SUGERIDOS (ela ajusta)

Não impomos política; o produto vem com defaults editáveis por ela:

| Dado | Default sugerido (editável pela agência) |
|---|---|
| Áudio/transcrição crua (`transcript_chunk`) | 30 dias |
| Factos `personal` | 90 dias |
| Factos `professional` | enquanto candidato ativo |
| `face_templates` (biometria) | enquanto utilizadora ativa |
| Janela soft→hard delete (`purge_after`) | 30 dias |

---

## 4. Segurança TÉCNICA — isso sim é nosso (qualidade do produto)

Separar bem: **RGPD/responsabilidade = dela; segurança técnica = nossa** (é qualidade do
que entregamos, não compliance legal):
- **Migração entre hosts:** o bundle (dump + storage + biometria) vai **cifrado**
  (sops+age estendido) — boa engenharia, não obrigação legal.
- **Anti-spoof da biometria:** GATE — ON antes de venda/>1 utilizador (`AUTENTICACAO §6
  C2`). Senão uma foto destrava o login (falha técnica, não RGPD).
- **Auth do WS, service-role só backend, cliente fino, segredos sops+age** — já tratados.
- **Confirmação mostra payload+destinatário, anti prompt-injection** (`ASSISTENTE-PESSOAL §2.1`).

---

## 5. Produto vendido — IP & responsabilidade (negócio, 🟦 Mateus)

- **IP/licença:** a CMTec retém o IP e licencia, ou vende outright? 🟦 decisão de negócio.
- **Code-signing** do app desktop: assinado em nome do **comprador** (não nosso — não
  queremos aparecer como autores de software que já não controlamos). `APP-DESKTOP D6`.
- **Responsabilidade pelo output:** cláusula de limitação — o parecer é **assistivo**, a
  agência decide; a CMTec não responde por uma má contratação. 🟦 contrato.
- **Apify/sourcing:** o comprador traz a **sua conta/tokens**; o ToS do LinkedIn é
  responsabilidade dele. (Coerente com "instância independente, sem cordão umbilical".)

---

## 6. Schema/produto que suporta o acima
```sql
ALTER TABLE process ADD COLUMN consent_status TEXT NOT NULL DEFAULT 'pendente'; -- pendente|dado|recusado
ALTER TABLE process ADD COLUMN consent_evidence_ref TEXT;
ALTER TABLE process ADD COLUMN consent_at TIMESTAMPTZ;
-- interview.capture_type ganha 'none' (entrevista sem bot — candidato recusou captura)
```
> Regra de produto: se `consent_status != 'dado'`, o copiloto ao vivo **não arranca a
> captura** — ela entrevista sem o bot. (Vira critério de aceitação.) Isto **protege-a a
> ela**; a responsabilidade de obter o consentimento continua a ser dela.

---

## 7. Resumo
- **RGPD = responsabilidade da agência (Filipa). Nada nosso.** Só precisamos de **1
  cláusula** no contrato a dizê-lo. 🟦 Mateus.
- O **produto oferece** as alavancas (consentimento, retenção, apagamento, pessoal fora
  do score) para ela cumprir — usar é decisão dela.
- O que é **nosso de facto** = **segurança técnica** (cifra na migração, anti-spoof,
  auth) — qualidade, não compliance.
- **Negócio (🟦 Mateus):** IP/licença, code-signing no nome do comprador, limitação de
  responsabilidade, Apify com tokens do comprador.
- **Nada disto bloqueia a spec.** A cláusula contratual resolve o lado legal do nosso
  lado; o resto é da Filipa.
