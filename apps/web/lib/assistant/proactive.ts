/**
 * Proativo (ASSISTENTE-PESSOAL § proativo) — MOCK determinístico. A Vera antecipa: prep antes da
 * entrevista, no-show, garantia a expirar, lacunas por cobrir. Função PURA: `now` é parâmetro
 * (sem Date.now() escondido). O cron/push real é FASE Ω.
 */

export type ProactiveKind = "prep" | "no_show" | "guarantee" | "lacuna";
export type ProactiveSeverity = "info" | "warn" | "urgent";

export type ProactiveEvent =
  | { type: "interview_scheduled"; ref?: string; label?: string; at: number }
  | { type: "interview_no_show"; ref?: string; label?: string }
  | { type: "placement_guarantee"; ref?: string; label?: string; at: number }
  | { type: "profile_gap"; ref?: string; label?: string; count: number };

export interface ProactiveCard {
  kind: ProactiveKind;
  title: string;
  message: string;
  severity: ProactiveSeverity;
  ref?: string;
}

const PREP_WINDOW_MS = 60 * 60 * 1000; // só prepara quando falta < 60 min
const DAY_MS = 24 * 60 * 60 * 1000;
const GUARANTEE_WINDOW_MS = 7 * DAY_MS; // alerta quando a garantia expira em < 7 dias
const GUARANTEE_URGENT_MS = 2 * DAY_MS; // urgente quando < 2 dias

const SEVERITY_RANK: Record<ProactiveSeverity, number> = { urgent: 0, warn: 1, info: 2 };

function withRef(card: Omit<ProactiveCard, "ref">, ref?: string): ProactiveCard {
  return ref ? { ...card, ref } : card;
}

function cardFor(event: ProactiveEvent, now: number): ProactiveCard | null {
  switch (event.type) {
    case "interview_scheduled": {
      const delta = event.at - now;
      if (delta < 0 || delta > PREP_WINDOW_MS) {
        return null; // já passou ou ainda longe
      }
      const mins = Math.max(1, Math.round(delta / 60000));
      return withRef(
        {
          kind: "prep",
          title: `Preparar briefing${event.label ? ` de ${event.label}` : ""}`,
          message: `Entrevista a começar em ${mins} min. Revê o briefing e o guião.`,
          severity: "info",
        },
        event.ref,
      );
    }
    case "interview_no_show": {
      return withRef(
        {
          kind: "no_show",
          title: "Candidato não compareceu",
          message: `${event.label ?? "O candidato"} não entrou na sala. Remarcar ou avisar o cliente?`,
          severity: "warn",
        },
        event.ref,
      );
    }
    case "placement_guarantee": {
      const delta = event.at - now;
      if (delta < 0 || delta > GUARANTEE_WINDOW_MS) {
        return null;
      }
      const dias = Math.max(1, Math.ceil(delta / DAY_MS));
      return withRef(
        {
          kind: "guarantee",
          title: "Garantia a expirar",
          message: `A garantia de ${event.label ?? "uma colocação"} expira em ${dias} dia(s).`,
          severity: delta <= GUARANTEE_URGENT_MS ? "urgent" : "warn",
        },
        event.ref,
      );
    }
    case "profile_gap": {
      if (event.count <= 0) {
        return null;
      }
      return withRef(
        {
          kind: "lacuna",
          title: "Requisitos por cobrir",
          message: `${event.label ?? "Um candidato"} tem ${event.count} requisito(s) sem prova. Sugiro perguntas para fechar.`,
          severity: "info",
        },
        event.ref,
      );
    }
  }
}

/** Constrói os cartões proativos a partir dos eventos, ordenados por severidade (urgente 1.º). */
export function buildProactiveCards(
  events: readonly ProactiveEvent[],
  now: number,
): ProactiveCard[] {
  const cards: ProactiveCard[] = [];
  for (const event of events) {
    const card = cardFor(event, now);
    if (card) {
      cards.push(card);
    }
  }
  return cards.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
