import { Chip, EmptyState } from "@rh/ui";
import Link from "next/link";
import { CreateForm } from "@/components/CreateForm";
import { listClientes } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ClientLogo } from "../components/ClientLogo";
import { PageHeader } from "../components/PageHeader";

export const dynamic = "force-dynamic";

interface ClienteCardData {
  id: string;
  name: string;
  sector: string | null;
  numVagas: number;
  logoUrl: string | null;
}

/** Cartão de empresa — logo, nome (display), setor e vagas. Substitui a linha de lista. */
function ClienteCard({ c }: { c: ClienteCardData }) {
  return (
    <Link
      href={`/clientes/${c.id}`}
      className="elev elev-top group relative flex flex-col gap-4 rounded-card border border-line bg-card p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-center gap-3">
        <ClientLogo name={c.name} logoUrl={c.logoUrl} size={44} />
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-[15px] text-ink tracking-tight">
            {c.name}
          </p>
          <p className="truncate text-ink-3 text-xs">{c.sector ?? "Setor por definir"}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-line-subtle border-t pt-3">
        <Chip tone="muted">
          {c.numVagas} {c.numVagas === 1 ? "vaga" : "vagas"}
        </Chip>
        <span className="text-ink-3 text-xs transition-colors group-hover:text-accent-ink">
          Abrir →
        </span>
      </div>
    </Link>
  );
}

export default async function ClientesPage() {
  const { agencyId } = await getSession();
  const rows = await listClientes(getDb(), agencyId);
  const totalVagas = rows.reduce((sum, r) => sum + r.numVagas, 0);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Carteira"
        title="Clientes"
        marker
        description="As empresas para quem a IRIS recruta. Abre um cliente para ver o que fazem e as suas vagas."
        stats={[
          { value: rows.length, label: rows.length === 1 ? "empresa" : "empresas" },
          { value: totalVagas, label: totalVagas === 1 ? "vaga" : "vagas" },
        ]}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {rows.length === 0 ? (
            <EmptyState
              title="Sem clientes ainda"
              description="Cria o primeiro cliente no painel ao lado para começar a abrir vagas."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((c) => (
                <ClienteCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
        <aside>
          <CreateForm
            endpoint="/api/clientes"
            title="Novo cliente"
            description="Adiciona uma empresa à carteira."
            fields={[{ name: "name", label: "Nome do cliente" }]}
          />
        </aside>
      </div>
    </div>
  );
}
