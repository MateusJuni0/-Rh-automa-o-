import type { CandidatoFacto } from "../candidatos";
import type { ClienteFactoProva } from "../clientes";

/**
 * Q&A por entidade (Tela 8) — cérebro determinístico (v1, sem chaves). Responde a perguntas sobre
 * UM candidato/cliente reusando os factos que a ficha de detalhe já carrega, SEMPRE com a prova
 * (citação+minuto p/ candidato; excerto+fonte p/ cliente). REGRA-MÃE: sem facto que case → não
 * inventa, diz que "não foi falado". FASE Ω (com chave): passar os top-N factos ao LLM com
 * grounding obrigatório; o contrato de saída fica igual.
 */

/** Prova citável de uma resposta. */
export interface QaEvidence {
  quote: string | null;
  ts: string | null;
  source: string | null;
  competencia: string | null;
  rubricLevel: string | null;
}

/** Resposta do Q&A: texto + se está fundamentada + a prova citada (vazia quando não fundamentada). */
export interface QaAnswer {
  answer: string;
  grounded: boolean;
  evidence: QaEvidence[];
}

const STOPWORDS = new Set([
  "que",
  "com",
  "dos",
  "das",
  "uma",
  "uns",
  "para",
  "por",
  "tem",
  "tens",
  "sobre",
  "esta",
  "este",
  "isso",
  "como",
  "mais",
  "nao",
  "ele",
  "ela",
  "sao",
  "foi",
  "num",
  "numa",
  "the",
  "and",
  "for",
  "you",
  "are",
  "has",
  "qual",
  "quais",
  "quanto",
  "quando",
  "onde",
  "sera",
  "seria",
  "alguma",
]);

/** Minúsculas sem acentos (PT/EN). */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Stem leve PT/EN: corta sufixos de flexão se sobrar um radical com ≥4 chars (liderança→lider). */
function stem(token: string): string {
  const m = token.match(
    /^(.*?)(ancas?|ancia|mente|coes|cao|oes|aram|ando|ou|ava|ada|ado|ria|am|os|as|es)$/,
  );
  const root = m?.[1];
  return root !== undefined && root.length >= 4 ? root : token;
}

/** Pergunta → radicais distintos (≥3 chars, sem stopwords) para casar contra os factos. */
export function tokenize(question: string): string[] {
  const stems = normalize(question)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => t.length >= 3);
  return [...new Set(stems)];
}

/** Nº de radicais da pergunta presentes (substring) no texto do facto — score de relevância. */
function matchScore(haystack: string, stems: string[]): number {
  const hay = normalize(haystack);
  return stems.filter((s) => hay.includes(s)).length;
}

const TOP_N = 3;

function rankCandidate(facts: CandidatoFacto[], stems: string[]): CandidatoFacto[] {
  return facts
    .map((f) => ({
      f,
      score: matchScore(`${f.competencia} ${f.factText} ${f.evidenceQuote ?? ""}`, stems),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
    .map((x) => x.f);
}

function rankClient(facts: ClienteFactoProva[], stems: string[]): ClienteFactoProva[] {
  return facts
    .map((f) => ({ f, score: matchScore(`${f.factText} ${f.sourceSnippet ?? ""}`, stems) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N)
    .map((x) => x.f);
}

// Fallback por INTENÇÃO de rubric: perguntas tipo "é forte em…" / "que lacunas tem…" não casam por
// keyword (a força/lacuna é o `rubricLevel`/`factType`, não o texto). Mapeia a intenção ao nível.
const STRONG_HINT = /(forte|strong|melhor|destaca|pontos? fort)/;
const WEAK_HINT = /(lacuna|gap|fraco|fraca|weak|fraqueza|dificuldade|pior)/;

function candidateByIntent(facts: CandidatoFacto[], question: string): CandidatoFacto[] {
  const q = normalize(question);
  if (WEAK_HINT.test(q)) {
    return facts.filter((f) => f.factType === "gap" || f.rubricLevel === "fraco");
  }
  if (STRONG_HINT.test(q)) {
    return facts.filter((f) => f.rubricLevel === "forte" || f.factType === "skill_demo");
  }
  return [];
}

const PREF_HINT = /(valoriz|gosta|procura|important|prioridad|quer)/;
const REJECT_HINT = /(rejeit|recus|evita|red flag|nao aceita|barreira|problema)/;

function clientByIntent(facts: ClienteFactoProva[], question: string): ClienteFactoProva[] {
  const q = normalize(question);
  if (REJECT_HINT.test(q)) {
    return facts.filter((f) => f.factType === "rejection_reason");
  }
  if (PREF_HINT.test(q)) {
    return facts.filter((f) => f.factType === "preference");
  }
  return [];
}

const NOT_FOUND_CANDIDATE =
  "Isso não foi falado nas entrevistas — não tenho prova para o afirmar. Queres que marque como 'a confirmar' para investigar?";
const NOT_FOUND_CLIENT =
  "Não tenho isso registado das reuniões com este cliente. Queres adicionar à ficha?";

/** Resposta sobre um CANDIDATO a partir dos factos das entrevistas (com citação+minuto). */
export function buildCandidateAnswer(question: string, facts: CandidatoFacto[]): QaAnswer {
  let ranked = rankCandidate(facts, tokenize(question));
  if (ranked.length === 0) {
    ranked = candidateByIntent(facts, question).slice(0, TOP_N);
  }
  if (ranked.length === 0) {
    return { answer: NOT_FOUND_CANDIDATE, grounded: false, evidence: [] };
  }
  return {
    answer: ranked.map((f) => f.factText).join(" "),
    grounded: true,
    evidence: ranked.map((f) => ({
      quote: f.evidenceQuote,
      ts: f.evidenceTs,
      source: null,
      competencia: f.competencia,
      rubricLevel: f.rubricLevel,
    })),
  };
}

/** Resposta sobre um CLIENTE a partir dos factos de reuniões/intake (com excerto+fonte). */
export function buildClientAnswer(question: string, facts: ClienteFactoProva[]): QaAnswer {
  let ranked = rankClient(facts, tokenize(question));
  if (ranked.length === 0) {
    ranked = clientByIntent(facts, question).slice(0, TOP_N);
  }
  if (ranked.length === 0) {
    return { answer: NOT_FOUND_CLIENT, grounded: false, evidence: [] };
  }
  return {
    answer: ranked.map((f) => f.factText).join(" "),
    grounded: true,
    evidence: ranked.map((f) => ({
      quote: f.sourceSnippet,
      ts: null,
      source: f.sourceRef,
      competencia: null,
      rubricLevel: null,
    })),
  };
}
