import { getDb } from "@/lib/db";
import { listPendingIntake } from "@/lib/intake";
import { getSession } from "@/lib/session";
import { PageHeader } from "../components/PageHeader";
import { IntakeInbox } from "./IntakeInbox";

export const dynamic = "force-dynamic";

/** Intake Parte A — porta de segurança na WEB: a IRIS classifica, a Filipa revê e CONFIRMA antes de gravar. */
export default async function IntakePage() {
  const { agencyId } = await getSession();
  const pending = await listPendingIntake(getDb(), agencyId);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Entrada"
        title="Por confirmar"
        marker
        description="Mensagens que a IRIS classificou (Telegram, email, upload). Revê o que ela entendeu e confirma antes de gravar — nada se cria sem o teu OK."
      />
      <IntakeInbox initialPending={pending} />
    </div>
  );
}
