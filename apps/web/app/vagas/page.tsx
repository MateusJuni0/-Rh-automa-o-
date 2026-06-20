import { EmptyState } from "@rh/ui";
import { CreateForm } from "@/components/CreateForm";
import { listClientes } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listVagas } from "@/lib/vagas";
import { EntityList, initials } from "../components/EntityList";
import { PageHeader } from "../components/PageHeader";

export const dynamic = "force-dynamic";

/** Slug do tipo de função → etiqueta legível (ex.: dev_frontend_react_pleno → "dev frontend react pleno"). */
function humanizeSlug(slug: string): string {
  return slug.replace(/_/g, " ");
}

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
                monogram: initials(v.title),
                title: v.title,
                subtitle: humanizeSlug(v.roleTypeSlug),
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
