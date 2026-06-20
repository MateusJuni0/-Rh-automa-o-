import { Card, Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { type TriageRow, triageVaga } from "@/lib/triagem";
import { getVaga, listVagaCandidatos } from "@/lib/vagas";
import { AddToFunilButton } from "./AddToFunilButton";

export const dynamic = "force-dynamic";

function TriageItem({ row, jobId, inFunil }: { row: TriageRow; jobId: string; inFunil: boolean }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink text-sm">{row.name}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-medium text-accent-ink text-sm tabular-nums">
            {row.matchScore}%
          </span>
          <AddToFunilButton candidateId={row.candidateId} jobId={jobId} alreadyIn={inFunil} />
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full bg-accent" style={{ width: `${row.matchScore}%` }} />
      </div>
      {(row.cobertos.length > 0 || row.faltantes.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {row.cobertos.map((s) => (
            <Chip key={`c-${s}`} tone="strong">
              {s}
            </Chip>
          ))}
          {row.faltantes.map((s) => (
            <Chip key={`f-${s}`} tone="muted">
              {s}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-3 text-xs">{row.resumo || "—"}</span>
        <Link href={`/candidatos/${row.candidateId}`} className="text-ink-2 text-xs hover:text-ink">
          👁 ver perfil
        </Link>
      </div>
    </li>
  );
}

/** Tela 3 — Triagem: candidatos ordenados por match% (chips cobertos/faltantes). */
export default async function TriagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const db = getDb();
  const [vaga, rows, noFunil] = await Promise.all([
    getVaga(db, agencyId, id),
    triageVaga(db, agencyId, id),
    listVagaCandidatos(db, agencyId, id),
  ]);
  if (!vaga) {
    notFound();
  }
  const inFunilSet = new Set(noFunil.map((c) => c.candidateId));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/vagas/${id}`} className="text-ink-3 text-xs hover:text-ink-2">
          ← {vaga.title}
        </Link>
        <h1 className="font-semibold text-ink text-xl">Triagem</h1>
        <p className="text-ink-2 text-sm">Candidatos ordenados por compatibilidade com a vaga.</p>
        {rows.length > 0 ? (
          <Link href={`/comparar?job=${id}`} className="text-accent-ink text-sm hover:underline">
            ⊞ Comparar candidatos →
          </Link>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="Sem candidatos para triar"
          description="Adiciona candidatos no talent pool para os ver aqui ordenados por match."
        />
      ) : (
        <Card>
          <ul className="-mx-4 -my-4 divide-y divide-line-subtle">
            {rows.map((row) => (
              <TriageItem
                key={row.candidateId}
                row={row}
                jobId={id}
                inFunil={inFunilSet.has(row.candidateId)}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
