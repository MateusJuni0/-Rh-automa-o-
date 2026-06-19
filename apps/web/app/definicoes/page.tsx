import { schema } from "@rh/db";
import { Card, Chip } from "@rh/ui";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appEnvironment, RETENTION_DEFAULTS } from "@/lib/definicoes";
import { getSession } from "@/lib/session";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Definições · Vera" };

/** Tela 12 — Definições (Conta · Biometria · RGPD/Retenção · Sobre). Single-tenant IRIS. */
export default async function DefinicoesPage() {
  const { agencyId, recruiterId } = await getSession();
  const [me] = await getDb()
    .select({ name: schema.recruiter.name })
    .from(schema.recruiter)
    .where(and(eq(schema.recruiter.id, recruiterId), eq(schema.recruiter.agencyId, agencyId)));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-8">
      <div>
        <h1 className="font-semibold text-ink text-xl">Definições</h1>
        <p className="text-ink-3 text-sm">Conta, biometria e privacidade.</p>
      </div>

      <Card title="Conta">
        <p className="text-sm text-strong">{me?.name ?? "Utilizador"}</p>
        <p className="mb-3 text-ink-3 text-xs">IRIS Tech · sessão ativa</p>
        <LogoutButton />
      </Card>

      <Card title="Biometria">
        <div className="flex items-center gap-2">
          <Chip tone="accent">Rosto inscrito</Chip>
          <span className="text-ink-3 text-xs">
            demonstração — sem câmara real (chave por ligar)
          </span>
        </div>
        <p className="mt-2 text-ink-3 text-sm">
          O login facial fica disponível quando a IRIS ligar o serviço de biometria.
        </p>
      </Card>

      <Card title="Privacidade & Retenção (RGPD)">
        <p className="mb-3 text-ink-3 text-sm">
          Prazos <strong>sugeridos</strong> — ajustáveis pela IRIS. O direito ao esquecimento apaga
          o candidato e toda a informação ligada.
        </p>
        <ul className="flex flex-col gap-1.5">
          {RETENTION_DEFAULTS.map((r) => (
            <li key={r.label} className="flex items-center justify-between text-sm">
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
    </main>
  );
}
