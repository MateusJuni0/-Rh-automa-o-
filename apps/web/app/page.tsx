import { schema } from "@rh/db";
import { Chip, EmptyState } from "@rh/ui";
import { and, eq } from "drizzle-orm";
import { Play, Search, ShieldAlert, Target, UserX } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { buildProactiveCards, type ProactiveCard } from "@/lib/assistant/proactive";
import { mockProactiveEvents } from "@/lib/assistant/proactive-feed";
import { getDashboard } from "@/lib/dashboard";
import { getDb } from "@/lib/db";
import { listPipeline, type PipelineCard } from "@/lib/pipeline";
import { getSession } from "@/lib/session";
import { initials } from "./components/EntityList";
import { PageHeader } from "./components/PageHeader";

export const dynamic = "force-dynamic";

const fmtHora = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });
const fmtDia = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" });

type IconCmp = ComponentType<{ size?: number; className?: string }>;

const KIND_ICON: Record<ProactiveCard["kind"], IconCmp> = {
  prep: Target,
  no_show: UserX,
  guarantee: ShieldAlert,
  lacuna: Search,
};
const SEVERITY_TONE = { urgent: "alert", warn: "strong", info: "muted" } as const;
const SEVERITY_LABEL = { urgent: "Urgente", warn: "Atenção", info: "Sugestão" } as const;

const TILE = "rounded-card border border-line bg-card p-4 elev elev-top relative";

/** Tempo relativo curto até uma entrevista (para o herói "a seguir"). */
function relTime(d: Date, now: number): string {
  const m = Math.round((d.getTime() - now) / 60000);
  if (m < -1) return "atrasada";
  if (m <= 1) return "agora";
  if (m < 60) return `em ${m} min`;
  if (m < 60 * 24) return `em ${Math.round(m / 60)} h`;
  return fmtDia.format(d);
}

