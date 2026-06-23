import { describe, expect, it, vi } from "vitest";
import {
  createSonioxSource,
  SONIOX_ENABLED,
  type SonioxSocket,
  type SonioxSocketFactory,
  sonioxTokensToChunks,
} from "../src/soniox";

/** Socket fake injetável — guarda os handlers e deixa o teste empurrar mensagens/aberturas/erros. */
function fakeSocket(): {
  socket: SonioxSocket;
  emitOpen: () => void;
  emitMessage: (data: string) => void;
  emitClose: () => void;
  emitError: (err: unknown) => void;
  sent: string[];
  closed: boolean;
} {
  const handlers: Record<string, (arg?: unknown) => void> = {};
  const sent: string[] = [];
  const state = { closed: false };
  const socket: SonioxSocket = {
    on(event, cb) {
      handlers[event] = cb as (arg?: unknown) => void;
    },
    send(data) {
      sent.push(data);
    },
    close() {
      state.closed = true;
    },
  };
  return {
    socket,
    emitOpen: () => handlers.open?.(),
    emitMessage: (data) => handlers.message?.(data),
    emitClose: () => handlers.close?.(),
    emitError: (err) => handlers.error?.(err),
    sent,
    get closed() {
      return state.closed;
    },
  };
}

describe("sonioxTokensToChunks (mapeia tokens diarizados → TranscriptChunk[])", () => {
  it("agrupa tokens 'final' do mesmo speaker num chunk", () => {
    const chunks = sonioxTokensToChunks(
      [
        { text: "olá", speaker: "1", is_final: true },
        { text: " mundo", speaker: "1", is_final: true },
      ],
      "00:01",
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toBe("olá mundo");
    expect(chunks[0]?.ts).toBe("00:01");
  });

  it("mapeia speaker 1 → candidate, 2 → recruiter (config v1 single-tenant)", () => {
    expect(
      sonioxTokensToChunks([{ text: "x", speaker: "1", is_final: true }], "0")[0]?.speaker,
    ).toBe("candidate");
    expect(
      sonioxTokensToChunks([{ text: "x", speaker: "2", is_final: true }], "0")[0]?.speaker,
    ).toBe("recruiter");
  });

  it("troca de speaker a meio → chunks SEPARADOS (não mistura nem atribui ao 1.º falante)", () => {
    const chunks = sonioxTokensToChunks(
      [
        { text: "uso hooks", speaker: "1", is_final: true },
        { text: "e o estado?", speaker: "2", is_final: true },
        { text: " com useReducer", speaker: "1", is_final: true },
      ],
      "00:02",
    );
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ speaker: "candidate", text: "uso hooks" });
    expect(chunks[1]).toMatchObject({ speaker: "recruiter", text: "e o estado?" });
    expect(chunks[2]).toMatchObject({ speaker: "candidate", text: "com useReducer" });
  });

  it("ignora tokens não-finais (só emite transcrição estável)", () => {
    expect(sonioxTokensToChunks([{ text: "parc", speaker: "1", is_final: false }], "0")).toEqual(
      [],
    );
  });

  it("sem tokens finais → []", () => {
    expect(sonioxTokensToChunks([], "0")).toEqual([]);
  });
});

describe("createSonioxSource (adapter STT real, transporte mockado)", () => {
  it("envia a config inicial ao abrir (api_key + modelo + diarização)", () => {
    const fake = fakeSocket();
    const factory: SonioxSocketFactory = () => fake.socket;
    createSonioxSource({ apiKey: "k-test" }, factory);
    fake.emitOpen();
    expect(fake.sent.length).toBeGreaterThan(0);
    const cfg = JSON.parse(fake.sent[0] as string);
    expect(cfg.api_key).toBe("k-test");
    expect(cfg.enable_speaker_diarization ?? cfg.enable_speaker_tags).toBeTruthy();
  });

  it("entrega um TranscriptChunk por mensagem com tokens finais", () => {
    const fake = fakeSocket();
    const src = createSonioxSource({ apiKey: "k" }, () => fake.socket);
    const chunks: unknown[] = [];
    src.subscribe((c) => chunks.push(c));
    fake.emitOpen();
    fake.emitMessage(
      JSON.stringify({ tokens: [{ text: "uso hooks", speaker: "1", is_final: true }] }),
    );
    expect(chunks).toHaveLength(1);
    expect((chunks[0] as { text: string }).text).toBe("uso hooks");
    expect((chunks[0] as { speaker: string }).speaker).toBe("candidate");
  });

  it("não entrega nada para mensagens só com tokens parciais", () => {
    const fake = fakeSocket();
    const src = createSonioxSource({ apiKey: "k" }, () => fake.socket);
    const chunks: unknown[] = [];
    src.subscribe((c) => chunks.push(c));
    fake.emitOpen();
    fake.emitMessage(JSON.stringify({ tokens: [{ text: "par", speaker: "1", is_final: false }] }));
    expect(chunks).toHaveLength(0);
  });

  it("mensagem inválida (JSON partido) → não rebenta nem entrega", () => {
    const fake = fakeSocket();
    const src = createSonioxSource({ apiKey: "k" }, () => fake.socket);
    const chunks: unknown[] = [];
    src.subscribe((c) => chunks.push(c));
    fake.emitOpen();
    expect(() => fake.emitMessage("{partido")).not.toThrow();
    expect(chunks).toHaveLength(0);
  });

  it("sendAudio encaminha bytes para o socket; close fecha", () => {
    const fake = fakeSocket();
    const src = createSonioxSource({ apiKey: "k" }, () => fake.socket);
    fake.emitOpen();
    const before = fake.sent.length;
    src.sendAudio(new Uint8Array([1, 2, 3]));
    expect(fake.sent.length).toBe(before + 1);
    src.close();
    expect(fake.closed).toBe(true);
  });

  it("o unsubscribe deixa de receber chunks", () => {
    const fake = fakeSocket();
    const src = createSonioxSource({ apiKey: "k" }, () => fake.socket);
    const chunks: unknown[] = [];
    const off = src.subscribe((c) => chunks.push(c));
    fake.emitOpen();
    off();
    fake.emitMessage(JSON.stringify({ tokens: [{ text: "x", speaker: "1", is_final: true }] }));
    expect(chunks).toHaveLength(0);
  });

  it("erro do WS → chama onError (fail-loud; ex.: chave inválida não fica silenciosa)", () => {
    const fake = fakeSocket();
    const errors: unknown[] = [];
    createSonioxSource({ apiKey: "k", onError: (e) => errors.push(e) }, () => fake.socket);
    fake.emitError(new Error("auth rejected"));
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe("auth rejected");
  });

  it("close pelo servidor → chama onError (a fonte não emudece em silêncio)", () => {
    const fake = fakeSocket();
    const errors: unknown[] = [];
    createSonioxSource({ apiKey: "k", onError: (e) => errors.push(e) }, () => fake.socket);
    fake.emitClose();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/fechad/i);
  });
});

describe("SONIOX_ENABLED (config-not-code)", () => {
  it("reflete a presença de SONIOX_API_KEY", () => {
    vi.stubEnv("SONIOX_API_KEY", "");
    expect(SONIOX_ENABLED()).toBe(false);
    vi.stubEnv("SONIOX_API_KEY", "k-xyz");
    expect(SONIOX_ENABLED()).toBe(true);
    vi.unstubAllEnvs();
  });
});
