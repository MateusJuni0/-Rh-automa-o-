import { Chip, EmptyState } from "@rh/ui";
import { CreateForm } from "@/components/CreateForm";
import { listClientes } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listVagas } from "@/lib/vagas";

export const dynamic = "force-dynamic";

export default async function VagasPage() {
  const { agencyId } = await getSession();
  const db = getDb();
  const [vagas, clientes] = await Promise.all([
    listVagas(db, agencyId),
    listClientes(db, agencyId),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-ink text-xl">Vagas</h1>
      <CreateForm
        endpoint="/api/vagas"
        fields={[
          {
            name: "clientId",
            label: "Cliente",
            type: "select",
            options: clientes.map((c) => ({ value: c.id, label: c.name })),
          },
          { name: "title", label: "Título da vaga" },
          { name: "requirementsText", label: "Requisitos (texto do cliente)", type: "textarea" },
        ]}
      />
      {vagas.length === 0 ? (
        <EmptyState
          title="Sem vagas ainda"
          description="Cola a descrição do cliente acima — a Vera extrai os requisitos."
        />
      ) : (
        <ul className="divide-y divide-line-subtle rounded-card border border-line bg-card">
          {vagas.map((v) => (
            <li key={v.id} className="flex items-center justify-between px-4 py-3 text-ink text-sm">
              <span>{v.title}</span>
              <Chip tone="muted">{v.roleTypeSlug}</Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
