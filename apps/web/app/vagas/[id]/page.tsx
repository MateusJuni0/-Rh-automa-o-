import { Card, Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatSalario, type JobDetails } from "@/lib/vaga-details";
import { getVaga, listVagaCandidatos } from "@/lib/vagas";
import { CandidatoAvatar } from "../../components/CandidatoAvatar";
import { ClientLogo } from "../../components/ClientLogo";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  sourced: "Novo",
  screening: "Triado",
  interview: "Entrevistar",
  submitted: "Enviado",
  client_iv: "Entrevista cliente",
  offer: "Oferta",
  placed: "Colocado",
};

function Skills({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "strong" | "muted";
}) {
  return (
    <div>
      <p className="text-ink-3 text-xs uppercase tracking-wide">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((s) => (
            <Chip key={s} tone={tone}>
              {s}
            </Chip>
          ))
        ) : (
          <span className="text-ink-3 text-sm">—</span>
        )}
      </div>
    </div>
  );
}

function Detalhe({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-ink-3 text-xs">{label}</dt>
      <dd className={`mt-0.5 text-sm ${value ? "text-ink" : "text-ink-3 italic"}`}>
        {value ?? "a confirmar"}
      </dd>
    </div>
  );
}

/** Ficha completa da vaga — tudo o que a Filipa precisa para responder ao candidato. */
function VagaFicha({ details: d }: { details: JobDetails }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="elev elev-top relative rounded-card border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-ink text-sm">Condições</h2>
          <span className="text-ink-3 text-xs">o que o candidato costuma perguntar</span>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-3.5 sm:grid-cols-3">
          <Detalhe label="Modelo de trabalho" value={d.modeloTrabalho} />
          <Detalhe label="Local" value={d.localizacao} />
          <Detalhe label="Salário (bruto/ano)" value={formatSalario(d)} />
          <Detalhe label="Horário" value={d.horario} />
          <Detalhe label="Contrato" value={d.contrato} />
          <Detalhe label="Início" value={d.dataInicio} />
          <Detalhe label="Idiomas" value={d.idiomas.length > 0 ? d.idiomas.join(", ") : null} />
          <Detalhe label="Visto / relocation" value={d.visaRelocation} />
          <Detalhe label="Equipa" value={d.equipa} />
        </dl>
      </section>

      {d.responsabilidades.length > 0 ? (
        <section className="elev elev-top relative rounded-card border border-line bg-card p-4">
          <h2 className="font-medium text-ink text-sm">O que vais fazer</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {d.responsabilidades.map((r) => (
              <li key={r} className="flex gap-2.5 text-ink-2 text-sm leading-relaxed">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                />
                {r}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {d.processoEntrevista.length > 0 ? (
          <section className="elev elev-top relative rounded-card border border-line bg-card p-4">
            <h2 className="font-medium text-ink text-sm">Processo de entrevista</h2>
            <ol className="mt-3 flex flex-col gap-2.5">
              {d.processoEntrevista.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-ink-2 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-bg font-display font-semibold text-[11px] text-accent-ink tabular-nums">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {d.beneficios.length > 0 ? (
          <section className="elev elev-top relative rounded-card border border-line bg-card p-4">
            <h2 className="font-medium text-ink text-sm">Benefícios</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {d.beneficios.map((b) => (
                <Chip key={b} tone="muted">
                  {b}
                </Chip>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** Tela 2 — Vaga: cliente + ficha completa + candidatos no funil + requisitos + rubric do cliente. */
export default async function VagaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const db = getDb();
  const vaga = await getVaga(db, agencyId, id);
  if (!vaga) {
    notFound();
  }
  const candidatos = await listVagaCandidatos(db, agencyId, id);
  const { skills, nivel, contexto } = vaga.requirements;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link href="/vagas" className="text-ink-3 text-xs hover:text-ink-2">
          ← Vagas
        </Link>
        <h1 className="font-display font-semibold text-3xl text-ink tracking-tight">
          {vaga.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {vaga.clientId ? (
            <Link
              href={`/clientes/${vaga.clientId}`}
              className="row-link !px-2 !py-1.5"
              aria-label={`Abrir o cliente ${vaga.clientName}`}
            >
              <ClientLogo name={vaga.clientName ?? "?"} logoUrl={vaga.clientLogoUrl} size={28} />
              <span className="font-medium text-ink text-sm">{vaga.clientName}</span>
            </Link>
          ) : (
            <span className="text-ink-2 text-sm">{vaga.clientName ?? "Sem cliente"}</span>
          )}
          {nivel ? <Chip tone="muted">{nivel}</Chip> : null}
          <Chip tone="muted">
            {candidatos.length} {candidatos.length === 1 ? "candidato" : "candidatos"}
          </Chip>
        </div>
        {vaga.clientSector || vaga.clientLocation ? (
          <p className="text-ink-3 text-xs">
            {[vaga.clientSector, vaga.clientLocation].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-4 text-accent-ink text-sm">
          <Link href={`/vagas/${vaga.id}/triagem`} className="hover:underline">
            ▶ Ver triagem
          </Link>
          <Link href={`/vagas/${vaga.id}/briefing`} className="hover:underline">
            ▶ Briefing pré-entrevista
          </Link>
          <Link href={`/vagas/${vaga.id}/editar`} className="text-ink-2 hover:text-ink">
            Editar ficha
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-subtle bg-raised px-3 py-2 text-ink-3 text-xs">
        <span>
          Ficha preenchida pela Vera a partir do pedido do cliente. Revê e completa o que falta.
        </span>
        <Link
          href={`/vagas/${vaga.id}/editar`}
          className="shrink-0 text-accent-ink hover:underline"
        >
          Completar →
        </Link>
      </div>

      <VagaFicha details={vaga.details} />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-ink text-sm">Candidatos nesta vaga</h2>
        {candidatos.length === 0 ? (
          <EmptyState
            title="Ainda ninguém no funil"
            description="Vê a triagem para encontrar candidatos compatíveis e adicioná-los."
            action={
              <Link
                href={`/vagas/${vaga.id}/triagem`}
                className="text-accent-ink text-sm hover:underline"
              >
                ▶ Abrir triagem
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-card">
            <ul className="flex flex-col gap-0.5 p-2">
              {candidatos.map((c) => (
                <li
                  key={c.candidateId}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-raised transition-colors"
                >
                  <CandidatoAvatar id={c.candidateId} name={c.name} size={32} />
                  <Link
                    href={`/candidatos/${c.candidateId}`}
                    className="min-w-0 flex-1 truncate text-ink text-sm hover:text-accent-ink"
                  >
                    {c.name}
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    <Chip tone="muted">{STAGE_LABEL[c.stage] ?? c.stage}</Chip>
                    <Link
                      href={`/vagas/${vaga.id}/briefing?candidate=${c.candidateId}`}
                      className="text-accent-ink text-xs hover:underline"
                    >
                      Briefing →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Card title="Requisitos (extraídos pela Vera)">
        <div className="flex flex-col gap-4">
          <Skills label="Must-have" items={skills.must} tone="strong" />
          <Skills label="Nice-to-have" items={skills.nice} tone="muted" />
          {contexto ? (
            <p className="border-line-subtle border-t pt-3 text-ink-2 text-sm leading-relaxed">
              {contexto}
            </p>
          ) : null}
        </div>
      </Card>

      {vaga.clientCriterios.length > 0 ? (
        <Card title="Critérios do cliente (rubric)">
          <p className="mb-3 text-ink-3 text-xs">
            O que {vaga.clientName ?? "este cliente"} pede sempre, e que pesa na avaliação dos
            candidatos.
          </p>
          <div className="flex flex-wrap gap-2">
            {vaga.clientCriterios
              .filter((c) => c.peso === "must")
              .map((c) => (
                <Chip key={c.criterio} tone="strong">
                  {c.criterio}
                </Chip>
              ))}
            {vaga.clientCriterios
              .filter((c) => c.peso !== "must")
              .map((c) => (
                <Chip key={c.criterio} tone="muted">
                  {c.criterio}
                </Chip>
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
