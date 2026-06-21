import { describe, expect, it } from "vitest";
import type { CandidatoFacto } from "../lib/candidatos";
import type { ClienteFactoProva } from "../lib/clientes";
import { buildCandidateAnswer, buildClientAnswer, tokenize } from "../lib/qa/qa";

const CAND_FACTS: CandidatoFacto[] = [
  {
    competencia: "React / Next.js",
    factText: "Liderou a migração de CRA para Next.js 14 e cortou o LCP em ~40%.",
    evidenceQuote: "Passámos para o App Router e o LCP caiu para metade.",
    evidenceTs: "12:34",
    rubricLevel: "forte",
    factType: "skill_demo",
  },
  {
    competencia: "Testes E2E",
    factText: "Pouca prática em testes end-to-end.",
    evidenceQuote: "E2E é onde tenho menos horas.",
    evidenceTs: "24:10",
    rubricLevel: "fraco",
    factType: "gap",
  },
];

const CLI_FACTS: ClienteFactoProva[] = [
  {
    factType: "preference",
    factText: "Valoriza rigor de engenharia e sistemas a escala.",
    sourceSnippet: "queremos alguém que questione o problema",
    sourceRef: "Intake • 2026-06-10",
  },
  {
    factType: "rejection_reason",
    factText: "Não avança com quem trata segurança como opcional.",
    sourceSnippet: "segurança não é negociável",
    sourceRef: "Intake • 2026-06-10",
  },
];

describe("Q&A por entidade — brain (determinístico, v1 mock)", () => {
  it("candidato: pergunta que casa um facto → grounded + citação + minuto", () => {
    const a = buildCandidateAnswer("ele é forte em React?", CAND_FACTS);
    expect(a.grounded).toBe(true);
    expect(a.evidence.length).toBeGreaterThan(0);
    expect(a.evidence[0]?.quote).toBeTruthy();
    expect(a.evidence[0]?.ts).toBe("12:34");
    expect(a.answer).toContain("Next.js");
  });

  it("candidato: lacuna (testes) é encontrada e citada", () => {
    const a = buildCandidateAnswer("tem experiência de testes?", CAND_FACTS);
    expect(a.grounded).toBe(true);
    expect(a.answer.toLowerCase()).toContain("end-to-end");
  });

  it("candidato: sem match → grounded:false, sem prova, diz que não foi falado (não inventa)", () => {
    const a = buildCandidateAnswer("sabe tocar piano?", CAND_FACTS);
    expect(a.grounded).toBe(false);
    expect(a.evidence).toEqual([]);
    expect(a.answer.toLowerCase()).toContain("não foi falado");
  });

  it("cliente: pergunta que casa → prova é excerto + fonte (sem minuto)", () => {
    const a = buildClientAnswer("o que valoriza?", CLI_FACTS);
    expect(a.grounded).toBe(true);
    expect(a.evidence[0]?.source).toBe("Intake • 2026-06-10");
    expect(a.evidence[0]?.quote).toBeTruthy();
    expect(a.evidence[0]?.ts).toBeNull();
  });

  it("EN→PT: pergunta em inglês casa facto PT por token partilhado (React)", () => {
    const a = buildCandidateAnswer("is the candidate strong in React?", CAND_FACTS);
    expect(a.grounded).toBe(true);
  });

  it("intenção 'é forte em quê?' (sugestão default) → factos fortes, mesmo sem keyword", () => {
    const a = buildCandidateAnswer("É forte em quê?", CAND_FACTS);
    expect(a.grounded).toBe(true);
    expect(a.answer).toContain("Next.js");
    expect(a.evidence[0]?.rubricLevel).toBe("forte");
  });

  it("intenção 'que lacunas tem?' (sugestão default) → factos de gap/fraco", () => {
    const a = buildCandidateAnswer("Que lacunas tem?", CAND_FACTS);
    expect(a.grounded).toBe(true);
    expect(a.answer.toLowerCase()).toContain("end-to-end");
  });

  it("cliente: intenção 'o que já rejeitou?' → factos rejection_reason com fonte", () => {
    const a = buildClientAnswer("O que já rejeitou?", CLI_FACTS);
    expect(a.grounded).toBe(true);
    expect(a.answer.toLowerCase()).toContain("segurança");
    expect(a.evidence[0]?.source).toBe("Intake • 2026-06-10");
  });

  it("tokenize: remove stopwords/acentos e faz stem leve (liderou→lider)", () => {
    const t = tokenize("Já liderou alguma equipa?");
    expect(t).toContain("lider");
    expect(t).not.toContain("ja");
  });
});
