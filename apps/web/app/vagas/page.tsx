import { Chip, EmptyState } from "@rh/ui";
import { VagaForm } from "@/components/VagaForm";
import { listClientes } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listVagas } from "@/lib/vagas";
import { ClientLogo } from "../components/ClientLogo";
import { EntityList } from "../components/EntityList";
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
        description="Cada vaga arranca de um texto do cliente: a Vera extrai requisitos, rubric e role profile."
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
              description="Cola a descrição do cliente no painel ao lado — a Vera extrai os requisitos."
            />
          ) : (
            <EntityList
              title="Vagas abertas"
              rows={vagas.map((v) => ({
                id: v.id,
                leading: <ClientLogo name={v.clientName ?? v.title} logoUrl={v.clientLogoUrl} />,
                title: v.title,
                subtitle: v.clientName ?? "Sem cliente",
                trailing: (
                  <Chip tone={v.numCandidatos === 0 ? "shallow" : "muted"}>
                    {v.numCandidatos === 0
                      ? "à espera"
                      : `${v.numCandidatos} ${v.numCandidatos === 1 ? "candidato" : "candidatos"}`}
                  </Chip>
                ),
                href: `/vagas/${v.id}`,
              }))}
            />
          )}
        </div>
        <aside>
          <VagaForm clientes={clientes.map((c) => ({ id: c.id, name: c.name }))} />
        </aside>
      </div>
    </div>
  );
}
