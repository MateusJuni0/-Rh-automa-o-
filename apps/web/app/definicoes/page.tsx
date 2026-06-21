import { schema } from "@rh/db";
import { Card, Chip, type TabItem } from "@rh/ui";
import { and, eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { AI_ENABLED } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { appEnvironment, RETENTION_DEFAULTS, readModelSlots } from "@/lib/definicoes";
import { getSession } from "@/lib/session";
import { initials } from "../components/EntityList";
import { PageHeader } from "../components/PageHeader";
import { LogoutButton } from "./LogoutButton";
import { SettingsTabs } from "./SettingsTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Definições · Vera" };

const TABS: TabItem[] = [
  { id: "conta", label: "Conta" },
  { id: "ia", label: "Modelos de IA" },
  { id: "calendario", label: "Calendário" },
  { id: "privacidade", label: "Privacidade" },
  { id: "sobre", label: "Sobre" },
];

/** Aviso discreto: a funcionalidade precisa de uma chave para sair do modo demo. */
function DemoHint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-ink-3 text-xs">
      <span aria-hidden="true" className="mt-1 size-1.5 flex-none rounded-full bg-shallow" />
      <span className="max-w-prose">{children}</span>
    </p>
  );
}

/** Tela 12 — Definições (Conta · IA · Calendário · RGPD/Retenção · Sobre). Single-tenant IRIS. */
export default async function DefinicoesPage() {
  const { agencyId, recruiterId } = await getSession();
  const [me] = await getDb()
    .select({ name: schema.recruiter.name })
    .from(schema.recruiter)
    .where(and(eq(schema.recruiter.id, recruiterId), eq(schema.recruiter.agencyId, agencyId)));

  const name = me?.name ?? "Utilizador";
  const slots = readModelSlots(process.env);

  const conta = (
    <Card title="Conta" className="elev elev-top relative">
      <div className="flex items-center gap-3">
        <span className="monogram !size-11 !rounded-xl !text-base" aria-hidden="true">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-ink">{name}</p>
          <p className="text-ink-3 text-xs">IRIS Tech · sessão ativa</p>
        </div>
      </div>
      <div className="mt-5">
        <LogoutButton />
      </div>
    </Card>
  );

  const ia = (
    <Card
      title="Modelos de IA"
      actions={
        <Chip tone={AI_ENABLED ? "accent" : "muted"}>{AI_ENABLED ? "ligada" : "inerte"}</Chip>
      }
      className="elev elev-top relative"
    >
      <p className="mb-5 max-w-prose text-ink-2 text-sm">
        A Vera usa três modelos, um por função. Cada slot só aceita modelos com as capacidades
        certas e com retenção-zero (a transcrição e o CV nunca treinam o modelo).
      </p>

      <ul className="flex flex-col gap-3">
        {slots.map((s) => (
          <li key={s.slot} className="rounded-card border border-line-subtle bg-raised px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-ink tracking-tight">
                    {s.titulo}
                  </span>
                  <Chip tone="shallow">{s.slot}</Chip>
                </div>
                <p className="mt-1 text-ink-2 text-sm">{s.papel}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-line-subtle border-t pt-3">
              <span className="font-mono text-ink-3 text-xs">{s.modelo}</span>
              <span className="text-ink-3 text-xs">{s.requisitos}</span>
            </div>
          </li>
        ))}
      </ul>

      {AI_ENABLED ? null : (
        <div className="mt-5 border-line-subtle border-t pt-4">
          <DemoHint>
            Demo: estes são os modelos sugeridos. Liga a chave OpenRouter para escolher do catálogo
            e ligar a IA a sério.
          </DemoHint>
        </div>
      )}
    </Card>
  );

  const calendario = (
    <Card
      title="Calendário"
      actions={<Chip tone="muted">por ligar</Chip>}
      className="elev elev-top relative"
    >
      <p className="mb-5 max-w-prose text-ink-2 text-sm">
        Liga o Google Calendar para a Vera agendar entrevistas e ler a tua disponibilidade. Fica do
        teu lado: nada é marcado sem a tua confirmação.
      </p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-card border border-line bg-raised px-4 py-2.5 text-ink-3 text-sm"
      >
        Conectar Google Calendar
      </button>
      <div className="mt-4">
        <DemoHint>Demo: liga as credenciais do Google para ativar a ligação.</DemoHint>
      </div>
    </Card>
  );

  const privacidade = (
    <Card title="Privacidade & Retenção (RGPD)" className="elev elev-top relative">
      <p className="mb-4 max-w-prose text-ink-2 text-sm">
        Prazos <strong className="text-ink">sugeridos</strong>, ajustáveis pela IRIS. O direito ao
        esquecimento apaga o candidato e toda a informação ligada.
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
  );

  const sobre = (
    <Card title="Sobre" className="elev elev-top relative">
      <dl className="flex flex-col">
        <div className="flex items-center justify-between border-line-subtle border-b py-2.5 text-sm">
          <dt className="text-ink-2">Produto</dt>
          <dd className="text-ink">Vera v1 · Lince</dd>
        </div>
        <div className="flex items-center justify-between border-line-subtle border-b py-2.5 text-sm">
          <dt className="text-ink-2">Ambiente</dt>
          <dd>
            <Chip tone="muted">{appEnvironment(process.env.NODE_ENV)}</Chip>
          </dd>
        </div>
        <div className="flex items-center justify-between py-2.5 text-sm">
          <dt className="text-ink-2">IA</dt>
          <dd>
            <Chip tone={AI_ENABLED ? "accent" : "muted"}>{AI_ENABLED ? "ligada" : "demo"}</Chip>
          </dd>
        </div>
      </dl>
    </Card>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="Conta"
        title="Definições"
        marker
        description="Conta, modelos de IA, calendário e retenção de dados (RGPD)."
      />
      <SettingsTabs
        items={TABS}
        initial="conta"
        panels={{ conta, ia, calendario, privacidade, sobre }}
      />
    </div>
  );
}
