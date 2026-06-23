import { EmptyState } from "@rh/ui";
import { CandidatoForm } from "@/components/CandidatoForm";
import { listCandidatos } from "@/lib/candidatos";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader } from "../components/PageHeader";
import { CandidatosFilter } from "./CandidatosFilter";

export const dynamic = "force-dynamic";

export default async function CandidatosPage() {
  const { agencyId } = await getSession();
  const rows = await listCandidatos(getDb(), agencyId);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Talento"
        title="Candidatos"
        marker
        description="Os perfis na tua base. Cola um CV e a IRIS extrai competências e experiência."
        stats={[{ value: rows.length, label: rows.length === 1 ? "perfil" : "perfis" }]}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {rows.length === 0 ? (
            <EmptyState
              title="Sem candidatos ainda"
              description="Cola um CV no painel ao lado — a IRIS extrai o perfil automaticamente."
            />
          ) : (
            <CandidatosFilter candidatos={rows} />
          )}
        </div>
        <aside>
          <CandidatoForm />
        </aside>
      </div>
    </div>
  );
}
