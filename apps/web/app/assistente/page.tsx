import { AssistantChat } from "./AssistantChat";

export const metadata = { title: "Assistente · Vera" };

/** Tela 9 — o assistente pessoal da Filipa (chat + artefactos + porta de confirmação). */
export default function AssistentePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 font-semibold text-ink text-xl">Assistente</h1>
      <p className="mb-6 text-ink-3 text-sm">
        O teu copiloto fora da entrevista. Ações que gravam ou enviam para fora pedem confirmação.
      </p>
      <AssistantChat />
    </main>
  );
}
