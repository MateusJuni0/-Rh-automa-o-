import { Card, Chip } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getEntrevistaTranscript } from "@/lib/entrevistas";
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

/** Tela Entrevista — transcrição diarizada (Camada A): cada fala com falante + minuto, contradições vs CV à vista. */
export default async function EntrevistaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const db = getDb();
  const t = await getEntrevistaTranscript(db, agencyId, id);
  if (!t) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── cabeçalho ── */}
      <div>
        {t.candidateId ? (
          <Link
            href={`/candidatos/${t.candidateId}`}
            className="text-ink-3 text-xs hover:text-ink-2"
          >
            ← {t.candidateName ?? "Candidato"}
          </Link>
        ) : (
          <Link href="/candidatos" className="text-ink-3 text-xs hover:text-ink-2">
            ← Candidatos
          </Link>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display font-semibold text-ink text-2xl tracking-tight">
            Entrevista — {t.candidateName ?? "Candidato"}
          </h1>
          <Chip tone={t.status === "done" ? "strong" : "muted"}>
            {STATUS_LABEL[t.status] ?? t.status}
          </Chip>
        </div>
        <p className="mt-1 text-ink-2 text-sm">
          {t.jobTitle ? `${t.jobTitle} · ` : ""}
          {fmtData(t.startedAt)}
        </p>
      </div>

      {/* ── contradições vs CV (Verdade vs CV) ── */}
      {t.contradicoes.length > 0 ? (
        <Card title="Verdade vs CV">
          <p className="-mt-1 mb-3 text-ink-3 text-xs">
            Divergências entre o que o CV diz e o que foi dito na entrevista (ancoradas à fala).
          </p>
          <ul className="flex flex-col gap-2">
            {t.contradicoes.map((c) => (
              <li
                key={`${c.requisito}-${c.detalhe}`}
                className="flex items-start gap-2 rounded-md border border-alert/30 bg-alert/5 p-3"
              >
                <span className="mt-0.5 text-alert" aria-hidden="true">
                  ⚠
                </span>
                <div>
                  {c.requisito ? (
                    <p className="font-medium text-ink text-sm">{c.requisito}</p>
                  ) : null}
                  <p className="text-ink-2 text-sm">{c.detalhe}</p>
                  <span className="text-ink-3 text-xs uppercase tracking-wide">
                    {c.tipo === "vs_cv" ? "vs CV" : c.tipo}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── factos destilados desta entrevista ── */}
      {t.factos.length > 0 ? (
        <Card title="O que esta entrevista revelou">
          <ul className="flex flex-col gap-3">
            {t.factos.map((f) => (
              <li
                key={`${f.competencia}-${f.factText}`}
                className="border-line-subtle border-t pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Chip
                    tone={
                      f.factType === "gap"
                        ? "alert"
                        : f.rubricLevel === "forte"
                          ? "strong"
                          : f.rubricLevel === "fraco"
                            ? "alert"
                            : "muted"
                    }
                  >
                    {f.competencia}
                  </Chip>
                  {f.rubricLevel ? (
                    <span className="text-ink-3 text-xs uppercase tracking-wide">
                      {f.rubricLevel}
                    </span>
                  ) : null}
                  {f.evidenceTs ? (
                    <span className="text-ink-3 text-xs">@{f.evidenceTs}</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-ink-2 text-sm leading-relaxed">{f.factText}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── transcrição diarizada ── */}
      <Card title="Transcrição">
        {t.linhas.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {t.linhas.map((l) => {
              const isCand = l.speaker === "candidate";
              const nome = l.speakerLabel ?? (isCand ? (t.candidateName ?? "Candidato") : "Filipa");
              return (
                <li
                  key={l.seq}
                  className={`flex flex-col gap-1 rounded-md p-3 ${
                    l.contradiz
                      ? "border-l-2 border-alert bg-alert/5"
                      : isCand
                        ? "bg-raised"
                        : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium text-xs ${isCand ? "text-accent-ink" : "text-ink-3"}`}
                    >
                      {nome}
                    </span>
                    <span className="font-mono text-ink-3 text-[10px]">{l.ts}</span>
                    {l.contradiz ? (
                      <span className="rounded bg-alert/15 px-1.5 py-0.5 text-[10px] text-alert uppercase tracking-wide">
                        ⚠ vs CV
                      </span>
                    ) : null}
                  </div>
                  <p className="text-ink-2 text-sm leading-relaxed">{l.text}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-ink-2 text-sm">Sem transcrição para esta entrevista.</p>
            <p className="text-ink-3 text-xs">
              {t.status === "scheduled"
                ? "A entrevista ainda não decorreu."
                : "Nenhuma fala foi captada."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
