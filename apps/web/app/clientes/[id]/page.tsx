import { Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ClienteFacto, getCliente } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ClientLogo, clientColor } from "../../components/ClientLogo";
import { EntityList, initials } from "../../components/EntityList";

export const dynamic = "force-dynamic";

const FACT_GROUPS = [
  { type: "preference", label: "Valoriza", tone: "strong" as const, icon: "✓" },
  { type: "rejection_reason", label: "Não aceita", tone: "alert" as const, icon: "✕" },
  { type: "context", label: "Contexto", tone: "muted" as const, icon: "•" },
];

function FactosReuniao({ factos }: { factos: ClienteFacto[] }) {
  const grupos = FACT_GROUPS.map((g) => ({
    ...g,
    items: factos.filter((f) => f.factType === g.type),
  })).filter((g) => g.items.length > 0);
  if (grupos.length === 0) {
    return null;
  }
  return (
    <section className="overflow-hidden rounded-card border border-line bg-card">
      <header className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
        <h2 className="font-medium text-ink text-sm">O que sabemos deste cliente</h2>
        <span className="text-ink-3 text-xs">de reuniões e intake</span>
      </header>
      <div className="grid gap-4 p-4 sm:grid-cols-3">
        {grupos.map((g) => (
          <div key={g.type}>
            <p className="mb-2 flex items-center gap-1.5 font-medium text-ink-2 text-xs uppercase tracking-wide">
              <Chip tone={g.tone}>{g.icon}</Chip>
              {g.label}
            </p>
            <ul className="flex flex-col gap-1.5">
              {g.items.map((f) => (
                <li key={f.factText} className="text-ink text-sm leading-snug">
                  {f.factText}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const cliente = await getCliente(getDb(), agencyId, id);
  if (!cliente) {
    notFound();
  }
  const totalCandidatos = cliente.vagas.reduce((sum, v) => sum + v.numCandidatos, 0);
  const brand = clientColor(cliente.name);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/clientes" className="text-ink-3 text-xs hover:text-ink-2">
        ← Clientes
      </Link>

      {/* ── hero com tint da marca ── */}
      <div className="elev relative overflow-hidden rounded-card border border-line">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${brand} 20%, transparent), transparent 55%)`,
          }}
        />
        <div className="relative flex flex-wrap items-start gap-4 p-6">
          <ClientLogo name={cliente.name} logoUrl={cliente.logoUrl} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold text-3xl text-ink tracking-tight">
              {cliente.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {cliente.sector ? <span className="text-ink-2">{cliente.sector}</span> : null}
              {cliente.website ? (
                <a
                  href={cliente.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-ink hover:underline"
                >
                  ↗ {cliente.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </div>
            {cliente.description ? (
              <p className="mt-3 max-w-prose text-ink-2 text-sm leading-relaxed">
                {cliente.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone="muted">
                {cliente.vagas.length} {cliente.vagas.length === 1 ? "vaga" : "vagas"}
              </Chip>
              <Chip tone="muted">{totalCandidatos} candidatos no funil</Chip>
            </div>
          </div>
        </div>
      </div>

      <FactosReuniao factos={cliente.factos} />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-ink text-sm">Vagas deste cliente</h2>
        {cliente.vagas.length === 0 ? (
          <EmptyState
            title="Sem vagas abertas"
            description="Abre uma vaga para este cliente na página de Vagas."
          />
        ) : (
          <EntityList
            rows={cliente.vagas.map((v) => ({
              id: v.id,
              monogram: initials(v.title),
              title: v.title,
              subtitle: v.roleTypeSlug.replace(/_/g, " "),
              trailing: (
                <Chip tone="muted">
                  {v.numCandidatos} {v.numCandidatos === 1 ? "candidato" : "candidatos"}
                </Chip>
              ),
              href: `/vagas/${v.id}`,
            }))}
          />
        )}
      </section>
    </div>
  );
}
