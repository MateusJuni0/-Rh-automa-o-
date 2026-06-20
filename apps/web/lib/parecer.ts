import { randomUUID } from "node:crypto";
import { buildParecer, type ParecerInput } from "@rh/ai";
import type { Parecer } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, eq, sql } from "drizzle-orm";
import { aiOptions } from "./ai";
import { renderParecerMd } from "./parecer-view";

type Db = DbHandle["db"];

export type {
  CriterioContagem,
  CriterioEstado,
  CriterioView,
  ParecerView,
} from "./parecer-view";
// A lógica PURA de vista (sem DB) vive em ./parecer-view (client-safe). Re-exporta-se aqui para os
// callers do servidor que já importavam de @/lib/parecer.
export { isParecerDemo, parecerView, renderParecerMd } from "./parecer-view";

/** Parecer stub (sem chave de IA) — válido e honesto sobre o seu próprio estado de demonstração. */
function stubParecer(name: string): Parecer {
  return {
    veredito: `(demo — requer OPENROUTER_API_KEY) ${name}: parecer indisponível sem o modelo.`,
    criterios: [],
    forcas: [],
    riscos: ["Parecer gerado em modo demonstração (sem chave de IA)."],
    logistica: {
      salario: null,
      avisoPrevio: null,
      disponibilidade: null,
      remoto: null,
      riscoContraproposta: null,
    },
    anguloVenda: "—",
    credenciaisAVerificar: [],
    naoCapturado: [],
    fontes: [],
  };
}

/**
 * Gera o parecer (PLANO P3.1 "Depois"): lê entrevista → processo → candidato + factos duráveis,
 * corre `buildParecer` (stub sem chave), renderiza markdown e persiste o `report` (interview_id UNIQUE,
 * idempotente; status 'ready'). Devolve {reportId, parecer, contentMd, candidateName}.
 */
export async function gerarParecer(
  db: Db,
  agencyId: string,
  params: { interviewId: string },
): Promise<{ reportId: string; parecer: Parecer; contentMd: string; candidateName: string }> {
  const [iv] = await db
    .select({ processId: schema.interview.processId })
    .from(schema.interview)
    .where(
      and(eq(schema.interview.id, params.interviewId), eq(schema.interview.agencyId, agencyId)),
    );
  if (!iv) {
    throw new Error("entrevista inexistente nesta agência");
  }

  let candidateName = "Candidato";
  let factos: ParecerInput["factos"] = [];
  if (iv.processId) {
    const [proc] = await db
      .select({ candidateId: schema.process.candidateId })
      .from(schema.process)
      .where(and(eq(schema.process.id, iv.processId), eq(schema.process.agencyId, agencyId)));
    if (proc) {
      const [cand] = await db
        .select({ name: schema.candidate.name })
        .from(schema.candidate)
        .where(
          and(eq(schema.candidate.id, proc.candidateId), eq(schema.candidate.agencyId, agencyId)),
        );
      candidateName = cand?.name ?? candidateName;
      const facts = await db
        .select({
          competencia: schema.candidateMemoryFact.competencia,
          factText: schema.candidateMemoryFact.factText,
          evidenceQuote: schema.candidateMemoryFact.evidenceQuote,
          evidenceTs: schema.candidateMemoryFact.evidenceTs,
          rubricLevel: schema.candidateMemoryFact.rubricLevel,
          naoSustentado: schema.candidateMemoryFact.naoSustentado,
        })
        .from(schema.candidateMemoryFact)
        .where(
          and(
            eq(schema.candidateMemoryFact.candidateId, proc.candidateId),
            eq(schema.candidateMemoryFact.agencyId, agencyId),
          ),
        );
      factos = facts.map((f) => ({
        competencia: f.competencia,
        factText: f.factText,
        evidenceQuote: f.evidenceQuote ?? undefined,
        evidenceTs: f.evidenceTs ?? undefined,
        rubricLevel: f.rubricLevel ?? undefined,
        naoSustentado: f.naoSustentado,
      }));
    }
  }

  const parecer = await buildParecer(
    { candidate: { name: candidateName }, clientCriteria: [], factos },
    aiOptions(stubParecer(candidateName)),
  );
  const contentMd = renderParecerMd(candidateName, parecer);

  await db
    .insert(schema.report)
    .values({
      id: randomUUID(),
      interviewId: params.interviewId,
      agencyId,
      contentMd,
      contentClientMd: contentMd,
      status: "ready",
    })
    .onConflictDoUpdate({
      target: schema.report.interviewId,
      set: { contentMd, contentClientMd: contentMd, status: "ready", generatedAt: sql`now()` },
    });

  const [rep] = await db
    .select({ id: schema.report.id })
    .from(schema.report)
    .where(eq(schema.report.interviewId, params.interviewId));
  return { reportId: rep?.id ?? "", parecer, contentMd, candidateName };
}

/** Export: devolve o markdown do parecer já gerado (null se ainda não existe). PDF = TODO (pós-chave). */
export async function getParecerMd(
  db: Db,
  agencyId: string,
  interviewId: string,
): Promise<string | null> {
  const [rep] = await db
    .select({ contentMd: schema.report.contentMd })
    .from(schema.report)
    .where(and(eq(schema.report.interviewId, interviewId), eq(schema.report.agencyId, agencyId)));
  return rep?.contentMd ?? null;
}
