import { Card, Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCliente } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ClientLogo } from "../../components/ClientLogo";
import { EntityList, initials } from "../../components/EntityList";

export const dynamic = "force-dynamic";

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const cliente = await getCliente(getDb(), agencyId, id);
  if (!cliente) {
    notFound();
  }
  const totalCandidatos = cliente.vagas.reduce((sum, v) => sum + v.numCandidatos, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <Link href="/clientes" className="text-ink-3 text-xs hover:text-ink-2">
          ← Clientes
        </Link>
        <div className="flex items-start gap-4">
          <ClientLogo name={cliente.name} logoUrl={cliente.logoUrl} size={56} />
          <div className="min-w-0">
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
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="muted">
            {cliente.vagas.length} {cliente.vagas.length === 1 ? "vaga" : "vagas"}
          </Chip>
          <Chip tone="muted">{totalCandidatos} candidatos no funil</Chip>
        </div>
      </div>

      {cliente.description ? (
        <Card title="Sobre o cliente">
          <p className="text-ink-2 text-sm leading-relaxed">{cliente.description}</p>
        </Card>
      ) : null}

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
