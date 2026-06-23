import { Card, Chip } from "@rh/ui";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { listEntrevistas } from "@/lib/entrevistas";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  live: "Ao vivo",
  done: "Concluída",
  unstructured: "Por estruturar",
};

function fmtData(d: Date | null): string {
  if (!d) {
    return "—";
  }
  return new Date(d).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Lista global de entrevistas — ponto único para chegar à transcrição diarizada por candidato. */
export default async function EntrevistasPage() {
  const { agencyId } = await getSession();
  const db = getDb();
  const entrevistas = await listEntrevistas(db, agencyId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-semibold text-ink text-3xl tracking-tight">Entrevistas</h1>
        <p className="mt-1 text-ink-2 text-sm">
          Todas as entrevistas. Abre uma para ver a transcrição diarizada (falante + minuto) e as
          divergências com o CV.
        </p>
      </div>

      {entrevistas.length > 0 ? (
        <Card title="Todas as entrevistas">
          <ul className="-mx-4 -my-4 divide-y divide-line-subtle">
            {entrevistas.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/entrevistas/${e.id}`}
                    className="font-medium text-ink text-sm hover:text-accent-ink"
                  >
                    {e.candidateName ?? "Candidato"}
                  </Link>
                  <p className="text-ink-3 text-xs">
                    {e.jobTitle ? `${e.jobTitle} · ` : ""}
                    {fmtData(e.startedAt)}
                  </p>
                </div>
                <Chip tone={e.status === "done" ? "strong" : "muted"}>
                  {STATUS_LABEL[e.status] ?? e.status}
                </Chip>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card title="Todas as entrevistas">
          <div className="flex flex-col items-center gap-1 py-10 text-center">
            <p className="text-ink-2 text-sm">Ainda não há entrevistas.</p>
            <p className="text-ink-3 text-xs">
              Quando uma entrevista decorrer, aparece aqui com a transcrição.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
