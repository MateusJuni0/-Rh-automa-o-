import { CreateForm } from "@/components/CreateForm";
import { listCandidatos } from "@/lib/candidatos";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CandidatosPage() {
  const rows = await listCandidatos(getDb(), DEV_AGENCY_ID);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-xl">Candidatos</h1>
      <CreateForm
        endpoint="/api/candidatos"
        fields={[
          { name: "name", label: "Nome do candidato" },
          { name: "cvText", label: "CV (texto)", type: "textarea" },
        ]}
      />
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {rows.length === 0 ? (
          <li className="px-4 py-3 text-neutral-400 text-sm">Sem candidatos ainda.</li>
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
