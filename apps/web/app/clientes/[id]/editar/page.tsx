import Link from "next/link";
import { notFound } from "next/navigation";
import { getCliente } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader } from "../../../components/PageHeader";
import { ClienteEditForm } from "./ClienteEditForm";

export const dynamic = "force-dynamic";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const cliente = await getCliente(getDb(), agencyId, id);
  if (!cliente) {
    notFound();
  }
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <Link href={`/clientes/${id}`} className="text-ink-3 text-xs hover:text-ink-2">
        ← {cliente.name}
      </Link>
      <PageHeader
        eyebrow="Editar"
        title="Ficha do cliente"
        description="Atualiza o que sabemos desta empresa. A Vera também enriquece automaticamente das reuniões."
      />
      <ClienteEditForm cliente={cliente} />
    </div>
  );
}
