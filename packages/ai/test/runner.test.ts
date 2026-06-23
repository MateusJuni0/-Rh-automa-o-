import { describe, expect, it } from "vitest";
import {
  type LlmTransport,
  LlmTransportError,
  type ModelEntry,
  runSlot,
  SlotExhaustedError,
} from "../src/index";

const base = {
  slots: ["LIVE"] as const,
  supportsJson: true,
  supportsTools: true,
  supportsStreaming: true,
  maxContext: 200000,
  zdr: true,
};
const liveA: ModelEntry = { ...base, id: "p/live-a", slots: ["LIVE"] };
const liveB: ModelEntry = { ...base, id: "p/live-b", slots: ["LIVE"] };
const leaky: ModelEntry = { ...base, id: "p/leaky", slots: ["LIVE"], zdr: false };
const registry = [liveA, liveB, leaky];

const req = { messages: [{ role: "user", content: "olá" }] };

/** Transporte mock: comportamento por modelId ('ok'|'transient'|'permanent'). Regista as chamadas. */
function mock(behaviors: Record<string, "ok" | "transient" | "permanent">) {
  const calls: string[] = [];
  const transport: LlmTransport = {
    async complete(modelId) {
      calls.push(modelId);
      const b = behaviors[modelId] ?? "ok";
      if (b === "transient") throw new LlmTransportError("transient", "429", 429);
      if (b === "permanent") throw new LlmTransportError("permanent", "400", 400);
      return { modelId, content: "resposta" };
    },
  };
  return { transport, calls };
}

describe("runSlot — fallback por slot (§5)", () => {
  it("usa o primário quando responde", async () => {
    const { transport, calls } = mock({});
    const r = await runSlot("LIVE", req, {
      registry,
      fallback: { LIVE: [liveA.id, liveB.id] },
      transport,
    });
    expect(r.modelId).toBe(liveA.id);
    expect(calls).toEqual([liveA.id]);
  });

  it("desce ao secundário em falha transitória (429)", async () => {
    const { transport, calls } = mock({ [liveA.id]: "transient" });
    const r = await runSlot("LIVE", req, {
      registry,
      fallback: { LIVE: [liveA.id, liveB.id] },
      transport,
    });
    expect(r.modelId).toBe(liveB.id);
    expect(calls).toEqual([liveA.id, liveB.id]);
  });

  it("salta modelo sem ZDR (fail-closed) sem o chamar", async () => {
    const { transport, calls } = mock({});
    const r = await runSlot("LIVE", req, {
      registry,
      fallback: { LIVE: [leaky.id, liveA.id] },
      transport,
    });
    expect(r.modelId).toBe(liveA.id);
    expect(calls).toEqual([liveA.id]); // leaky NUNCA é chamado
  });

  it("erro permanente propaga (não é SlotExhausted)", async () => {
    const { transport } = mock({ [liveA.id]: "permanent" });
    await expect(
      runSlot("LIVE", req, { registry, fallback: { LIVE: [liveA.id, liveB.id] }, transport }),
    ).rejects.toBeInstanceOf(LlmTransportError);
  });

  it("lista esgotada (todos transitórios) → SlotExhaustedError", async () => {
    const { transport } = mock({ [liveA.id]: "transient", [liveB.id]: "transient" });
    await expect(
      runSlot("LIVE", req, { registry, fallback: { LIVE: [liveA.id, liveB.id] }, transport }),
    ).rejects.toBeInstanceOf(SlotExhaustedError);
  });
});
