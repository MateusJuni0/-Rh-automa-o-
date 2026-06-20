import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { WsServer, type WsServerHooks } from "../src/index";

const UUID = "11111111-1111-4111-8111-111111111111";

const hooks: WsServerHooks = {
  authenticate() {
    return { ok: true, actorId: "filipa" };
  },
};

let server: WsServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function connectAndAuth(
  s: WsServer,
): Promise<{ ws: WebSocket; frames: { type: string; seq: number }[] }> {
  const ws = new WebSocket(`ws://127.0.0.1:${s.port}`);
  await once(ws, "open");
  const frames: { type: string; seq: number }[] = [];
  ws.on("message", (d: { toString(): string }) => frames.push(JSON.parse(d.toString())));
  ws.send(JSON.stringify({ type: "auth", accessToken: "good", interviewId: UUID }));
  await vi.waitFor(() => expect(frames.length).toBe(2)); // auth.ok seq0 + interview.active seq1
  return { ws, frames };
}

describe("WsServer — replay por ack/lastSeq", () => {
  it("ack {lastSeq} → reenvia só os frames com seq > lastSeq", async () => {
    server = await WsServer.start({ hooks });
    const { ws, frames } = await connectAndAuth(server);

    // 3 frames de servidor pós-handshake → seq 2, 3, 4.
    server.broadcast({ type: "alert", interviewId: UUID, texto: "a" });
    server.broadcast({ type: "alert", interviewId: UUID, texto: "b" });
    server.broadcast({ type: "alert", interviewId: UUID, texto: "c" });
    await vi.waitFor(() => expect(frames.length).toBe(5));
    expect(frames.map((f) => f.seq)).toEqual([0, 1, 2, 3, 4]);

    // Cliente perdeu tudo a partir de seq 2 → pede replay com lastSeq=2.
    ws.send(JSON.stringify({ type: "ack", lastSeq: 2 }));
    await vi.waitFor(() => expect(frames.length).toBe(7));
    // Reenviados: seq 3 e 4 (NÃO o 2, que já fora reconhecido).
    expect(frames.slice(5).map((f) => f.seq)).toEqual([3, 4]);
    expect(frames.slice(5).map((f) => (f as unknown as { texto: string }).texto)).toEqual([
      "b",
      "c",
    ]);
    ws.close();
  });

  it("ack {lastSeq} já no topo → nada a reenviar", async () => {
    server = await WsServer.start({ hooks });
    const { ws, frames } = await connectAndAuth(server);
    server.broadcast({ type: "alert", interviewId: UUID, texto: "x" }); // seq 2
    await vi.waitFor(() => expect(frames.length).toBe(3));

    ws.send(JSON.stringify({ type: "ack", lastSeq: 2 }));
    // Dá tempo a um eventual (errado) reenvio; o total tem de manter-se em 3.
    await new Promise((r) => setTimeout(r, 50));
    expect(frames.length).toBe(3);
    ws.close();
  });
});
