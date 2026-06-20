import type { CriterioResposta, Parecer, RespostaCriterio } from "@rh/core";

/**
 * Lógica PURA do parecer (sem DB, sem React) — segura para o cliente (não importa @rh/db/pg).
 * O `lib/parecer.ts` (servidor) re-exporta isto; o `ParecerTabs` (client) importa daqui.
 *
 * Estado visual de um critério na matriz (Tela 7), derivado do enum `respostaCriterio` de @rh/core:
 *  - forte: coberto-com-prova (✓) · raso: respondeu mas raso (~) · fraco: contradito (!) · nao_coberto: não-confirmado (◦)
 */
export type CriterioEstado = "forte" | "raso" | "fraco" | "nao_coberto";

const RESPOSTA_ESTADO: Record<RespostaCriterio, CriterioEstado> = {
  "coberto-com-prova": "forte",
  raso: "raso",
  contradito: "fraco",
  "não-confirmado": "nao_coberto",
};

/** Critério já com o estado visual derivado + se tem prova citável (citação/timestamp). */
export interface CriterioView extends CriterioResposta {
  estado: CriterioEstado;
  temProva: boolean;
}

/** Contagem por estado — alimenta o resumo da matriz ("X fortes, Y rasos, …"). */
export type CriterioContagem = Record<CriterioEstado, number>;

/** Vista do parecer pronta para render: critérios anotados + contagem + flags de conteúdo. */
export interface ParecerView {
  criterios: CriterioView[];
  contagem: CriterioContagem;
  /** Red-flags = critérios contraditos (mostram os dois lados, sem vocabulário de intenção). */
  temRedFlags: boolean;
  /** Critérios que o cliente pediu mas a entrevista não cobriu (◦). */
  temNaoCobertos: boolean;
}

/** Deriva a vista da matriz a partir de um `Parecer` cru. Pura e testável (sem DB, sem React). */
export function parecerView(p: Parecer): ParecerView {
  const contagem: CriterioContagem = { forte: 0, raso: 0, fraco: 0, nao_coberto: 0 };
  const criterios: CriterioView[] = p.criterios.map((c) => {
    const estado = RESPOSTA_ESTADO[c.resposta];
    contagem[estado] += 1;
    return { ...c, estado, temProva: c.citacao !== null && c.citacao.trim().length > 0 };
  });
  return {
    criterios,
    contagem,
    temRedFlags: contagem.fraco > 0,
    temNaoCobertos: contagem.nao_coberto > 0,
  };
}

/** Detecta o parecer-stub (modo demonstração, sem chave de IA) por uma marca estável no veredito. */
export function isParecerDemo(p: Parecer): boolean {
  return p.veredito.startsWith("(demo");
}

function bullets(items: readonly string[], empty: string): string[] {
  return items.length === 0 ? [empty] : items.map((i) => `- ${i}`);
}

/** Render determinístico do Parecer → markdown. Puro — testável sem DB. */
export function renderParecerMd(candidateName: string, p: Parecer): string {
  const lines: string[] = [];
  lines.push(`# Parecer — ${candidateName}`, "", `**Veredito:** ${p.veredito}`, "");

  lines.push("## Critérios", "");
  if (p.criterios.length === 0) {
    lines.push("_Sem critérios avaliados._", "");
  } else {
    for (const c of p.criterios) {
      const cite = c.citacao ? ` (“${c.citacao}”${c.timestamp ? ` @ ${c.timestamp}` : ""})` : "";
      lines.push(`- **${c.criterio}** — ${c.resposta}${cite}: ${c.leitura}`);
    }
    lines.push("");
  }

  lines.push("## Forças", "");
  lines.push(...bullets(p.forcas, "_Nenhuma registada._"), "");
  lines.push("## Riscos / a sondar", "");
  lines.push(...bullets(p.riscos, "_Nenhum registado._"), "");

  const l = p.logistica;
  lines.push(
    "## Logística",
    "",
    `- Salário: ${l.salario ?? "—"}`,
    `- Aviso prévio: ${l.avisoPrevio ?? "—"}`,
    `- Disponibilidade: ${l.disponibilidade ?? "—"}`,
    `- Remoto: ${l.remoto ?? "—"}`,
    `- Risco de contraproposta: ${l.riscoContraproposta ?? "—"}`,
    "",
    "## Ângulo de venda",
    "",
    p.anguloVenda,
    "",
  );

  lines.push("## Credenciais a verificar", "");
  if (p.credenciaisAVerificar.length === 0) {
    lines.push("_Nenhuma._", "");
  } else {
    for (const cr of p.credenciaisAVerificar) {
      lines.push(`- ${cr.credencial} — ${cr.estado}${cr.docRef ? ` (${cr.docRef})` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Fiabilidade", "");
  if (p.naoCapturado.length === 0) {
    lines.push("Captura completa.", "");
  } else {
    for (const g of p.naoCapturado) {
      lines.push(`- Não capturado ${g.inicio}–${g.fim ?? "aberto"} (${g.causa})`);
    }
    lines.push("");
  }

  lines.push("## Fontes", "");
  lines.push(...bullets(p.fontes, "_Sem fontes._"));
  return lines.join("\n");
}
