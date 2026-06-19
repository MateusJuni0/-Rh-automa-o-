import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getInterview } from "@/lib/interviews";
import { gerarParecer } from "@/lib/parecer";
import { getSession } from "@/lib/session";
import { ParecerTabs } from "./ParecerTabs";

export const dynamic = "force-dynamic";

/** Tela 7 — Parecer (o "Depois"): abas Interna/Cliente + export md. */
export default async function ParecerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const db = getDb();
  const interview = await getInterview(db, agencyId, id);
  if (!interview) {
    notFound();
  }
  const { parecer } = await gerarParecer(db, agencyId, { interviewId: id });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-ink text-xl">Parecer</h1>
          <p className="text-ink-2 text-sm">
            Leitura interna da Filipa + versão polida para o cliente.
          </p>
        </div>
        {/* GET seguro: o route valida o uuid e devolve o markdown guardado (Content-Disposition). */}
        <a
          href={`/api/parecer?interviewId=${id}`}
          className="shrink-0 text-accent-ink text-sm hover:underline"
        >
          ⬇ Exportar .md
        </a>
      </div>
      <ParecerTabs parecer={parecer} />
    </div>
  );
}
