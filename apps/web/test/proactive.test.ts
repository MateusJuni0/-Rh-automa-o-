import { describe, expect, it } from "vitest";
import { buildProactiveCards, type ProactiveEvent } from "../lib/assistant/proactive";
import { mockProactiveEvents } from "../lib/assistant/proactive-feed";

const NOW = 1_700_000_000_000;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

describe("buildProactiveCards (proativo mock, puro)", () => {
  it("entrevista a começar em <60min → cartão prep", () => {
    const events: ProactiveEvent[] = [
      { type: "interview_scheduled", label: "Dev (Acme)", at: NOW + 20 * MIN, ref: "v1" },
    ];
    const [card] = buildProactiveCards(events, NOW);
    expect(card?.kind).toBe("prep");
    expect(card?.title).toContain("Dev (Acme)");
    expect(card?.ref).toBe("v1");
  });

  it("entrevista fora da janela (daqui a 3h) → nada", () => {
    const events: ProactiveEvent[] = [{ type: "interview_scheduled", at: NOW + 3 * 60 * MIN }];
    expect(buildProactiveCards(events, NOW)).toHaveLength(0);
  });

  it("no-show → cartão warn", () => {
    const [card] = buildProactiveCards([{ type: "interview_no_show", label: "Carla" }], NOW);
    expect(card?.kind).toBe("no_show");
    expect(card?.severity).toBe("warn");
  });

  it("garantia a expirar em 1 dia → urgente; em 5 dias → warn; em 30 dias → nada", () => {
    expect(
      buildProactiveCards([{ type: "placement_guarantee", at: NOW + 1 * DAY }], NOW)[0]?.severity,
    ).toBe("urgent");
    expect(
      buildProactiveCards([{ type: "placement_guarantee", at: NOW + 5 * DAY }], NOW)[0]?.severity,
    ).toBe("warn");
    expect(
      buildProactiveCards([{ type: "placement_guarantee", at: NOW + 30 * DAY }], NOW),
    ).toHaveLength(0);
  });

  it("lacuna com requisitos por cobrir → cartão; zero → nada", () => {
    expect(buildProactiveCards([{ type: "profile_gap", count: 2 }], NOW)[0]?.kind).toBe("lacuna");
    expect(buildProactiveCards([{ type: "profile_gap", count: 0 }], NOW)).toHaveLength(0);
  });

  it("ordena por severidade (urgente primeiro)", () => {
    const events: ProactiveEvent[] = [
      { type: "profile_gap", count: 1 }, // info
      { type: "placement_guarantee", at: NOW + 1 * DAY }, // urgent
      { type: "interview_no_show" }, // warn
    ];
    const cards = buildProactiveCards(events, NOW);
    expect(cards.map((c) => c.severity)).toEqual(["urgent", "warn", "info"]);
  });

  it("feed mock determinístico → 4 cartões (prep, garantia, no-show, lacuna)", () => {
    const cards = buildProactiveCards(mockProactiveEvents(NOW), NOW);
    expect(cards).toHaveLength(4);
    expect(new Set(cards.map((c) => c.kind))).toEqual(
      new Set(["prep", "guarantee", "no_show", "lacuna"]),
    );
  });
});
