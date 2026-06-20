import type { BriefingQuestion } from "@rh/core";
import { type DbHandle, schema } from "@rh/db";
import { Card } from "@rh/ui";
import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateBriefing } from "@/lib/briefing";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVaga } from "@/lib/vagas";
import { StartInterviewButton } from "./StartInterviewButton";

export const dynamic = "force-dynamic";

type Db = DbHandle["db"];

// As 3 lentes canónicas (@rh/core enum `lente`): tecnica|cliente|gap.
const LENS: ReadonlyArray<{ key: BriefingQuestion["lente"]; label: string }> = [
  { key: "tecnica", label: "Técnicas" },
  { key: "cliente", label: "Interesses do cliente" },
  { key: "gap", label: "Lacunas (CV vs vaga)" },
];

function LensGroup({ label, perguntas }: { label: string; perguntas: BriefingQuestion[] }) {
  if (perguntas.length === 0) {
    return null;
  }
  return (
    <Card title={label}>
      <ul className="flex flex-col gap-3">
        {perguntas.map((q) => (
          <li key={q.pergunta}>
            <p className="text-ink text-sm">{q.pergunta}</p>
            <details className="mt-1">
              <summary className="cursor-pointer text-ink-3 text-xs">
                o que é uma boa resposta
              </summary>
              <p className="mt-1 text-ink-2 text-xs">{q.boaResposta}</p>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Resolve o processId + candidateName via ?candidate=<candidateId>. */
async function resolveProcesso(
  db: Db,
  agencyId: string,
  jobId: string,
  candidateId: string | undefined,
): Promise<{ processId: string; candidateName: string } | null> {
  if (!candidateId) return null;
  const [row] = await db
    .select({
      processId: schema.process.id,
      candidateName: schema.candidate.name,
    })
    .from(schema.process)
    .innerJoin(schema.candidate, eq(schema.candidate.id, schema.process.candidateId))
    .where(
      and(
        eq(schema.process.candidateId, candidateId),
        eq(schema.process.jobId, jobId),
        eq(schema.process.agencyId, agencyId),
        isNull(schema.process.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Tela 5 — Briefing pré-entrevista: roteiro por lente + ▶ Iniciar. Aceita ?candidate=id. */
export default async function BriefingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ candidate?: string }>;
}) {
  const { id } = await params;
  const { candidate: candidateId } = await searchParams;
  const { agencyId } = await getSession();
  const db = getDb();
  const [vaga, briefingResult, processo] = await Promise.all([
    getVaga(db, agencyId, id),
    generateBriefing(db, agencyId, { jobId: id }),
    resolveProcesso(db, agencyId, id, candidateId),
  ]);
  if (!vaga) {
    notFound();
  }
  const { briefing } = briefingResult;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/vagas/${id}`} className="text-ink-3 text-xs hover:text-ink-2">
          ← {vaga.title}
        </Link>
        <h1 className="font-semibold text-ink text-xl">Briefing pré-entrevista</h1>
        {processo ? (
          <p className="text-accent-ink text-sm font-medium">
            Preparar entrevista com {processo.candidateName}
          </p>
        ) : (
          <p className="text-ink-2 text-sm">
            Roteiro agrupado por lente. Abre "boa resposta" para o gabarito.
          </p>
        )}
      </div>
      {LENS.map((l) => (
        <LensGroup
          key={l.key}
          label={l.label}
          perguntas={briefing.perguntas.filter((q) => q.lente === l.key)}
        />
      ))}
      <StartInterviewButton processId={processo?.processId} />
    </div>
  );
}
