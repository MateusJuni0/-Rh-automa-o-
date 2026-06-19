import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HudState } from "../src/overlay/types";
import { Hud } from "../src/renderer/hud/Hud";
import type { ChatTurn, HudCallbacks } from "../src/renderer/hud/types";

const noop = () => {};
const callbacks: HudCallbacks = {
  onExpand: noop,
  onCollapse: noop,
  onUsei: noop,
  onPular: noop,
  onStar: noop,
  onEnd: noop,
  onSendChat: noop,
};

function makeState(over: Partial<HudState> = {}): HudState {
  return {
    conn: "live",
    interviewActive: true,
    recording: true,
    suggestion: {
      pergunta: "Como lida com performance em listas grandes?",
      lente: "tecnica",
      requisitoId: "11111111-1111-4111-8111-111111111111",
      porque: "afirmação rasa — falta prova",
    },
    queue: [
      {
        pergunta: "Tem experiência com TypeScript?",
        lente: "tecnica",
        requisitoId: null,
        porque: "x",
      },
    ],
    requisitos: [
      {
        requisitoId: "11111111-1111-4111-8111-111111111111",
        display: "React",
        status: "coberto-com-prova",
      },
      {
        requisitoId: "22222222-2222-4222-8222-222222222222",
        display: "Inglês",
        status: "não-tocado",
      },
      {
        requisitoId: "33333333-3333-4333-8333-333333333333",
        display: "Testes",
        status: "contradito",
      },
    ],
    alerts: ["Antes de terminar: falta confirmar Inglês."],
    resumoCorrente: "",
    lastSeq: 3,
    ...over,
  };
}

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe("Pill (compacto)", () => {
  it("mostra a sugestão em 1 linha, contagem, 🔴 e borda de alerta", () => {
    const out = html(
      <Hud state={makeState()} expanded={false} elapsedMs={0} callbacks={callbacks} />,
    );
    expect(out).toContain("vera-hud-pill--alert");
    expect(out).toContain("Como lida com performance");
    expect(out).toContain("1/3"); // 1 coberto de 3
    expect(out).toContain("🔴");
    expect(out).toContain("vera-hud-drag");
  });

  it("sem sugestão mostra estado calmo", () => {
    const out = html(
      <Hud
        state={makeState({ suggestion: null })}
        expanded={false}
        elapsedMs={0}
        callbacks={callbacks}
      />,
    );
    expect(out).toContain("a ouvir — segue a conversa");
    expect(out).not.toContain("vera-hud-pill--alert");
  });
});

describe("ExpandedPanel", () => {
  it("mostra pergunta + porquê + ações + semáforo + rede de segurança + chat", () => {
    const out = html(
      <Hud
        state={makeState()}
        expanded
        elapsedMs={754_000}
        contexto="Frontend Sr — João Silva"
        callbacks={callbacks}
      />,
    );
    expect(out).toContain("Frontend Sr — João Silva");
    expect(out).toContain("12:34"); // cronómetro
    expect(out).toContain("Como lida com performance");
    expect(out).toContain("falta prova"); // porquê
    expect(out).toContain("Usei");
    expect(out).toContain("Pular");
    // semáforo reusa @rh/ui StateLight (ícones dos estados)
    expect(out).toContain("React");
    expect(out).toContain("✅");
    expect(out).toContain("⚠");
    expect(out).toContain("⬜");
    // rede de segurança
    expect(out).toContain("Antes de terminar");
    // fila
    expect(out).toContain("Tem experiência com TypeScript");
    // chat ao vivo
    expect(out).toContain("Perguntar");
  });

  it("sem sugestão mostra o estado calmo (silêncio é feature)", () => {
    const out = html(
      <Hud
        state={makeState({ suggestion: null, queue: [] })}
        expanded
        elapsedMs={0}
        callbacks={callbacks}
      />,
    );
    expect(out).toContain("no caminho");
    expect(out).not.toContain("Usei");
  });

  it("renderiza o histórico de chat", () => {
    const chat: ChatTurn[] = [
      { id: "1", role: "filipa", text: "já falou de salário?" },
      { id: "2", role: "bot", text: "ainda não (mock)" },
    ];
    const out = html(
      <Hud state={makeState()} expanded elapsedMs={0} chat={chat} callbacks={callbacks} />,
    );
    expect(out).toContain("já falou de salário?");
    expect(out).toContain("ainda não (mock)");
  });
});
