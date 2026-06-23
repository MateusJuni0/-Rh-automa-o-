import { listMemoryFacts } from "@/lib/assistant/memory";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader } from "../components/PageHeader";
import { OnboardingFlow } from "./OnboardingFlow";

export const dynamic = "force-dynamic";

/** Tela 11 — Onboarding (1º uso): a IRIS aprende o estilo/preferências do recrutador (conversa, não form). */
export default async function OnboardingPage() {
  const { agencyId, recruiterId } = await getSession();
  const facts = await listMemoryFacts(getDb(), agencyId, recruiterId, { limit: 100 });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Primeiros passos"
        title="Conhece-te"
        marker
        description="Quanto mais a IRIS souber do teu estilo e do que valorizas, melhor te ajuda em tudo. Responde ao que quiseres — podes saltar e voltar aqui quando quiseres."
      />
      <OnboardingFlow initialFacts={facts} />
    </div>
  );
}
