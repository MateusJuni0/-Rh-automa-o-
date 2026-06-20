import type { RequisitoStatus } from "@rh/core";
import { Card, Chip, EmptyState, Skeleton } from "@rh/ui";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/app/components/PageHeader";
import { buildComparisonMatrix, type ComparisonColumn } from "@/lib/comparar";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVaga } from "@/lib/vagas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comparar · Vera" };

/** Glifo + rótulo + tom + cor do glifo de cada estado (fonte única: matriz, célula e legenda). */
const STATUS: Record<
  RequisitoStatus,
  { glyph: string; label: string; tone: "accent" | "shallow" | "muted" | "alert"; text: string }
> = {
  "coberto-com-prova": { glyph: "✓", label: "Coberto", tone: "accent", text: "text-accent-ink" },
  raso: { glyph: "~", label: "Raso", tone: "shallow", text: "text-ink-2" },
  "não-tocado": { glyph: "◦", label: "Não tocado", tone: "muted", text: "text-ink-3" },
  contradito: { glyph: "!", label: "Contradito", tone: "alert", text: "text-alert" },
};

/** Ordem da legenda (do mais forte ao mais fraco), sem depender de `Object.keys`. */
const LEGEND_ORDER: readonly RequisitoStatus[] = [
  "coberto-com-prova",
  "raso",
  "não-tocado",
  "contradito",
];

/** Cor da percentagem de match: verde forte, âmbar morno, cinza fraco (sem inventar limiares novos). */
function matchTone(score: number): "accent" | "shallow" | "muted" {
  if (score >= 75) return "accent";
  if (score >= 50) return "shallow";
  return "muted";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length >= 2 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last || name.slice(0, 2)).toUpperCase();
}

/** Cabeçalho de uma coluna (candidato): monograma + nome + match% + sinal de funil. */
function ColumnHead({ col }: { col: ComparisonColumn }) {
  return (
    <th
      scope="col"
      className="min-w-[8.5rem] border-line-subtle border-b px-3 py-3 text-left align-bottom"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised font-medium text-[10px] text-ink-2"
        >
          {initials(col.name)}
        </span>
        <Link
          href={`/candidatos/${col.candidateId}`}
          className="min-w-0 truncate font-medium text-ink text-sm hover:text-accent-ink"
        >
          {col.name}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip tone={matchTone(col.matchScore)}>{col.matchScore}% match</Chip>
        {col.temEntrevista ? null : (
          <Chip tone="muted" className="text-[10px]">
            só CV
          </Chip>
        )}
      </div>
    </th>
  );
}

/** A matriz propriamente dita (separada para correr dentro de Suspense). */
async function MatrizComparacao({ job, ids }: { job: string; ids: string[] }) {
  const { agencyId } = await getSession();
  const db = getDb();
  const [vaga, matrix] = await Promise.all([
    getVaga(db, agencyId, job),
    buildComparisonMatrix(db, agencyId, job, ids),
  ]);

  const descricao = vaga
    ? `${vaga.title}${vaga.clientName ? ` (${vaga.clientName})` : ""}: cobertura dos critérios, candidato a candidato.`
    : "Cobertura dos critérios, candidato a candidato.";

  return (
    <>
      <PageHeader eyebrow="Comparar" title="Comparar candidatos" description={descricao} />

      {matrix.columns.length === 0 ? (
        <EmptyState
          title="Sem candidatos para comparar"
          description="Esta vaga ainda não tem candidatos triados. Volta à triagem da vaga para começar."
          action={
            <Link
              href={`/vagas/${job}/triagem`}
              className="text-accent-ink text-sm hover:underline"
            >
              Abrir triagem →
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="elev elev-top relative" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 min-w-[10rem] bg-card border-line-subtle border-b px-4 py-3 align-bottom font-medium text-ink-3 text-xs uppercase tracking-wide"
                    >
                      Critério
                    </th>
                    {matrix.columns.map((col) => (
                      <ColumnHead key={col.candidateId} col={col} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row, rowIdx) => (
                    <tr
                      key={row.requisito}
                      className="border-line-subtle border-b last:border-b-0 hover:bg-raised/40"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-card px-4 py-3 align-top font-normal"
                      >
                        <span
                          className={
                            row.must ? "font-semibold text-ink text-sm" : "text-ink-2 text-sm"
                          }
                        >
                          {row.requisito}
                        </span>
                        {row.must ? null : (
                          <span className="ml-1.5 text-ink-3 text-xs">(desejável)</span>
                        )}
                      </th>
                      {matrix.columns.map((col) => {
                        const cell = col.cells[rowIdx];
                        const status = cell?.status ?? "não-tocado";
                        const meta = STATUS[status];
                        return (
                          <td key={col.candidateId} className="px-3 py-3 align-top">
                            <div className="flex items-start gap-2">
                              <span
                                role="img"
                                aria-label={meta.label}
                                className={`mt-px shrink-0 font-semibold text-sm ${meta.text}`}
                              >
                                {meta.glyph}
                              </span>
                              <span className="text-ink-3 text-xs leading-snug">
                                {cell?.evidencia}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* legenda + nota de funil */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-ink-3 text-xs">
            {LEGEND_ORDER.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <Chip tone={STATUS[s].tone}>{STATUS[s].glyph}</Chip>
                {STATUS[s].label}
              </span>
            ))}
          </div>

          {matrix.algumSoCv ? (
            <p className="px-1 text-ink-3 text-xs">
              Candidatos marcados "só CV" ainda não foram entrevistados: a cobertura vem do CV,
              falta confirmar na entrevista. (demo, liga a chave para a avaliação ao vivo.)
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

/** Esqueleto de carregamento da matriz (estado UX de loading via Suspense). */
function MatrizSkeleton() {
  return (
    <Card bodyClassName="p-0">
      <div className="flex flex-col divide-y divide-line-subtle">
        {["a", "b", "c", "d", "e"].map((k) => (
          <div key={`sk-${k}`} className="flex items-center gap-6 px-4 py-3.5">
            <Skeleton width="40%" height="14px" />
            <Skeleton width="18%" height="14px" />
            <Skeleton width="18%" height="14px" />
            <Skeleton width="18%" height="14px" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Tela 10 — Comparar candidatos: matriz critério × candidato (entra via ?job=<id>&c=id1,id2). */
export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; c?: string }>;
}) {
  const { job, c } = await searchParams;

  if (!job) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Comparar"
          title="Comparar candidatos"
          description="Põe os candidatos de uma vaga lado a lado, critério a critério."
        />
        <EmptyState
          title="Escolhe uma vaga para comparar"
          description='Abre a comparação a partir da triagem de uma vaga (botão "Comparar candidatos").'
          action={
            <Link href="/vagas" className="text-accent-ink text-sm hover:underline">
              Ver vagas →
            </Link>
          }
        />
      </div>
    );
  }

  const ids = c ? c.split(",").filter(Boolean) : [];

  return (
    <div className="flex flex-col gap-6">
      <Suspense
        fallback={
          <>
            <PageHeader
              eyebrow="Comparar"
              title="Comparar candidatos"
              description="A montar a matriz de comparação…"
            />
            <MatrizSkeleton />
          </>
        }
      >
        <MatrizComparacao job={job} ids={ids} />
      </Suspense>
    </div>
  );
}
