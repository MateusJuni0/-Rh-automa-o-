import { EmptyState } from "@rh/ui";
import { CreateForm } from "@/components/CreateForm";
import { listClientes } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { EntityList, initials } from "../components/EntityList";
import { PageHeader } from "../components/PageHeader";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const { agencyId } = await getSession();
  const rows = await listClientes(getDb(), agencyId);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Carteira"
        title="Clientes"
        description="As empresas para quem a IRIS recruta. Cada cliente agrupa as suas vagas e pareceres."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {rows.length === 0 ? (
            <EmptyState
              title="Sem clientes ainda"
              description="Cria o primeiro cliente no painel ao lado para começar a abrir vagas."
            />
          ) : (
            <EntityList
              title="Todos os clientes"
              rows={rows.map((r) => ({ id: r.id, monogram: initials(r.name), title: r.name }))}
            />
          )}
        </div>
        <aside>
          <CreateForm
            endpoint="/api/clientes"
            title="Novo cliente"
            description="Adiciona uma empresa à carteira."
            fields={[{ name: "name", label: "Nome do cliente" }]}
          />
        </aside>
      </div>
    </div>
  );
}
