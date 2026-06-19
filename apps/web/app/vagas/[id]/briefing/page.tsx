import type { BriefingQuestion } from "@rh/core";
import { Card } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateBriefing } from "@/lib/briefing";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVaga } from "@/lib/vagas";
import { StartInterviewButton } from "./StartInterviewButton";

export const dynamic = "force-dynamic";

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

/** Tela 5 — Briefing pré-entrevista: roteiro por lente + ▶ Iniciar. */
export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const db = getDb();
  const vaga = await getVaga(db, agencyId, id);
  if (!vaga) {
    notFound();
  }
  const { briefing } = await generateBriefing(db, agencyId, { jobId: id });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/vagas/${id}`} className="text-ink-3 text-xs hover:text-ink-2">
          ← {vaga.title}
        </Link>
        <h1 className="font-semibold text-ink text-xl">Briefing pré-entrevista</h1>
        <p className="text-ink-2 text-sm">
          Roteiro agrupado por lente. Abre "boa resposta" para o gabarito.
        </p>
      </div>
      {LENS.map((l) => (
        <LensGroup
          key={l.key}
          label={l.label}
          perguntas={briefing.perguntas.filter((q) => q.lente === l.key)}
        />
      ))}
      <StartInterviewButton />
    </div>
  );
}
