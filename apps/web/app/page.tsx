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

const fmtHora = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });
const fmtDia = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" });

/** Painel: pequeno cartão de KPI (número display + rótulo). */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-card px-4 py-3.5">
      <p className="font-display font-semibold text-4xl text-ink tabular-nums tracking-tight">
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

const WEEK_DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Dom
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

/** Agenda — calendário semanal + lista de entrevistas. */
function AgendaSection({ entrevistas }: { entrevistas: EntrevistaAgenda[] }) {
  const today = new Date();
  const monday = mondayOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  // Agrupa entrevistas por índice do dia (0=Seg … 6=Dom desta semana)
  const byDay: Record<number, EntrevistaAgenda[]> = {};
  for (const e of entrevistas) {
    if (!e.startedAt) continue;
    const eDate = new Date(e.startedAt);
    eDate.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      if (days[i] && eDate.getTime() === (days[i] as Date).getTime()) {
        byDay[i] = [...(byDay[i] ?? []), e];
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-card border border-line bg-card">
      <header className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
        <h2 className="font-medium text-ink text-sm">Agenda</h2>
        <span className="text-ink-3 text-xs">Esta semana</span>
      </header>

      {/* ── grelha semanal ── */}
      <div className="grid grid-cols-7 divide-x divide-line-subtle border-line-subtle border-b">
        {days.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString();
          const dayEvts = byDay[i] ?? [];
          return (
            <div
              key={d.toISOString()}
              className={`flex flex-col items-center gap-1 px-1 py-2.5 ${
                isToday ? "bg-accent-bg" : ""
              }`}
            >
              <span className="text-ink-3 text-[10px] uppercase tracking-wide">
                {WEEK_DAYS_PT[i]}
              </span>
              <span
                className={`flex size-6 items-center justify-center rounded-full text-sm font-medium ${
                  isToday ? "bg-accent text-on-accent" : "text-ink"
                }`}
              >
                {d.getDate()}
              </span>
              {/* pills com hora — substituem os pontos */}
              <div className="flex flex-col gap-0.5 w-full min-h-[14px]">
                {dayEvts.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    title={e.candidateName ?? ""}
                    className="block w-full truncate rounded px-0.5 py-px text-[9px] leading-tight font-medium text-center bg-accent/10 text-accent-ink"
                  >
                    {e.startedAt ? fmtHora.format(e.startedAt) : "—"}
                  </span>
                ))}
                {dayEvts.length > 2 && (
                  <span className="text-[8px] text-ink-3 text-center">+{dayEvts.length - 2}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── lista de detalhes ── */}
      <div className="p-2">
        {entrevistas.length === 0 ? (
          <p className="px-2 py-3 text-ink-3 text-sm">Sem entrevistas agendadas esta semana.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-subtle">
            {entrevistas.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-3">
                {/* hora em destaque */}
                <div className="w-12 shrink-0 text-center">
                  <p className="font-semibold text-sm tabular-nums leading-tight text-accent-ink">
                    {e.startedAt ? fmtHora.format(e.startedAt) : "—:—"}
                  </p>
                  <p className="text-[10px] text-ink-3 tabular-nums">
                    {e.startedAt ? fmtDia.format(e.startedAt) : ""}
                  </p>
                </div>
                <div className="w-px self-stretch bg-line-subtle shrink-0" />
                <span className="monogram !size-8" aria-hidden="true">
                  {initials(e.candidateName ?? "??")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink text-sm font-medium">
                    {e.candidateName ?? "Candidato"}
                  </p>
                  <p className="truncate text-ink-3 text-xs">{e.jobTitle ?? "—"}</p>
                </div>
                {e.status === "live" ? (
                  <Chip tone="strong">ao vivo</Chip>
                ) : (
                  <span className="text-ink-3 text-xs shrink-0">agendada</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Vagas à espera — ainda sem ninguém no funil. Urgência visual por tempo em aberto. */
function VagasEsperaSection({ vagas }: { vagas: VagaEspera[] }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-card">
      <header className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
        <div>
          <h2 className="font-medium text-ink text-sm">Vagas à espera</h2>
          <p className="text-ink-3 text-xs">Sem candidatos no funil — precisam de atenção</p>
        </div>
        {vagas.length > 0 ? (
          <span className="rounded-full bg-alert px-2 py-0.5 text-alert-ink text-xs tabular-nums font-medium">
            {vagas.length}
          </span>
        ) : (
          <span className="rounded-full bg-raised px-2 py-0.5 text-ink-3 text-xs tabular-nums">
            0
          </span>
        )}
      </header>
      <div className="p-2">
        {vagas.length === 0 ? (
          <p className="px-2 py-3 text-ink-3 text-sm">Todas as vagas já têm candidatos ✓</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {vagas.map((v) => {
              const urgente = v.diasAberta >= 14;
              const alerta = v.diasAberta >= 7;
              return (
                <li key={v.id}>
                  <Link
                    href={`/vagas/${v.id}`}
                    className="row-link"
                    style={
                      urgente
                        ? { borderLeft: "3px solid var(--color-alert)" }
                        : alerta
                          ? { borderLeft: "3px solid var(--color-strong)" }
                          : undefined
                    }
                  >
                    <span className="monogram" aria-hidden="true">
                      {initials(v.title)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink text-sm">{v.title}</span>
                      <span className="block truncate text-ink-3 text-xs">
                        {v.clientName ?? "Sem cliente"} · {v.diasAberta}d aberta
                      </span>
                    </span>
                    <Chip tone={urgente ? "alert" : alerta ? "strong" : "shallow"}>
                      {urgente ? "urgente" : alerta ? "atenção" : "à espera"}
                    </Chip>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// Funil progressivo (UI-DESIGN Tela 1). Cada fase tem cor de acento.
const COLUMNS: ReadonlyArray<{ stage: string; label: string; color: string }> = [
  { stage: "sourced", label: "Novos", color: "#64748B" },
  { stage: "screening", label: "Triagem", color: "#0EA5E9" },
  { stage: "interview", label: "Entrevistar", color: "#F59E0B" },
  { stage: "submitted", label: "Enviados", color: "#8B5CF6" },
  { stage: "client_iv", label: "Cli. entrevista", color: "#EC4899" },
  { stage: "offer", label: "Oferta", color: "#10B981" },
  { stage: "placed", label: "Colocado ✓", color: "#22C55E" },
];

function CardItem({ card }: { card: PipelineCard }) {
  return (
    <Link
      href={`/candidatos/${card.candidateId}`}
      className="flex items-center gap-2 rounded-md border border-line bg-surface p-2 transition-colors hover:border-accent hover:bg-raised"
    >
      <span className="monogram !size-7 !rounded-md !text-[11px] shrink-0" aria-hidden="true">
        {initials(card.candidateName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-ink text-[13px] font-medium leading-tight">
          {card.candidateName}
        </span>
        <span className="block truncate text-ink-3 text-[11px] leading-tight">{card.jobTitle}</span>
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
        title={
          <>
            Olá, <span className="marker">{firstName}</span>
          </>
        }
        description="O que precisa da tua atenção hoje: agenda, vagas à espera e o funil."
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
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-ink text-sm">Funil de candidaturas</h2>
          {cards.length > 0 ? (
            <span className="text-ink-3 text-xs">{cards.length} processos ativos</span>
          ) : null}
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
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
            {COLUMNS.map((col) => {
              const colCards = cards.filter((c) => c.stage === col.stage);
              const hasCards = colCards.length > 0;
              return (
                <div
                  key={col.stage}
                  className="flex w-52 shrink-0 flex-col gap-2 rounded-card border border-line bg-card overflow-hidden"
                  style={{ borderTopColor: col.color, borderTopWidth: 2 }}
                >
                  <div className="flex items-center justify-between px-3 pt-3 pb-1">
                    <span
                      className="font-medium text-xs uppercase tracking-wide"
                      style={{ color: col.color }}
                    >
                      {col.label}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums font-medium ${
                        hasCards ? "text-ink" : "text-ink-3"
                      }`}
                      style={hasCards ? { background: `${col.color}22` } : undefined}
                    >
                      {colCards.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 px-2 pb-2">
                    {colCards.length === 0 ? (
                      <div className="mx-0.5 my-2 h-14 rounded-lg border border-dashed border-line-subtle" />
                    ) : (
                      colCards.map((c) => <CardItem key={c.processId} card={c} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
