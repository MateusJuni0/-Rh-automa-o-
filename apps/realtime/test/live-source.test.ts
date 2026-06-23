import { describe, expect, it } from "vitest";
import { buildLiveTranscriptSource } from "../src/live-source";
import type { LiveKitRoom } from "../src/livekit";
import type { SonioxSocket } from "../src/soniox";
import type { TranscriptChunk } from "../src/source";

/** Socket Soniox fake (config inicial + mensagens + áudio enviado). */
function fakeSocket(): {
  socket: SonioxSocket;
  emitOpen: () => void;
  emitMessage: (data: string) => void;
  sent: string[];
  closed: boolean;
} {
  const handlers: Record<string, (arg?: unknown) => void> = {};
  const sent: string[] = [];
  const state = { closed: false };
  const socket: SonioxSocket = {
    on: (event, cb) => {
      handlers[event] = cb as (arg?: unknown) => void;
    },
    send: (data) => {
      sent.push(data);
    },
    close: () => {
      state.closed = true;
    },
  };
  return {
    socket,
    emitOpen: () => handlers.open?.(),
    emitMessage: (data) => handlers.message?.(data),
    sent,
    get closed() {
      return state.closed;
    },
  };
}

/** Room LiveKit fake (conexão + frames de áudio). */
function fakeRoom(): {
  room: LiveKitRoom;
  emitAudio: (participant: string, bytes: Uint8Array) => void;
  disconnected: boolean;
} {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const state = { disconnected: false };
  const room: LiveKitRoom = {
    on: (event, cb) => {
      handlers[event] = cb as (...args: unknown[]) => void;
    },
    connect: async () => {},
    disconnect: () => {
      state.disconnected = true;
    },
  };
  return {
    room,
    emitAudio: (participant, bytes) => handlers.audioFrame?.(participant, bytes),
    get disconnected() {
      return state.disconnected;
    },
  };
}

describe("buildLiveTranscriptSource (compõe LiveKit→Soniox numa TranscriptSource)", () => {
  it("o áudio da sala flui para o STT, e a transcrição final chega à fonte (ponta-a-ponta)", async () => {
    const socket = fakeSocket();
    const room = fakeRoom();
    const live = buildLiveTranscriptSource(
      {
        soniox: { apiKey: "k" },
        livekit: { url: "wss://x", apiKey: "k", apiSecret: "s", room: "r", identity: "bot" },
      },
      {
        socketFactory: () => socket.socket,
        roomFactory: () => room.room,
        tokenFactory: () => "tok",
      },
    );

    const chunks: TranscriptChunk[] = [];
    live.source.subscribe((c) => chunks.push(c));
    await live.start();
    socket.emitOpen(); // config inicial da Soniox
    const sentAfterConfig = socket.sent.length;

    // 1) uma frame de áudio na sala → encaminhada para o STT (LiveKit → Soniox).
    room.emitAudio("candidate-1", new Uint8Array([1, 2, 3]));
    expect(socket.sent.length).toBe(sentAfterConfig + 1);

    // 2) a Soniox devolve tokens finais → a fonte emite o chunk (Soniox → source).
    socket.emitMessage(
      JSON.stringify({ tokens: [{ text: "uso hooks", speaker: "1", is_final: true }] }),
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ speaker: "candidate", text: "uso hooks" });
  });

  it("stop() desliga a sala E fecha o STT", async () => {
    const socket = fakeSocket();
    const room = fakeRoom();
    const live = buildLiveTranscriptSource(
      {
        soniox: { apiKey: "k" },
        livekit: { url: "wss://x", apiKey: "k", apiSecret: "s", room: "r", identity: "bot" },
      },
      {
        socketFactory: () => socket.socket,
        roomFactory: () => room.room,
        tokenFactory: () => "tok",
      },
    );
    await live.start();
    live.stop();
    expect(room.disconnected).toBe(true);
    expect(socket.closed).toBe(true);
  });
});
