import { Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { listPipeline, type PipelineCard } from "@/lib/pipeline";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Funil progressivo (UI-DESIGN Tela 1). Mapeia o enum `processStage` p/ etiquetas PT.
const COLUMNS: ReadonlyArray<{ stage: string; label: string }> = [
  { stage: "sourced", label: "Novos" },
  { stage: "screening", label: "Triados" },
  { stage: "interview", label: "Entrevistar" },
  { stage: "submitted", label: "Enviados" },
  { stage: "client_iv", label: "Entrevista cliente" },
  { stage: "offer", label: "Oferta" },
  { stage: "placed", label: "Colocado" },
];

function CardItem({ card }: { card: PipelineCard }) {
  return (
    <Link
      href={`/candidatos/${card.candidateId}`}
      className="block rounded-md border border-line bg-surface p-2.5 hover:border-accent"
    >
      <p className="text-ink text-sm">{card.candidateName}</p>
      <p className="text-ink-3 text-xs">{card.jobTitle}</p>
    </Link>
  );
}

/** Tela 1 — Dashboard / Pipeline (o "QG"): kanban por etapa do processo. */
export default async function DashboardPage() {
  const { agencyId } = await getSession();
  const cards = await listPipeline(getDb(), agencyId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl text-ink">Pipeline</h1>
        <p className="text-ink-2 text-sm">O funil de candidaturas por etapa.</p>
      </div>
      {cards.length === 0 ? (
        <EmptyState
          title="Pipeline vazio"
          description="Cria uma vaga e adiciona candidatos para começar a mover o funil."
          action={
            <Link href="/vagas" className="text-accent-ink text-sm hover:underline">
              ▶ Abrir uma vaga
            </Link>
          }
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const colCards = cards.filter((c) => c.stage === col.stage);
            return (
              <div
                key={col.stage}
                className="flex w-56 shrink-0 flex-col gap-2 rounded-card border border-line bg-card p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink text-sm">{col.label}</span>
                  <Chip tone="muted">{colCards.length}</Chip>
                </div>
                {colCards.map((c) => (
                  <CardItem key={c.processId} card={c} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
