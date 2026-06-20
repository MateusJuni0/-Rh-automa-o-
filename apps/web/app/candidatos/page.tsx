import { EmptyState } from "@rh/ui";
import { CandidatoForm } from "@/components/CandidatoForm";
import { listCandidatos } from "@/lib/candidatos";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { EntityList, initials } from "../components/EntityList";
import { PageHeader } from "../components/PageHeader";

export const dynamic = "force-dynamic";

export default async function CandidatosPage() {
  const { agencyId } = await getSession();
  const rows = await listCandidatos(getDb(), agencyId);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Talento"
        title="Candidatos"
        description="Os perfis na tua base. Cola um CV e a Vera extrai competências e experiência."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {rows.length === 0 ? (
            <EmptyState
              title="Sem candidatos ainda"
              description="Cola um CV no painel ao lado — a Vera extrai o perfil automaticamente."
            />
          ) : (
            <EntityList
              title="Todos os candidatos"
              rows={rows.map((r) => ({
                id: r.id,
                monogram: initials(r.name),
                title: r.name,
                href: `/candidatos/${r.id}`,
              }))}
            />
          )}
        </div>
        <aside>
          <CandidatoForm />
        </aside>
      </div>
    </div>
  );
}
