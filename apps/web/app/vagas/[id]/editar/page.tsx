import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVaga } from "@/lib/vagas";
import { PageHeader } from "../../../components/PageHeader";
import { VagaEditForm } from "./VagaEditForm";

export const dynamic = "force-dynamic";

export default async function EditarVagaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agencyId } = await getSession();
  const vaga = await getVaga(getDb(), agencyId, id);
  if (!vaga) {
    notFound();
  }
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <Link href={`/vagas/${id}`} className="text-ink-3 text-xs hover:text-ink-2">
        ← {vaga.title}
      </Link>
      <PageHeader
        eyebrow="Editar"
        title="Ficha da vaga"
        description="Completa as condições, o processo e as responsabilidades. A Vera preenche o que consegue do pedido do cliente; tu confirmas e completas."
      />
      <VagaEditForm vagaId={vaga.id} details={vaga.details} />
    </div>
  );
}
