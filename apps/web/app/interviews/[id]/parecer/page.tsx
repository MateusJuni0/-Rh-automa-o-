import { notFound } from "next/navigation";
import { PageHeader } from "@/app/components/PageHeader";
import { getDb } from "@/lib/db";
import { getInterview } from "@/lib/interviews";
import { gerarParecer, isParecerDemo } from "@/lib/parecer";
import { getSession } from "@/lib/session";
import { ParecerTabs } from "./ParecerTabs";

export const dynamic = "force-dynamic";

/** Tela 7 — Parecer (o "Depois"): abas Interna/Cliente + matriz de critérios + export md. */
export default async function ParecerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const db = getDb();
  const interview = await getInterview(db, agencyId, id);
  if (!interview) {
    notFound();
  }
  const { parecer, candidateName } = await gerarParecer(db, agencyId, { interviewId: id });
  const demo = isParecerDemo(parecer);
  // GET seguro: o route valida o uuid e devolve o markdown guardado (Content-Disposition).
  const exportHref = `/api/parecer?interviewId=${id}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pós-entrevista"
        title="Parecer"
        description={`Leitura interna da Vera sobre ${candidateName}, e a versão polida para enviar ao cliente.`}
      />

      {demo ? (
        <p className="rounded-card border border-line-subtle bg-raised px-4 py-2.5 text-ink-3 text-xs">
          Demo: o parecer abaixo é um esqueleto determinístico. Liga a chave da IA (OpenRouter) para
          a Vera cruzar a entrevista com os critérios do cliente e preencher a matriz.
        </p>
      ) : null}

      <ParecerTabs parecer={parecer} exportHref={exportHref} />
    </div>
  );
}
