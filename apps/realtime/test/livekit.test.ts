import { describe, expect, it, vi } from "vitest";
import {
  createLiveKitAudioBot,
  LIVEKIT_ENABLED,
  type LiveKitRoom,
  type LiveKitRoomFactory,
} from "../src/livekit";

/** Room fake injetável — guarda handlers e deixa o teste simular conexão, faixas de áudio e quedas. */
function fakeRoom(): {
  room: LiveKitRoom;
  emitAudio: (participant: string, bytes: Uint8Array) => void;
  emitDisconnected: () => void;
  connectedTo?: { url: string; token: string };
  disconnected: boolean;
} {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const state: { connectedTo?: { url: string; token: string }; disconnected: boolean } = {
    disconnected: false,
  };
  const room: LiveKitRoom = {
    on(event, cb) {
      handlers[event] = cb as (...args: unknown[]) => void;
    },
    async connect(url, token) {
      state.connectedTo = { url, token };
    },
    disconnect() {
      state.disconnected = true;
    },
  };
  return {
    room,
    emitAudio: (participant, bytes) => handlers.audioFrame?.(participant, bytes),
    emitDisconnected: () => handlers.disconnected?.(),
    get connectedTo() {
      return state.connectedTo;
    },
    get disconnected() {
      return state.disconnected;
    },
  };
}

describe("LIVEKIT_ENABLED (config-not-code)", () => {
  it("exige URL + apiKey + apiSecret", () => {
    vi.stubEnv("LIVEKIT_URL", "");
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    expect(LIVEKIT_ENABLED()).toBe(false);
    vi.stubEnv("LIVEKIT_URL", "wss://x");
    vi.stubEnv("LIVEKIT_API_KEY", "k");
    vi.stubEnv("LIVEKIT_API_SECRET", "s");
    expect(LIVEKIT_ENABLED()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("createLiveKitAudioBot (transporte de áudio, room mockada)", () => {
  it("conecta à sala com URL + token ao iniciar", async () => {
    const fake = fakeRoom();
    const factory: LiveKitRoomFactory = () => fake.room;
    const bot = createLiveKitAudioBot(
      {
        url: "wss://lk.test",
        apiKey: "k",
        apiSecret: "s",
        room: "entrevista-1",
        identity: "vera-bot",
      },
      factory,
      () => "fake-jwt-token",
    );
    await bot.start();
    expect(fake.connectedTo?.url).toBe("wss://lk.test");
    expect(fake.connectedTo?.token).toBe("fake-jwt-token");
  });

  it("encaminha as frames de áudio recebidas para o handler onAudio", async () => {
    const fake = fakeRoom();
    const got: Array<{ participant: string; bytes: Uint8Array }> = [];
    const bot = createLiveKitAudioBot(
      { url: "wss://x", apiKey: "k", apiSecret: "s", room: "r", identity: "bot" },
      () => fake.room,
      () => "tok",
    );
    bot.onAudio((participant, bytes) => got.push({ participant, bytes }));
    await bot.start();
    fake.emitAudio("candidate-123", new Uint8Array([9, 8, 7]));
    expect(got).toHaveLength(1);
    expect(got[0]?.participant).toBe("candidate-123");
    expect(Array.from(got[0]?.bytes ?? [])).toEqual([9, 8, 7]);
  });

  it("stop desliga da sala", async () => {
    const fake = fakeRoom();
    const bot = createLiveKitAudioBot(
      { url: "wss://x", apiKey: "k", apiSecret: "s", room: "r", identity: "bot" },
      () => fake.room,
      () => "tok",
    );
    await bot.start();
    bot.stop();
    expect(fake.disconnected).toBe(true);
  });

  it("desconexão da sala → chama onError (fail-loud; a queda não fica silenciosa)", async () => {
    const fake = fakeRoom();
    const errors: unknown[] = [];
    const bot = createLiveKitAudioBot(
      {
        url: "wss://x",
        apiKey: "k",
        apiSecret: "s",
        room: "r",
        identity: "bot",
        onError: (e) => errors.push(e),
      },
      () => fake.room,
      () => "tok",
    );
    await bot.start();
    fake.emitDisconnected();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/desligad/i);
  });

  it("ignora uma frame de áudio que não seja Uint8Array (guard de tipo)", async () => {
    const fake = fakeRoom();
    const got: unknown[] = [];
    const bot = createLiveKitAudioBot(
      { url: "wss://x", apiKey: "k", apiSecret: "s", room: "r", identity: "bot" },
      () => fake.room,
      () => "tok",
    );
    bot.onAudio((_p, b) => got.push(b));
    await bot.start();
    // emite "lixo" (não-Uint8Array) → o handler descarta sem rebentar (guard de fronteira).
    fake.emitAudio("x", "não-bytes" as unknown as Uint8Array);
    expect(got).toHaveLength(0);
  });

  it("pipeToSoniox: o áudio da sala alimenta a fonte STT (sendAudio)", async () => {
    const fake = fakeRoom();
    const sent: Uint8Array[] = [];
    const bot = createLiveKitAudioBot(
      { url: "wss://x", apiKey: "k", apiSecret: "s", room: "r", identity: "bot" },
      () => fake.room,
      () => "tok",
    );
    // alvo mínimo: algo com sendAudio (a SonioxTranscriptSource satisfaz isto)
    bot.pipeToSoniox({ sendAudio: (b) => sent.push(b) });
    await bot.start();
    fake.emitAudio("candidate", new Uint8Array([1, 2]));
    expect(sent).toHaveLength(1);
    expect(Array.from(sent[0] ?? [])).toEqual([1, 2]);
  });
});
