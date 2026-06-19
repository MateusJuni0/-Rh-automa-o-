import type { RequisitoStatus } from "@rh/core";
import { Card, Chip, EmptyState } from "@rh/ui";
import { buildComparisonMatrix } from "@/lib/comparar";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comparar · Vera" };

const STATUS_TONE: Record<RequisitoStatus, "accent" | "shallow" | "muted" | "alert"> = {
  "coberto-com-prova": "accent",
  raso: "shallow",
  "não-tocado": "muted",
  contradito: "alert",
};

const STATUS_LABEL: Record<RequisitoStatus, string> = {
  "coberto-com-prova": "✓ coberto",
  raso: "~ raso",
  "não-tocado": "—",
  contradito: "✗ contra",
};

/** Tela 10 — Comparar candidatos: matriz requisitos × candidatos (entra via ?job=<id>&c=id1,id2). */
export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; c?: string }>;
}) {
  const { job, c } = await searchParams;
  if (!job) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-4 font-semibold text-ink text-xl">Comparar candidatos</h1>
        <EmptyState
          title="Escolhe uma vaga para comparar"
          description="Abre a comparação a partir da triagem de uma vaga (botão “Comparar”)."
        />
      </main>
    );
  }

  const { agencyId } = await getSession();
  const ids = c ? c.split(",").filter(Boolean) : [];
  const matrix = await buildComparisonMatrix(getDb(), agencyId, job, ids);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 font-semibold text-ink text-xl">Comparar candidatos</h1>
      <p className="mb-6 text-ink-3 text-sm">Cobertura dos requisitos por candidato.</p>
      {matrix.columns.length === 0 ? (
        <EmptyState
          title="Sem candidatos para comparar"
          description="Esta vaga ainda não tem candidatos triados."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-ink-3 font-medium">Requisito</th>
                  {matrix.columns.map((col) => (
                    <th key={col.candidateId} className="px-2 py-2 text-left">
                      <span className="text-ink">{col.name}</span>
                      <Chip tone="muted" className="ml-2">
                        {col.matchScore}%
                      </Chip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.requisitos.map((req, rowIdx) => (
                  <tr key={req} className="border-line border-t">
                    <th className="px-2 py-2 text-left text-ink font-normal">{req}</th>
                    {matrix.columns.map((col) => {
                      const cell = col.cells[rowIdx];
                      const status = cell?.status ?? "não-tocado";
                      return (
                        <td key={col.candidateId} className="px-2 py-2">
                          <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  );
}
