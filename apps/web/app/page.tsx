import { schema } from "@rh/db";
import { Chip, EmptyState } from "@rh/ui";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { buildProactiveCards, type ProactiveCard } from "@/lib/assistant/proactive";
import { mockProactiveEvents } from "@/lib/assistant/proactive-feed";
import { type EntrevistaAgenda, getDashboard, type VagaEspera } from "@/lib/dashboard";
import { getDb } from "@/lib/db";
import { listPipeline, type PipelineCard } from "@/lib/pipeline";
import { getSession } from "@/lib/session";
import { initials } from "./components/EntityList";
import { PageHeader } from "./components/PageHeader";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<ProactiveCard["kind"], string> = {
  prep: "🎯",
  no_show: "📵",
  guarantee: "🛡️",
  lacuna: "🔍",
};
const SEVERITY_TONE = { urgent: "alert", warn: "strong", info: "muted" } as const;
const SEVERITY_LABEL = { urgent: "Urgente", warn: "Atenção", info: "Sugestão" } as const;
const SEVERITY_RAIL: Record<ProactiveCard["severity"], string> = {
  urgent: "var(--color-alert)",
  warn: "var(--color-strong)",
  info: "var(--color-untouched)",
};

function fmtQuando(d: Date | null): string {
  if (!d) {
    return "sem hora";
  }
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Painel: pequeno cartão de KPI (número display + rótulo). */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-card px-4 py-3.5">
      <p className="font-display font-semibold text-3xl text-ink tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-0.5 text-ink-3 text-xs">{label}</p>
    </div>
  );
}

