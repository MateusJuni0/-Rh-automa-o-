import { Card, Chip } from "@rh/ui";
import { Mail, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidato, getCandidatoProcessos } from "@/lib/candidatos";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { CandidatoAvatar } from "../../components/CandidatoAvatar";
import { CandidatoActions } from "./CandidatoActions";

export const dynamic = "force-dynamic";

/** Detecta se a linha é um cabeçalho de secção do CV (ex.: "RESUMO", "EXPERIÊNCIA"). */
function isCvSectionHeader(line: string): boolean {
  const t = line.trim();
  return t.length >= 3 && t.length <= 60 && t === t.toUpperCase() && /[A-Z]/.test(t);
}

/** Renderiza o texto bruto do CV com secções estruturadas (sem `<pre>`). */
function CvSections({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col p-4 text-xs">
      {lines.map((line, i) => {
        const t = line.trim();
        // biome-ignore lint/suspicious/noArrayIndexKey: CV lines are static text — index is the only stable identity
        if (!t) return <div key={`cv-${i}`} className="h-2" />;
        if (isCvSectionHeader(t)) {
          return (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: CV lines are static text — index is the only stable identity
              key={`cv-${i}`}
              className="mt-5 mb-1.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-accent-ink border-b border-line-subtle first:mt-0"
            >
              {t}
            </p>
          );
        }
        if (/^[•·\-*►▪]/.test(t)) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: CV lines are static text — index is the only stable identity
            <p key={`cv-${i}`} className="flex gap-1.5 leading-relaxed text-ink-2 pl-0.5">
              <span className="shrink-0 mt-0.5 text-accent-ink">·</span>
              <span>{t.replace(/^[•·\-*►▪]\s*/, "")}</span>
            </p>
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: CV lines are static text — index is the only stable identity
          <p key={`cv-${i}`} className="leading-relaxed text-ink-2">
            {line}
          </p>
        );
      })}
    </div>
  );
}

const STAGE_LABEL: Record<string, string> = {
  sourced: "Novo",
  screening: "Triado",
  interview: "Entrevistar",
  submitted: "Enviado",
  client_iv: "Entrevista cliente",
  offer: "Oferta",
  placed: "Colocado",
};

/** Tela 4 — Candidato: avatar + CV inline + skills/gaps/resumo + processos ativos. */
export default async function CandidatoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const db = getDb();
  const [cand, processos] = await Promise.all([
    getCandidato(db, agencyId, id),
    getCandidatoProcessos(db, agencyId, id),
  ]);
  if (!cand) {
    notFound();
  }
  const { skillsDeclaradas, experienciaAnos, gapsCv, resumo } = cand.profile;

  return (
    <div className="flex flex-col gap-6">
      {/* ── cabeçalho ── */}
      <div>
        <Link href="/candidatos" className="text-ink-3 text-xs hover:text-ink-2">
          ← Candidatos
        </Link>

        <div className="mt-3 flex items-center gap-4">
          <CandidatoAvatar id={cand.id} name={cand.name} size={72} />
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-ink text-3xl tracking-tight">
              {cand.name}
            </h1>
            <p className="mt-1 text-ink-2 text-sm">
              {experienciaAnos !== null
                ? `${experienciaAnos} anos de experiência`
                : "Experiência n/d"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              {cand.email ? (
                <a
                  href={`mailto:${cand.email}`}
                  className="inline-flex items-center gap-1.5 text-accent-ink hover:underline"
                >
                  <Mail size={14} />
                  {cand.email}
                </a>
              ) : null}
              {cand.phone ? (
                <a
                  href={`tel:${cand.phone.replace(/[\s.-]/g, "")}`}
                  className="inline-flex items-center gap-1.5 text-accent-ink hover:underline"
                >
                  <Phone size={14} />
                  {cand.phone}
                </a>
              ) : null}
              {cand.linkedinUrl ? (
                <a
                  href={cand.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-ink hover:underline"
                >
                  LinkedIn ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <CandidatoActions name={cand.name} cvText={cand.cvText} />
        </div>
      </div>

      {/* ── processos ativos ── */}
      {processos.length > 0 ? (
        <Card title="Vagas em que está">
          <ul className="-mx-4 -my-4 divide-y divide-line-subtle">
            {processos.map((p) => (
              <li key={p.processId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/vagas/${p.jobId}`}
                    className="font-medium text-ink text-sm hover:text-accent-ink"
                  >
                    {p.jobTitle}
                  </Link>
                  {p.clientName ? <p className="text-ink-3 text-xs">{p.clientName}</p> : null}
                </div>
                <Chip tone="muted">{STAGE_LABEL[p.stage] ?? p.stage}</Chip>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── o que as entrevistas (transcrições) já revelaram ── */}
      {cand.factos.length > 0 ? (
        <Card title="O que sabemos das entrevistas">
          <p className="-mt-1 mb-3 text-ink-3 text-xs">
            Extraído automaticamente das transcrições, com a prova (citação + minuto).
          </p>
          <ul className="flex flex-col gap-3">
            {cand.factos.map((f) => (
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
                  {f.factType === "gap" ? <span className="text-alert text-xs">lacuna</span> : null}
                </div>
                <p className="mt-1.5 text-ink-2 text-sm leading-relaxed">{f.factText}</p>
                {f.evidenceQuote ? (
                  <blockquote className="mt-1.5 rounded-md bg-raised p-2.5 text-ink-3 text-xs italic">
                    “{f.evidenceQuote}”{f.evidenceTs ? ` — @${f.evidenceTs}` : ""}
                  </blockquote>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* ── corpo: perfil + CV side-by-side ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_40%]">
        {/* coluna esquerda — perfil extraído */}
        <div className="flex flex-col gap-4">
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
                  <li key={g} className="flex items-start gap-2 text-ink-2 text-sm">
                    <span className="mt-0.5 text-alert">▲</span>
                    {g}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-3 text-sm">Sem lacunas assinaladas.</span>
            )}
          </Card>
        </div>

        {/* coluna direita — CV bruto (visor inline) */}
        <div className="overflow-hidden rounded-card border border-line bg-card">
          <header className="border-line-subtle border-b px-4 py-3">
            <h2 className="font-medium text-ink text-sm">CV — texto original</h2>
            <p className="text-ink-3 text-xs">Extraído automaticamente pela Vera</p>
          </header>
          {cand.cvText ? (
            <div className="h-[480px] overflow-y-auto">
              <CvSections text={cand.cvText} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <span className="text-2xl" aria-hidden="true">
                📄
              </span>
              <p className="text-ink-2 text-sm">Sem CV guardado.</p>
              <p className="text-ink-3 text-xs">
                Cola o texto do CV ao criar o candidato para ver aqui.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
