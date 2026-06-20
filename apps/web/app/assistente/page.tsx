import { PageHeader } from "../components/PageHeader";
import { AssistantChat } from "./AssistantChat";

export const metadata = { title: "Assistente · Vera" };

/** Tela 9 — o assistente pessoal da Filipa (chat + artefactos + porta de confirmação). */
export default function AssistentePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Copiloto"
        title="Assistente"
        description="O teu copiloto fora da entrevista. Ações que gravam ou enviam para fora pedem a tua confirmação."
      />
      <AssistantChat />
    </div>
  );
}