/** "A precisar de atenção" — a Vera antecipa (prep/no-show/garantia/lacuna). Mock feed (v1). */
function ProactiveSection() {
  const now = Date.now();
  const suggestions = buildProactiveCards(mockProactiveEvents(now), now);
  return (
    <section className="overflow-hidden rounded-card border border-line bg-card panel-accent">
      <header className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
        <h2 className="font-medium text-ink text-sm">A precisar de atenção</h2>
        <span className="text-ink-3 text-xs">A Vera antecipa</span>
      </header>
      <div className="p-2">
        {suggestions.length === 0 ? (
          <p className="px-2 py-3 text-ink-3 text-sm">Tudo em dia ✓</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <li
                key={`${s.kind}-${s.ref ?? s.title}`}
                className="flex items-start gap-3 rounded-md border border-line bg-surface py-3 pr-3 pl-3.5"
                style={{ borderLeftWidth: "3px", borderLeftColor: SEVERITY_RAIL[s.severity] }}
              >
                <span className="text-base leading-tight" aria-hidden="true">
                  {KIND_ICON[s.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-ink text-sm">{s.title}</p>
                    <Chip tone={SEVERITY_TONE[s.severity]}>{SEVERITY_LABEL[s.severity]}</Chip>
                  </div>
                  <p className="mt-0.5 text-ink-3 text-xs">{s.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Agenda — próximas entrevistas (dados reais da tabela `interview`). */
function AgendaSection({ entrevistas }: { entrevistas: EntrevistaAgenda[] }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-card">
      <header className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
        <h2 className="font-medium text-ink text-sm">Agenda</h2>
        <span className="text-ink-3 text-xs">Próximas entrevistas</span>
      </header>
      <div className="p-2">
        {entrevistas.length === 0 ? (
          <p className="px-2 py-3 text-ink-3 text-sm">Sem entrevistas agendadas.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {entrevistas.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-md px-2 py-2.5">
                <span className="monogram" aria-hidden="true">
                  {initials(e.candidateName ?? "??")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink text-sm">{e.candidateName ?? "Candidato"}</p>
                  <p className="truncate text-ink-3 text-xs">{e.jobTitle ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-ink-2 text-xs tabular-nums">{fmtQuando(e.startedAt)}</p>
                  {e.status === "live" ? (
                    <Chip tone="strong">ao vivo</Chip>
                  ) : (
                    <span className="text-ink-3 text-xs">agendada</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Vagas à espera — ainda sem ninguém no funil ("clientes que não acharam nada"). */
function VagasEsperaSection({ vagas }: { vagas: VagaEspera[] }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-card">
      <header className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
        <div>
          <h2 className="font-medium text-ink text-sm">Vagas à espera</h2>
          <p className="text-ink-3 text-xs">Ainda sem candidatos no funil</p>
        </div>
        <span className="rounded-full bg-raised px-2 py-0.5 text-ink-3 text-xs tabular-nums">
          {vagas.length}
        </span>
      </header>
      <div className="p-2">
        {vagas.length === 0 ? (
          <p className="px-2 py-3 text-ink-3 text-sm">Todas as vagas já têm candidatos ✓</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {vagas.map((v) => (
              <li key={v.id}>
                <Link href={`/vagas/${v.id}`} className="row-link">
                  <span className="monogram" aria-hidden="true">
                    {initials(v.title)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink text-sm">{v.title}</span>
                    <span className="block truncate text-ink-3 text-xs">
                      {v.clientName ?? "Sem cliente"} · {v.diasAberta}d aberta
                    </span>
                  </span>
                  <Chip tone="shallow">à espera</Chip>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

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
      className="flex items-center gap-2.5 rounded-md border border-line bg-surface p-2.5 transition-colors hover:border-accent"
    >
      <span className="monogram !size-7 !rounded-md !text-xs" aria-hidden="true">
        {initials(card.candidateName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-ink text-sm">{card.candidateName}</span>
        <span className="block truncate text-ink-3 text-xs">{card.jobTitle}</span>
      </span>
    </Link>
  );
}

/** Tela 1 — Painel / QG da Filipa: o que precisa de atenção, a agenda, vagas à espera, e o funil. */
export default async function DashboardPage() {
  const { agencyId, recruiterId } = await getSession();
  const db = getDb();
  const [dash, cards, meRows] = await Promise.all([
    getDashboard(db, agencyId),
    listPipeline(db, agencyId),
    db
      .select({ name: schema.recruiter.name })
      .from(schema.recruiter)
      .where(and(eq(schema.recruiter.id, recruiterId), eq(schema.recruiter.agencyId, agencyId))),
  ]);
  const firstName = (meRows[0]?.name ?? "").split(/\s+/)[0] || "Filipa";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Painel"
        title={`Olá, ${firstName}`}
        description="O que precisa da tua atenção hoje — agenda, vagas à espera e o funil."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Vagas abertas" value={dash.stats.vagasAbertas} />
        <StatCard label="Candidatos ativos" value={dash.stats.candidatosAtivos} />
        <StatCard label="Entrevistas agendadas" value={dash.stats.entrevistasAgendadas} />
        <StatCard label="Processos ativos" value={dash.stats.processosAtivos} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ProactiveSection />
        <AgendaSection entrevistas={dash.proximasEntrevistas} />
      </div>

      <VagasEsperaSection vagas={dash.vagasSemCandidatos} />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-ink text-sm">Funil de candidaturas</h2>
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
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {COLUMNS.map((col) => {
              const colCards = cards.filter((c) => c.stage === col.stage);
              return (
                <div
                  key={col.stage}
                  className="flex w-56 shrink-0 flex-col gap-2 rounded-card border border-line bg-card p-2.5"
                >
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <span className="font-medium text-ink text-sm">{col.label}</span>
                    <span className="rounded-full bg-raised px-2 py-0.5 text-ink-3 text-xs tabular-nums">
                      {colCards.length}
                    </span>
                  </div>
                  {colCards.length === 0 ? (
                    <p className="px-1 py-2 text-ink-3 text-xs">—</p>
                  ) : (
                    colCards.map((c) => <CardItem key={c.processId} card={c} />)
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
