import { describe, expect, it } from "vitest";
import { createMemoryStore, executeToolCall, requiresConfirmation } from "../lib/assistant/gate";
import { getTool, TOOLS } from "../lib/assistant/tools";

describe("requiresConfirmation", () => {
  it("gravar/enviar_fora pedem confirmação; leitura flui", () => {
    expect(requiresConfirmation("leitura")).toBe(false);
    expect(requiresConfirmation("gravar")).toBe(true);
    expect(requiresConfirmation("enviar_fora")).toBe(true);
  });
});

describe("registo de ferramentas", () => {
  it("classifica os efeitos das ferramentas-chave", () => {
    expect(TOOLS.search_knowledge?.efeito).toBe("leitura");
    expect(TOOLS.gerar_cv?.efeito).toBe("leitura");
    expect(TOOLS.save_memory_fact?.efeito).toBe("gravar");
    expect(TOOLS.sourcing?.efeito).toBe("gravar");
    expect(TOOLS.enviar_email?.efeito).toBe("enviar_fora");
    expect(TOOLS.marcar_agenda?.efeito).toBe("enviar_fora");
    expect(getTool("inexistente")).toBeUndefined();
  });
});

describe("executeToolCall (porta de confirmação + idempotência)", () => {
  it("tool desconhecida nunca executa", () => {
    const out = executeToolCall({ tool: "rm_rf", args: {} }, createMemoryStore());
    expect(out.status).toBe("unknown_tool");
  });

  it("leitura corre sem confirmação", () => {
    const out = executeToolCall({ tool: "search_knowledge", args: {} }, createMemoryStore());
    expect(out.status).toBe("done");
    if (out.status === "done") {
      expect(out.result.summary.length).toBeGreaterThan(0);
    }
  });

  it("gravar sem confirmação → needs_confirm; com confirmação → done", () => {
    const store = createMemoryStore();
    expect(executeToolCall({ tool: "save_memory_fact", args: {} }, store).status).toBe(
      "needs_confirm",
    );
    expect(
      executeToolCall({ tool: "save_memory_fact", args: {}, confirmed: true }, store).status,
    ).toBe("done");
  });

  it("enviar_fora sem confirmação → needs_confirm", () => {
    const out = executeToolCall({ tool: "enviar_email", args: {} }, createMemoryStore());
    expect(out.status).toBe("needs_confirm");
    if (out.status === "needs_confirm") {
      expect(out.efeito).toBe("enviar_fora");
    }
  });

  it("enviar_fora idempotente: a mesma chave não re-executa (anti duplo-envio)", () => {
    const store = createMemoryStore();
    const call = {
      tool: "enviar_email",
      args: { to: "cliente@x.pt" },
      confirmed: true,
      idempotencyKey: "k-1",
    };
    expect(executeToolCall(call, store).status).toBe("done");
    expect(executeToolCall(call, store).status).toBe("duplicate");
  });

  it("gravar também é idempotente (criar 2× não duplica)", () => {
    const store = createMemoryStore();
    const call = { tool: "save_memory_fact", args: {}, confirmed: true, idempotencyKey: "g-1" };
    expect(executeToolCall(call, store).status).toBe("done");
    expect(executeToolCall(call, store).status).toBe("duplicate");
  });
});
