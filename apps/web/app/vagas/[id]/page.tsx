import { Card, Chip } from "@rh/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVaga } from "@/lib/vagas";

export const dynamic = "force-dynamic";

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

/** Tela 2 — Vaga: requisitos extraídos pela Vera (must/nice como chips). */
export default async function VagaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const vaga = await getVaga(getDb(), agencyId, id);
  if (!vaga) {
    notFound();
  }
  const { skills, nivel, contexto } = vaga.requirements;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/vagas" className="text-ink-3 text-xs hover:text-ink-2">
          ← Vagas
        </Link>
        <h1 className="font-semibold text-ink text-xl">{vaga.title}</h1>
        <p className="text-ink-2 text-sm">
          {vaga.clientName ?? "—"} · {vaga.roleTypeSlug}
          {nivel ? ` · ${nivel}` : ""}
        </p>
      </div>
      <Card title="Requisitos (extraídos pela Vera)">
        <div className="flex flex-col gap-4">
          <Skills label="Must-have" items={skills.must} tone="strong" />
          <Skills label="Nice-to-have" items={skills.nice} tone="muted" />
          {contexto ? <p className="text-ink-2 text-sm">{contexto}</p> : null}
        </div>
      </Card>
    </div>
  );
}
