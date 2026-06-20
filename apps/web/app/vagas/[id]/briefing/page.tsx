import type { BriefingQuestion, RubricCriterion } from "@rh/core";
import { Card, Chip } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateBriefing, getBriefingContext } from "@/lib/briefing";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVaga } from "@/lib/vagas";
import { PageHeader } from "../../../components/PageHeader";
import { StartInterviewButton } from "./StartInterviewButton";

export const dynamic = "force-dynamic";

// As 3 lentes canónicas (@rh/core enum `lente`): tecnica|cliente|gap.
const LENS: ReadonlyArray<{
  key: BriefingQuestion["lente"];
  label: string;
  hint: string;
}> = [
  { key: "tecnica", label: "Técnica", hint: "profundidade real na competência" },
  { key: "cliente", label: "Interesses do cliente", hint: "o que este cliente valoriza" },
  { key: "gap", label: "Lacunas (CV vs vaga)", hint: "o que falta confirmar" },
];

/** Régua inline (fraco/ok/forte) de um requisito, quando a rubric a cobre. */
function Rubric({ criterion }: { criterion: RubricCriterion }) {
  const levels: ReadonlyArray<{
    key: "fraco" | "ok" | "forte";
    label: string;
    tone: "alert" | "muted" | "strong";
    text: string;
  }> = [
    { key: "fraco", label: "Fraco", tone: "alert", text: criterion.fraco },
    { key: "ok", label: "OK", tone: "muted", text: criterion.ok },
    { key: "forte", label: "Forte", tone: "strong", text: criterion.forte },
  ];
  return (
    <dl className="mt-3 grid gap-2 sm:grid-cols-3">
      {levels.map((l) => (
        <div key={l.key} className="rounded-card border border-line-subtle bg-raised p-3">
          <dt className="mb-1.5">
            <Chip tone={l.tone}>{l.label}</Chip>
          </dt>
          <dd className="text-ink-2 text-xs leading-snug">{l.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Uma pergunta: enunciado, gabarito colapsável e, se existir, a régua de avaliação. */
function QuestionItem({
  question,
  index,
  criterion,
}: {
  question: BriefingQuestion;
  index: number;
  criterion: RubricCriterion | undefined;
}) {
  return (
    <li className="border-line-subtle border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0 font-display font-semibold text-accent-ink text-sm tabular-nums">
          {index}.
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ink leading-snug">{question.pergunta}</p>
          <details className="group mt-2">
            <summary className="inline-flex cursor-pointer items-center gap-1.5 text-accent-ink text-xs hover:underline">
              <span className="transition-transform group-open:rotate-90">▸</span>
              Ver boa resposta
            </summary>
            <p className="mt-2 rounded-card border border-line-subtle bg-raised p-3 text-ink-2 text-sm leading-relaxed">
              {question.boaResposta}
            </p>
            {criterion ? <Rubric criterion={criterion} /> : null}
          </details>
        </div>
      </div>
    </li>
  );
}

/** Cartão de uma lente: cabeçalho com contagem + lista de perguntas. */
function LensCard({
  label,
  hint,
  perguntas,
  rubricByReq,
}: {
  label: string;
  hint: string;
  perguntas: BriefingQuestion[];
  rubricByReq: ReadonlyMap<string, RubricCriterion>;
}) {
  if (perguntas.length === 0) {
    return null;
  }
  return (
    <Card
      className="elev elev-top relative"
      title={
        <span className="flex items-baseline gap-2">
          <span>{label}</span>
          <span className="font-normal text-ink-3 text-xs">{hint}</span>
        </span>
      }
      actions={
        <Chip tone="muted">
          {perguntas.length} {perguntas.length === 1 ? "pergunta" : "perguntas"}
        </Chip>
      }
    >
      <ul className="flex flex-col gap-4">
        {perguntas.map((q, i) => (
          <QuestionItem
            key={q.pergunta}
            question={q}
            index={i + 1}
            criterion={q.requisitoId ? rubricByReq.get(q.requisitoId) : undefined}
          />
        ))}
      </ul>
    </Card>
  );
}

/** Pílula de match% — verde forte (alto), neutro (médio), alerta (baixo). */
function MatchPill({ score }: { score: number }) {
  const tone = score >= 70 ? "strong" : score >= 40 ? "muted" : "alert";
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-card border border-line bg-raised px-3 py-2">
      <span className="font-display font-semibold text-2xl text-ink tabular-nums">{score}%</span>
      <Chip tone={tone}>match</Chip>
    </span>
  );
}

/** Tela 5 — Briefing pré-entrevista: roteiro por lente + ▶ Iniciar. Aceita ?candidate=id. */
export default async function BriefingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ candidate?: string }>;
}) {
  const { id } = await params;
  const { candidate: candidateId } = await searchParams;
  const { agencyId } = await getSession();
  const db = getDb();
  const [vaga, briefingResult, contexto] = await Promise.all([
    getVaga(db, agencyId, id),
    generateBriefing(db, agencyId, { jobId: id }),
    getBriefingContext(db, agencyId, id, candidateId),
  ]);
  if (!vaga) {
    notFound();
  }
  const { briefing, rubric } = briefingResult;
  const rubricByReq = new Map(rubric.criteria.map((c) => [c.requisitoId, c]));
  const total = briefing.perguntas.length;
  // O conteúdo é stub (sem chave) quando a boa resposta traz o marcador de demo.
  const isDemo = briefing.perguntas.some((q) => q.pergunta.includes("(demo"));

  return (
    <div className="flex flex-col gap-8">
      <Link href={`/vagas/${id}`} className="text-ink-3 text-xs hover:text-ink-2">
        ← {vaga.title}
      </Link>

      <PageHeader
        eyebrow="Briefing"
        title="Preparação da entrevista"
        description={
          contexto
            ? `Roteiro para entrevistar ${contexto.candidateName}, agrupado por lente.`
            : "Roteiro de perguntas para a vaga, agrupado por lente. Abre cada gabarito antes de entrar."
        }
        action={<StartInterviewButton processId={contexto?.processId} />}
      />

      {/* ── candidato × vaga + match% ── */}
      <section className="elev elev-top relative flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-card p-5">
        <div className="min-w-0">
          {contexto ? (
            <p className="text-ink text-lg leading-tight">
              <span className="font-display font-semibold tracking-tight">
                {contexto.candidateName}
              </span>
              <span className="text-ink-3"> para </span>
              <span className="text-ink-2">{vaga.title}</span>
            </p>
          ) : (
            <p className="text-ink text-lg leading-tight">
              <span className="font-display font-semibold tracking-tight">{vaga.title}</span>
              {vaga.clientName ? <span className="text-ink-3"> · {vaga.clientName}</span> : null}
            </p>
          )}
          <p className="mt-1 text-ink-3 text-sm">
            {total} {total === 1 ? "pergunta" : "perguntas"} em {LENS.length} lentes
          </p>
        </div>
        {contexto ? <MatchPill score={contexto.matchScore} /> : null}
      </section>

      {isDemo ? (
        <p className="text-ink-3 text-xs">
          Conteúdo de demonstração. Liga a chave (OpenRouter) para a Vera gerar o roteiro real a
          partir do CV e do perfil do cliente.
        </p>
      ) : null}

      {LENS.map((l) => (
        <LensCard
          key={l.key}
          label={l.label}
          hint={l.hint}
          rubricByReq={rubricByReq}
          perguntas={briefing.perguntas.filter((q) => q.lente === l.key)}
        />
      ))}
    </div>
  );
}
