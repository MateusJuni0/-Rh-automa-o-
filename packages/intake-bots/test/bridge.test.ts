import { describe, expect, it, vi } from "vitest";
import { createManualMessageSource, runIntakeBridge } from "../src/index";

describe("runIntakeBridge", () => {
  it("entrega cada mensagem da fonte ao handler e pára ao cancelar", async () => {
    const received: string[] = [];
    const { source, push } = createManualMessageSource();
    const stop = runIntakeBridge(source, (m) => {
      received.push(m.text);
    });

    push({ source: "telegram", externalId: "1", text: "olá" });
    push({ source: "whatsapp", externalId: "2", text: "CV anexo" });
    await vi.waitFor(() => expect(received).toHaveLength(2));
    expect(received).toEqual(["olá", "CV anexo"]);

    stop();
    push({ source: "telegram", externalId: "3", text: "depois do stop" });
    expect(received).toHaveLength(2);
  });
});
