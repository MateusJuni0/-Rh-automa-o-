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
      <h1 className="font-semibold text-xl">Vagas</h1>
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
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {vagas.length === 0 ? (
          <li className="px-4 py-3 text-neutral-400 text-sm">Sem vagas ainda.</li>
        ) : (
          vagas.map((v) => (
            <li key={v.id} className="flex justify-between px-4 py-3 text-sm">
              <span>{v.title}</span>
              <span className="text-neutral-400">{v.roleTypeSlug}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