/** Funil progressivo (UI-DESIGN Tela 1). Cada fase tem cor de acento. */
const COLUMNS: ReadonlyArray<{ stage: string; label: string; color: string }> = [
  { stage: "sourced", label: "Novos", color: "#64748B" },
  { stage: "screening", label: "Triagem", color: "#0EA5E9" },
  { stage: "interview", label: "Entrevistar", color: "#F59E0B" },
  { stage: "submitted", label: "Enviados", color: "#8B5CF6" },
  { stage: "client_iv", label: "Cli. entrevista", color: "#EC4899" },
  { stage: "offer", label: "Oferta", color: "#10B981" },
  { stage: "placed", label: "Colocado", color: "#22C55E" },
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

/** Tela 1 — Painel / QG da Filipa (layout A+B): herói da próxima ação + bento + funil. */
export default async function DashboardPage() {
  const { agencyId, recruiterId } = await getSession();
  const db = getDb();
  const now = Date.now();
  const [dash, cards, meRows] = await Promise.all([
    getDashboard(db, agencyId),
    listPipeline(db, agencyId),
    db
      .select({ name: schema.recruiter.name })
      .from(schema.recruiter)
      .where(and(eq(schema.recruiter.id, recruiterId), eq(schema.recruiter.agencyId, agencyId))),
  ]);
  const firstName = (meRows[0]?.name ?? "").split(/\s+/)[0] || "Filipa";
  const suggestions = buildProactiveCards(mockProactiveEvents(now), now);
  const next = dash.proximasEntrevistas[0] ?? null;
  const rest = dash.proximasEntrevistas.slice(1, 4);
  const espera = dash.vagasSemCandidatos[0] ?? null;
  const briefingHref =
    next?.jobId != null
      ? `/vagas/${next.jobId}/briefing${next.candidateId ? `?candidate=${next.candidateId}` : ""}`
      : null;

  const STATS: Array<{ value: number; label: string }> = [
    { value: dash.stats.vagasAbertas, label: "Vagas abertas" },
    { value: dash.stats.candidatosAtivos, label: "Candidatos ativos" },
    { value: dash.stats.entrevistasAgendadas, label: "Entrevistas" },
    { value: dash.stats.processosAtivos, label: "Processos" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Painel"
        title={
          <>
            Olá, <span className="marker">{firstName}</span>
          </>
        }
        description="O que precisa da tua atenção hoje."
      />

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Herói — a próxima ação */}
        <section className={`${TILE} flex flex-col lg:row-span-2`}>
          {next ? (
            <>
              <p className="font-medium text-accent-ink text-xs uppercase tracking-[0.16em]">
                A seguir{next.startedAt ? ` · ${relTime(next.startedAt, now)}` : ""}
              </p>
              <p className="mt-3 font-display font-semibold text-4xl text-ink tabular-nums tracking-tight">
                {next.startedAt ? fmtHora.format(next.startedAt) : "—:—"}
              </p>
              <p className="mt-2 font-display font-semibold text-ink text-xl tracking-tight">
                {next.candidateName ?? "Candidato"}
              </p>
              <p className="mt-0.5 text-ink-2 text-sm">{next.jobTitle ?? "Sem vaga"}</p>
              {next.status === "live" ? (
                <span className="mt-3 w-fit">
                  <Chip tone="strong">ao vivo</Chip>
                </span>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                {briefingHref ? (
                  <Link
                    href={briefingHref}
                    className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 font-medium text-on-accent text-sm transition-opacity hover:opacity-90"
                  >
                    <Play size={15} />
                    Iniciar entrevista
                  </Link>
                ) : null}
                {next.candidateId ? (
                  <Link
                    href={`/candidatos/${next.candidateId}`}
                    className="rounded-md border border-line px-4 py-2.5 text-ink-2 text-sm transition-colors hover:border-accent hover:text-ink"
                  >
                    Ver candidato
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-start justify-center gap-1 py-6">
              <p className="font-display font-semibold text-ink text-xl">Agenda livre</p>
              <p className="text-ink-3 text-sm">
                Sem entrevistas agendadas. Bom momento para triar.
              </p>
              <Link href="/vagas" className="mt-2 text-accent-ink text-sm hover:underline">
                Abrir uma vaga
              </Link>
            </div>
          )}
        </section>

        {/* Stats */}
        <section className={`${TILE} grid grid-cols-2 gap-x-4 gap-y-4`}>
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="font-display font-semibold text-3xl text-ink tabular-nums tracking-tight">
                {s.value}
              </p>
              <p className="mt-0.5 text-ink-3 text-xs">{s.label}</p>
            </div>
          ))}
        </section>

        {/* A precisar de atenção */}
        <section className={TILE}>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-ink text-sm">A precisar de atenção</h2>
            <span className="text-ink-3 text-xs">A Vera antecipa</span>
          </div>
          {suggestions.length === 0 ? (
            <p className="py-3 text-ink-3 text-sm">Tudo em dia.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {suggestions.slice(0, 3).map((s) => {
                const Icon = KIND_ICON[s.kind];
                return (
                  <li
                    key={`${s.kind}-${s.ref ?? s.title}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-ink text-[13px]">
                      <Icon size={16} className="shrink-0 text-accent" />
                      <span className="truncate">{s.title}</span>
                    </span>
                    <Chip tone={SEVERITY_TONE[s.severity]}>{SEVERITY_LABEL[s.severity]}</Chip>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Próximas entrevistas */}
        <section className={TILE}>
          <h2 className="font-medium text-ink text-sm">Próximas entrevistas</h2>
          {rest.length === 0 ? (
            <p className="py-3 text-ink-3 text-sm">Sem mais agendadas.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {rest.map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="font-display font-medium text-accent-ink text-sm tabular-nums">
                    {e.startedAt ? fmtHora.format(e.startedAt) : "—:—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink text-[13px]">
                      {e.candidateName ?? "Candidato"}
                    </span>
                    <span className="block truncate text-ink-3 text-[11px]">
                      {e.jobTitle ?? "—"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Vaga à espera */}
        <section className={TILE}>
          <h2 className="font-medium text-ink text-sm">Vagas à espera</h2>
          {espera ? (
            <Link href={`/vagas/${espera.id}`} className="mt-3 block">
              <p className="truncate font-medium text-ink text-[13px]">{espera.title}</p>
              <p className="truncate text-ink-3 text-xs">
                {espera.clientName ?? "Sem cliente"} · {espera.diasAberta}d sem candidatos
              </p>
            </Link>
          ) : (
            <p className="py-3 text-ink-3 text-sm">Todas as vagas já têm candidatos.</p>
          )}
        </section>
      </div>

      {/* Funil */}
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
                Abrir uma vaga
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
                  className="flex w-52 shrink-0 flex-col gap-2 overflow-hidden rounded-card border border-line bg-card"
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
                      <div className="mx-0.5 my-2 h-14 rounded-lg border border-line-subtle border-dashed" />
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
