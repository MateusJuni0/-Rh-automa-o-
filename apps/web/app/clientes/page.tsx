import { EmptyState } from "@rh/ui";
import { CreateForm } from "@/components/CreateForm";
import { listClientes } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const { agencyId } = await getSession();
  const rows = await listClientes(getDb(), agencyId);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-ink text-xl">Clientes</h1>
      <CreateForm endpoint="/api/clientes" fields={[{ name: "name", label: "Nome do cliente" }]} />
      {rows.length === 0 ? (
        <EmptyState
          title="Sem clientes ainda"
          description="Cria o primeiro cliente no formulário acima."
        />
      ) : (
        <ul className="divide-y divide-line-subtle rounded-card border border-line bg-card">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-ink text-sm">
              {r.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
