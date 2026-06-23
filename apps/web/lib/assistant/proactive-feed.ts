import type { ProactiveEvent } from "./proactive";

/**
 * Feed MOCK determinístico de eventos proativos (relativo a `now`, como o mockFeed do desktop).
 * v1 sem cron/push real (Ω). Demonstra os 4 tipos de cartão na Home.
 */
export function mockProactiveEvents(now: number): ProactiveEvent[] {
  const MIN = 60 * 1000;
  const DAY = 24 * 60 * MIN;
  return [
    {
      type: "interview_scheduled",
      ref: "vaga-demo",
      label: "Dev Backend (Acme)",
      at: now + 25 * MIN,
    },
    { type: "placement_guarantee", ref: "placement-demo", label: "João → Acme", at: now + 1 * DAY },
    { type: "interview_no_show", ref: "cand-demo", label: "Carla Mendes" },
    { type: "profile_gap", ref: "cand-demo-2", label: "Rui Santos", count: 2 },
  ];
}
