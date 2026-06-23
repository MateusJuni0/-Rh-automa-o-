import { Card, Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  type ClienteCriterio,
  type ClienteFacto,
  type ClienteReuniao,
  getCliente,
} from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ClientLogo, clientColor } from "../../components/ClientLogo";
import { EntityList, initials } from "../../components/EntityList";
import { EntityQA } from "../../components/EntityQA";

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

/** Critérios que o cliente pede sempre — viram linhas de rubric. Must em destaque. */
function CriteriosSection({ criterios }: { criterios: ClienteCriterio[] }) {
  if (criterios.length === 0) {
    return null;
  }
  const must = criterios.filter((c) => c.peso === "must");
  const outros = criterios.filter((c) => c.peso !== "must");
  return (
    <section className="elev elev-top relative rounded-card border border-line bg-card p-4">
      <h2 className="font-medium text-ink text-sm">Critérios que pedem sempre</h2>
      <p className="mt-0.5 text-ink-3 text-xs">
        Viram linhas de rubric na avaliação dos candidatos.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {must.map((c) => (
          <Chip key={c.criterio} tone="strong">
            {c.criterio}
          </Chip>
        ))}
        {outros.map((c) => (
          <Chip key={c.criterio} tone="muted">
            {c.criterio}
          </Chip>
        ))}
      </div>
    </section>
  );
}

/** Reuniões/intake com o cliente — nota + excerto da transcrição (colapsável). */
function ReunioesSection({ reunioes }: { reunioes: ClienteReuniao[] }) {
  if (reunioes.length === 0) {
    return null;
  }
  return (
    <section className="elev elev-top relative overflow-hidden rounded-card border border-line bg-card">
      <header className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
        <h2 className="font-medium text-ink text-sm">Reuniões & intake</h2>
        <span className="text-ink-3 text-xs">transcrições</span>
      </header>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {reunioes.map((r) => (
          <li key={r.titulo} className="px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-ink text-sm">{r.titulo}</p>
              {r.data ? <Chip tone="muted">{r.data}</Chip> : null}
            </div>
            {r.excerto ? (
              <details className="mt-2">
                <summary className="cursor-pointer list-none text-accent-ink text-xs hover:underline [&::-webkit-details-marker]:hidden">
                  Ver excerto da transcrição
                </summary>
                <blockquote className="mt-2 rounded-md bg-raised p-3 text-ink-2 text-sm italic leading-relaxed">
                  {r.excerto}
                </blockquote>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
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
          <Link
            href={`/clientes/${cliente.id}/editar`}
            className="absolute top-4 right-4 rounded-md border border-line bg-card px-3 py-1.5 text-ink-2 text-xs transition-colors hover:border-accent hover:text-ink"
          >
            Editar ficha
          </Link>
          <ClientLogo name={cliente.name} logoUrl={cliente.logoUrl} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold text-3xl text-ink tracking-tight">
              {cliente.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {cliente.sector ? <span className="text-ink-2">{cliente.sector}</span> : null}
              {cliente.location ? <span className="text-ink-3">· {cliente.location}</span> : null}
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

      {cliente.location ||
      cliente.founded ||
      cliente.headcount ||
      (cliente.techStack?.length ?? 0) > 0 ||
      cliente.linkedinUrl ? (
        <section className="elev elev-top relative rounded-card border border-line bg-card p-4">
          <h2 className="font-medium text-ink text-sm">Sobre a empresa</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {cliente.location ? (
              <div>
                <dt className="text-ink-3 text-xs">Sede / mercado</dt>
                <dd className="mt-0.5 text-ink text-sm">{cliente.location}</dd>
              </div>
            ) : null}
            {cliente.founded ? (
              <div>
                <dt className="text-ink-3 text-xs">Fundada</dt>
                <dd className="mt-0.5 text-ink text-sm">{cliente.founded}</dd>
              </div>
            ) : null}
            {cliente.headcount ? (
              <div>
                <dt className="text-ink-3 text-xs">Equipa</dt>
                <dd className="mt-0.5 text-ink text-sm">{cliente.headcount}</dd>
              </div>
            ) : null}
          </dl>
          {cliente.techStack && cliente.techStack.length > 0 ? (
            <div className="mt-4">
              <p className="text-ink-3 text-xs">Stack principal</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {cliente.techStack.map((t) => (
                  <Chip key={t} tone="muted">
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          {cliente.linkedinUrl ? (
            <a
              href={cliente.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-accent-ink text-sm hover:underline"
            >
              LinkedIn ↗
            </a>
          ) : null}
        </section>
      ) : null}

      <FactosReuniao factos={cliente.factos} />

      <CriteriosSection criterios={cliente.criterios} />

      <ReunioesSection reunioes={cliente.reunioes} />

      {/* ── Q&A por entidade (Tela 8): perguntar à IRIS sobre este cliente, com prova ── */}
      <Card title={`Perguntar à IRIS sobre ${cliente.name}`}>
        <EntityQA entityType="client" entityId={cliente.id} entityName={cliente.name} />
      </Card>

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
