import { describe, expect, it } from "vitest";
import {
  assertRegistryValid,
  type ModelEntry,
  modelEntry,
  type SlotAssignment,
  validateRegistry,
} from "../src/index";

const liveModel: ModelEntry = {
  id: "anthropic/claude-sonnet-4-6",
  slots: ["LIVE", "EXTRACTOR"],
  supportsJson: true,
  supportsTools: true,
  supportsStreaming: true,
  maxContext: 200000,
  zdr: true,
};
const architectModel: ModelEntry = {
  id: "anthropic/claude-opus-4-8",
  slots: ["ARCHITECT"],
  supportsJson: true,
  supportsTools: true,
  supportsStreaming: true,
  maxContext: 200000,
  zdr: true,
};
const extractorModel: ModelEntry = {
  id: "anthropic/claude-haiku-4-5",
  slots: ["EXTRACTOR"],
  supportsJson: true,
  supportsTools: false,
  supportsStreaming: false,
  maxContext: 200000,
  zdr: true,
};

const registry = [liveModel, architectModel, extractorModel];

const validSlots: SlotAssignment = {
  EXTRACTOR: extractorModel.id,
  ARCHITECT: architectModel.id,
  LIVE: liveModel.id,
};

describe("modelEntry — shape", () => {
  it("valida uma entrada completa e rejeita zdr em falta", () => {
    expect(modelEntry.safeParse(liveModel).success).toBe(true);
    const { zdr: _omit, ...semZdr } = liveModel;
    expect(modelEntry.safeParse(semZdr).success).toBe(false);
  });
});

describe("validateRegistry — gate ZDR (§3/§7) e capacidades", () => {
  it("config válida → zero violações", () => {
    expect(validateRegistry(registry, validSlots)).toEqual([]);
  });

  it("modelo sem zdr num slot que vê PII → violação 'sem_zdr' (fail-closed)", () => {
    const naoZdr: ModelEntry = { ...liveModel, id: "x/leaky", zdr: false };
    const v = validateRegistry([...registry, naoZdr], { ...validSlots, LIVE: "x/leaky" });
    expect(v).toContainEqual({ slot: "LIVE", modelId: "x/leaky", reason: "sem_zdr" });
  });

  it("EXTRACTOR sem supportsJson → 'capacidade_em_falta'", () => {
    const semJson: ModelEntry = { ...extractorModel, id: "x/nojson", supportsJson: false };
    const v = validateRegistry([...registry, semJson], { ...validSlots, EXTRACTOR: "x/nojson" });
    expect(v).toContainEqual({
      slot: "EXTRACTOR",
      modelId: "x/nojson",
      reason: "capacidade_em_falta",
    });
  });

  it("LIVE sem streaming → 'capacidade_em_falta'", () => {
    const semStream: ModelEntry = { ...liveModel, id: "x/nostream", supportsStreaming: false };
    const v = validateRegistry([...registry, semStream], { ...validSlots, LIVE: "x/nostream" });
    expect(v).toContainEqual({
      slot: "LIVE",
      modelId: "x/nostream",
      reason: "capacidade_em_falta",
    });
  });

  it("slot a apontar a id inexistente → 'modelo_inexistente'", () => {
    const v = validateRegistry(registry, { ...validSlots, ARCHITECT: "nao/existe" });
    expect(v).toContainEqual({
      slot: "ARCHITECT",
      modelId: "nao/existe",
      reason: "modelo_inexistente",
    });
  });

  it("modelo que não declara o slot → 'slot_nao_declarado'", () => {
    // extractorModel não declara LIVE
    const v = validateRegistry(registry, { ...validSlots, LIVE: extractorModel.id });
    expect(v).toContainEqual({
      slot: "LIVE",
      modelId: extractorModel.id,
      reason: "slot_nao_declarado",
    });
  });
});

describe("assertRegistryValid — gate de deploy", () => {
  it("passa em config válida e lança em violação", () => {
    expect(() => assertRegistryValid(registry, validSlots)).not.toThrow();
    expect(() => assertRegistryValid(registry, { ...validSlots, LIVE: "nao/existe" })).toThrow(
      /deploy bloqueado/,
    );
  });
});
