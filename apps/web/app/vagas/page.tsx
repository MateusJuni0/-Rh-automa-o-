import { Chip, EmptyState } from "@rh/ui";
import { CreateForm } from "@/components/CreateForm";
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
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Processos"
        title="Vagas"
        description="Cada vaga arranca de um texto do cliente — a Vera extrai requisitos, rubric e role profile."
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
          <CreateForm
            endpoint="/api/vagas"
            title="Nova vaga"
            description="Cola o pedido do cliente — a extração é automática."
            fields={[
              {
                name: "clientId",
                label: "Cliente",
                type: "select",
                options: clientes.map((c) => ({ value: c.id, label: c.name })),
              },
              { name: "title", label: "Título da vaga" },
              {
                name: "requirementsText",
                label: "Requisitos (texto do cliente)",
                type: "textarea",
              },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
