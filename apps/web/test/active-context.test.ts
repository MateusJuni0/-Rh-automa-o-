import { describe, expect, it } from "vitest";
import {
  type ActiveContext,
  contextNames,
  type KnownEntities,
  parseActiveContext,
  resolveActiveContext,
} from "../lib/assistant/active-context";

const KNOWN: KnownEntities = {
  candidates: [
    { id: "cand-rui-silva", name: "Rui Silva" },
    { id: "cand-rui-costa", name: "Rui Costa" },
    { id: "cand-ana", name: "Ana Marques" },
  ],
  clients: [
    { id: "cli-iris", name: "IRIS Tech" },
    { id: "cli-feedzai", name: "Feedzai" },
  ],
};

describe("resolveActiveContext — foco por menção", () => {
  it("nome completo único → foca esse candidato", () => {
    const r = resolveActiveContext({}, "o que achas do Rui Silva?", KNOWN);
    expect(r.candidate_id).toBe("cand-rui-silva");
  });

  it("primeiro nome ÚNICO → foca (ex.: 'a Ana')", () => {
    const r = resolveActiveContext({}, "marca entrevista com a Ana", KNOWN);
    expect(r.candidate_id).toBe("cand-ana");
  });

  it("primeiro nome AMBÍGUO (2 Ruis) → NÃO foca (não cola ao primeiro)", () => {
    const r = resolveActiveContext({}, "fala-me do Rui", KNOWN);
    expect(r.candidate_id).toBeUndefined();
  });

  it("desambigua o ambíguo com o nome completo", () => {
    const r = resolveActiveContext({}, "o Rui Costa", KNOWN);
    expect(r.candidate_id).toBe("cand-rui-costa");
  });

  it("sem menção → herda (devolve o MESMO objeto)", () => {
    const prev: ActiveContext = { candidate_id: "cand-ana" };
    const r = resolveActiveContext(prev, "e agora, o que sugeres?", KNOWN);
    expect(r).toBe(prev);
  });

  it("menção a cliente foca client_id e preserva o candidato em foco", () => {
    const prev: ActiveContext = { candidate_id: "cand-ana" };
    const r = resolveActiveContext(prev, "como corre o processo com a Feedzai?", KNOWN);
    expect(r.client_id).toBe("cli-feedzai");
    expect(r.candidate_id).toBe("cand-ana");
  });

  it("candidato + cliente na mesma frase → foca ambos", () => {
    const r = resolveActiveContext({}, "põe a Ana no processo da Feedzai", KNOWN);
    expect(r.candidate_id).toBe("cand-ana");
    expect(r.client_id).toBe("cli-feedzai");
  });

  it("muda o foco do candidato anterior para o novo", () => {
    const prev: ActiveContext = { candidate_id: "cand-rui-silva" };
    const r = resolveActiveContext(prev, "agora a Ana", KNOWN);
    expect(r.candidate_id).toBe("cand-ana");
  });

  it("é imutável (não muta o prev)", () => {
    const prev: ActiveContext = { candidate_id: "cand-ana" };
    resolveActiveContext(prev, "a Feedzai", KNOWN);
    expect(prev).toEqual({ candidate_id: "cand-ana" });
  });

  it("não casa por substring (palavra inteira) — 'Aná' dentro de outra palavra não conta", () => {
    const r = resolveActiveContext({}, "preciso de ananases para a festa", KNOWN);
    expect(r.candidate_id).toBeUndefined();
  });
});

describe("parseActiveContext — fronteira", () => {
  it("objeto válido passa", () => {
    expect(parseActiveContext({ candidate_id: "x", client_id: "y" })).toEqual({
      candidate_id: "x",
      client_id: "y",
    });
  });

  it("lixo → {}", () => {
    expect(parseActiveContext(null)).toEqual({});
    expect(parseActiveContext("nope")).toEqual({});
    expect(parseActiveContext({ candidate_id: 123 })).toEqual({});
  });
});

describe("contextNames — nomes em foco p/ o planner", () => {
  it("deriva candidato + cliente dos ids", () => {
    const names = contextNames({ candidate_id: "cand-ana", client_id: "cli-iris" }, KNOWN);
    expect(names).toEqual({ candidatos: ["Ana Marques"], clienteNome: "IRIS Tech" });
  });

  it("id desconhecido (ex.: candidato apagado) → omitido", () => {
    const names = contextNames({ candidate_id: "cand-fantasma" }, KNOWN);
    expect(names).toEqual({});
  });
});
