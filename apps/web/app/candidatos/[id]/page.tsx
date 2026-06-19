import { Card, Chip } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidato } from "@/lib/candidatos";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Tela 4 — Candidato: CV destrinchado (skills declaradas, experiência, gaps, resumo). */
export default async function CandidatoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const cand = await getCandidato(getDb(), agencyId, id);
  if (!cand) {
    notFound();
  }
  const { skillsDeclaradas, experienciaAnos, gapsCv, resumo } = cand.profile;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/candidatos" className="text-ink-3 text-xs hover:text-ink-2">
          ← Candidatos
        </Link>
        <h1 className="font-semibold text-ink text-xl">{cand.name}</h1>
        <p className="text-ink-2 text-sm">
          {experienciaAnos !== null ? `${experienciaAnos} anos de experiência` : "Experiência n/d"}
          {cand.linkedinUrl ? " · LinkedIn ligado" : ""}
        </p>
      </div>

      {resumo ? (
        <Card title="Resumo">
          <p className="text-ink text-sm leading-relaxed">{resumo}</p>
        </Card>
      ) : null}

      <Card title="Skills declaradas">
        <div className="flex flex-wrap gap-2">
          {skillsDeclaradas.length > 0 ? (
            skillsDeclaradas.map((s) => (
              <Chip key={s} tone="accent">
                {s}
              </Chip>
            ))
          ) : (
            <span className="text-ink-3 text-sm">Nenhuma skill extraída.</span>
          )}
        </div>
      </Card>

      <Card title="Lacunas do CV">
        {gapsCv.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {gapsCv.map((g) => (
              <li key={g} className="text-ink-2 text-sm">
                · {g}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-ink-3 text-sm">Sem lacunas assinaladas.</span>
        )}
      </Card>
    </div>
  );
}
