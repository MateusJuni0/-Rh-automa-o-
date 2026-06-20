import { schema } from "@rh/db";
import { Card, Chip } from "@rh/ui";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appEnvironment, RETENTION_DEFAULTS } from "@/lib/definicoes";
import { getSession } from "@/lib/session";
import { initials } from "../components/EntityList";
import { PageHeader } from "../components/PageHeader";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Definições · Vera" };

/** Tela 12 — Definições (Conta · RGPD/Retenção · Sobre). Single-tenant IRIS. */
export default async function DefinicoesPage() {
  const { agencyId, recruiterId } = await getSession();
  const [me] = await getDb()
    .select({ name: schema.recruiter.name })
    .from(schema.recruiter)
    .where(and(eq(schema.recruiter.id, recruiterId), eq(schema.recruiter.agencyId, agencyId)));

  const name = me?.name ?? "Utilizador";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="Conta"
        title="Definições"
        description="Conta, privacidade e retenção de dados (RGPD)."
      />

      <Card title="Conta">
        <div className="flex items-center gap-3">
          <span className="monogram !size-11 !rounded-xl !text-base" aria-hidden="true">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-ink text-sm">{name}</p>
            <p className="text-ink-3 text-xs">IRIS Tech · sessão ativa</p>
          </div>
        </div>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </Card>

      <Card title="Privacidade & Retenção (RGPD)">
        <p className="mb-4 text-ink-3 text-sm">
          Prazos <strong className="text-ink-2">sugeridos</strong> — ajustáveis pela IRIS. O direito
          ao esquecimento apaga o candidato e toda a informação ligada.
        </p>
        <ul className="flex flex-col">
          {RETENTION_DEFAULTS.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between border-line-subtle border-b py-2.5 text-sm last:border-b-0"
            >
              <span className="text-ink-2">{r.label}</span>
              <Chip tone="muted">{r.valor}</Chip>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Sobre">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-2">Vera v1 · Lince</span>
          <Chip tone="muted">{appEnvironment(process.env.NODE_ENV)}</Chip>
        </div>
      </Card>
    </div>
  );
}
