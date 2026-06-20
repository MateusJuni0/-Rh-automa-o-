import { Card, Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVaga, listVagaCandidatos } from "@/lib/vagas";
import { ClientLogo } from "../../components/ClientLogo";
import { EntityList, initials } from "../../components/EntityList";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  sourced: "Novo",
  screening: "Triado",
  interview: "Entrevistar",
  submitted: "Enviado",
  client_iv: "Entrevista cliente",
  offer: "Oferta",
  placed: "Colocado",
};

function Skills({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "strong" | "muted";
}) {
  return (
    <div>
      <p className="text-ink-3 text-xs uppercase tracking-wide">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((s) => (
            <Chip key={s} tone={tone}>
              {s}
            </Chip>
          ))
        ) : (
          <span className="text-ink-3 text-sm">—</span>
        )}
      </div>
    </div>
  );
}

/** Tela 2 — Vaga: cliente + candidatos no funil + requisitos extraídos pela Vera. */
export default async function VagaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const db = getDb();
  const vaga = await getVaga(db, agencyId, id);
  if (!vaga) {
    notFound();
  }
  const candidatos = await listVagaCandidatos(db, agencyId, id);
  const { skills, nivel, contexto } = vaga.requirements;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link href="/vagas" className="text-ink-3 text-xs hover:text-ink-2">
          ← Vagas
        </Link>
        <h1 className="font-display font-semibold text-3xl text-ink tracking-tight">
          {vaga.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {vaga.clientId ? (
            <Link
              href={`/clientes/${vaga.clientId}`}
              className="row-link !px-2 !py-1.5"
              aria-label={`Abrir o cliente ${vaga.clientName}`}
            >
              <ClientLogo name={vaga.clientName ?? "?"} logoUrl={vaga.clientLogoUrl} size={28} />
              <span className="font-medium text-ink text-sm">{vaga.clientName}</span>
            </Link>
          ) : (
            <span className="text-ink-2 text-sm">{vaga.clientName ?? "Sem cliente"}</span>
          )}
          {nivel ? <Chip tone="muted">{nivel}</Chip> : null}
          <Chip tone="muted">
            {candidatos.length} {candidatos.length === 1 ? "candidato" : "candidatos"}
          </Chip>
        </div>
        <div className="flex gap-4 text-accent-ink text-sm">
          <Link href={`/vagas/${vaga.id}/triagem`} className="hover:underline">
            ▶ Ver triagem
          </Link>
          <Link href={`/vagas/${vaga.id}/briefing`} className="hover:underline">
            ▶ Briefing pré-entrevista
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-ink text-sm">Candidatos nesta vaga</h2>
        {candidatos.length === 0 ? (
          <EmptyState
            title="Ainda ninguém no funil"
            description="Vê a triagem para encontrar candidatos compatíveis e adicioná-los."
            action={
              <Link
                href={`/vagas/${vaga.id}/triagem`}
                className="text-accent-ink text-sm hover:underline"
              >
                ▶ Abrir triagem
              </Link>
            }
          />
        ) : (
          <EntityList
            rows={candidatos.map((c) => ({
              id: c.candidateId,
              monogram: initials(c.name),
              title: c.name,
              trailing: <Chip tone="muted">{STAGE_LABEL[c.stage] ?? c.stage}</Chip>,
              href: `/candidatos/${c.candidateId}`,
            }))}
          />
        )}
      </section>

      <Card title="Requisitos (extraídos pela Vera)">
        <div className="flex flex-col gap-4">
          <Skills label="Must-have" items={skills.must} tone="strong" />
          <Skills label="Nice-to-have" items={skills.nice} tone="muted" />
          {contexto ? <p className="text-ink-2 text-sm">{contexto}</p> : null}
        </div>
      </Card>
    </div>
  );
}
