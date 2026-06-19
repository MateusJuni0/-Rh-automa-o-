import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { WsServer, type WsServerHooks } from "../src/index";

const UUID = "11111111-1111-4111-8111-111111111111";

const hooks: WsServerHooks = {
  authenticate(token) {
    return token === "good" ? { ok: true, actorId: "filipa" } : { ok: false, code: 4403 };
  },
};

let server: WsServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function connect(s: WsServer): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${s.port}`);
  await once(ws, "open");
  return ws;
}

describe("WsServer — handshake auth", () => {
  it("auth válido → auth.ok (seq 0) + interview.active (seq 1)", async () => {
    server = await WsServer.start({ hooks });
    const ws = await connect(server);
    const frames: unknown[] = [];
    ws.on("message", (d: { toString(): string }) => frames.push(JSON.parse(d.toString())));

    ws.send(JSON.stringify({ type: "auth", accessToken: "good", interviewId: UUID }));
    await vi.waitFor(() => expect(frames.length).toBe(2));

    expect(frames[0]).toMatchObject({ type: "auth.ok", v: 1, seq: 0 });
    expect(frames[1]).toMatchObject({ type: "interview.active", on: true, seq: 1 });
    ws.close();
  });

  it("token recusado pelo hook → close 4403", async () => {
    server = await WsServer.start({ hooks });
    const ws = await connect(server);
    ws.send(JSON.stringify({ type: "auth", accessToken: "bad", interviewId: UUID }));
    const [code] = (await once(ws, "close")) as [number];
    expect(code).toBe(4403);
  });

  it("1ª mensagem não-auth → close 4401", async () => {
    server = await WsServer.start({ hooks });
    const ws = await connect(server);
    ws.send(JSON.stringify({ type: "ack", lastSeq: 0 }));
    const [code] = (await once(ws, "close")) as [number];
    expect(code).toBe(4401);
  });

  it("auth com token vazio (parse falha) → close 4401", async () => {
    server = await WsServer.start({ hooks });
    const ws = await connect(server);
    ws.send(JSON.stringify({ type: "auth", accessToken: "", interviewId: UUID }));
    const [code] = (await once(ws, "close")) as [number];
    expect(code).toBe(4401);
  });
});
