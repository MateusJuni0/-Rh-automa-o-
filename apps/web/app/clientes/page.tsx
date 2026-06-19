import { CreateForm } from "@/components/CreateForm";
import { listClientes } from "@/lib/clientes";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const rows = await listClientes(getDb(), DEV_AGENCY_ID);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-xl">Clientes</h1>
      <CreateForm endpoint="/api/clientes" fields={[{ name: "name", label: "Nome do cliente" }]} />
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {rows.length === 0 ? (
          <li className="px-4 py-3 text-neutral-400 text-sm">Sem clientes ainda.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              {r.name}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
