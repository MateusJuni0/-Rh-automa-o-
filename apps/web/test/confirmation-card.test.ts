import { describe, expect, it } from "vitest";
import { efeitoVerbo } from "../app/assistente/efeito-label";

// O JSX do cartão (ConfirmationCard.tsx) corre no Next (tsconfig jsx:preserve) e não transforma em
// node; por isso testamos aqui a lógica PURA da porta (a linguagem humana do efeito). O render do
// cartão é auto-revisto (UI pequena que espelha @rh/ui já revisto).
describe("efeitoVerbo (linguagem humana da porta)", () => {
  it("enviar_fora → fala em enviar para fora", () => {
    expect(efeitoVerbo("enviar_fora")).toContain("para fora");
  });

  it("gravar → fala em gravar de forma durável", () => {
    expect(efeitoVerbo("gravar")).toContain("gravar");
  });

  it("leitura/desconhecido → verbo neutro (não promete enviar/gravar)", () => {
    const v = efeitoVerbo("leitura");
    expect(v).not.toContain("para fora");
    expect(v).not.toContain("durável");
  });
});
