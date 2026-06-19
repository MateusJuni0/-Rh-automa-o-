import { randomUUID } from "node:crypto";
import { buildParecer, type ParecerInput } from "@rh/ai";
import type { Parecer } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, eq, sql } from "drizzle-orm";
import { aiOptions } from "./ai";

type Db = DbHandle["db"];

/** Render determinístico do Parecer → markdown (versão cliente). Puro — testável sem DB. */
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

function bullets(items: readonly string[], empty: string): string[] {
  return items.length === 0 ? [empty] : items.map((i) => `- ${i}`);
}

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
 * Gera o parecer (PLANO P3.1 "Depois"): lê entrevista → processo → candidato + factos dur/áveis,
 * corre `buildParecer` (stub sem chave), renderiza markdown e persiste o `report` (interview_id UNIQUE,
 * idempotente; status 'ready'). Devolve {reportId, parecer, contentMd}.
 */
export async function gerarParecer(
  db: Db,
  agencyId: string,
  params: { interviewId: string },
): Promise<{ reportId: string; parecer: Parecer; contentMd: string }> {
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
  return { reportId: rep?.id ?? "", parecer, contentMd };
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
