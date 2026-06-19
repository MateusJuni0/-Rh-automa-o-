import { EmptyState } from "@rh/ui";
import { CreateForm } from "@/components/CreateForm";
import { listCandidatos } from "@/lib/candidatos";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CandidatosPage() {
  const { agencyId } = await getSession();
  const rows = await listCandidatos(getDb(), agencyId);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-ink text-xl">Candidatos</h1>
      <CreateForm
        endpoint="/api/candidatos"
        fields={[
          { name: "name", label: "Nome do candidato" },
          { name: "cvText", label: "CV (texto)", type: "textarea" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Sem candidatos ainda"
          description="Cola um CV acima — a Vera extrai o perfil."
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
