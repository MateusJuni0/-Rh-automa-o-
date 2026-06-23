import { Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { VagaForm } from "@/components/VagaForm";
import { listClientes } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listVagas } from "@/lib/vagas";
import { ClientLogo } from "../components/ClientLogo";
import { PageHeader } from "../components/PageHeader";

export const dynamic = "force-dynamic";

export default async function VagasPage() {
  const { agencyId } = await getSession();
  const db = getDb();
  const [vagas, clientes] = await Promise.all([
    listVagas(db, agencyId),
    listClientes(db, agencyId),
  ]);
  const comCandidatos = vagas.filter((v) => v.numCandidatos > 0).length;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Processos"
        title="Vagas"
        marker
        description="Cada vaga arranca de um texto do cliente: a IRIS extrai requisitos, rubric e role profile."
        stats={[
          { value: vagas.length, label: vagas.length === 1 ? "vaga" : "vagas" },
          { value: comCandidatos, label: "ativas" },
        ]}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {vagas.length === 0 ? (
            <EmptyState
              title="Sem vagas ainda"
              description="Cola a descrição do cliente no painel ao lado: a IRIS extrai os requisitos."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {vagas.map((v) => (
                <Link
                  key={v.id}
                  href={`/vagas/${v.id}`}
                  className="elev elev-top group relative flex flex-col gap-3 rounded-card border border-line bg-card p-4 transition-colors hover:border-accent"
                >
                  <div className="flex items-start gap-3">
                    <ClientLogo
                      name={v.clientName ?? v.title}
                      logoUrl={v.clientLogoUrl}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[15px] text-ink">{v.title}</p>
                      <p className="truncate text-ink-3 text-xs">
                        {v.clientName ?? "Sem cliente"}
                        {v.nivel ? ` · ${v.nivel}` : ""}
                      </p>
                    </div>
                    <Chip tone={v.numCandidatos === 0 ? "shallow" : "muted"}>
                      {v.numCandidatos === 0 ? "à espera" : v.numCandidatos}
                    </Chip>
                  </div>
                  {v.must.length > 0 ? (
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {v.must.slice(0, 4).map((s) => (
                        <Chip key={s} tone="muted">
                          {s}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>
        <aside>
          <VagaForm clientes={clientes.map((c) => ({ id: c.id, name: c.name }))} />
        </aside>
      </div>
    </div>
  );
}
