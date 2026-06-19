import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { createWsAuthenticate, signJwt, WsServer } from "../src/index";

const SECRET = "dev-secret-not-real";
const NOW = 1_000_000;
const IID = "11111111-1111-4111-8111-111111111111";
const REC = "22222222-2222-4222-8222-222222222222";

const now = () => NOW * 1000;
const token = (sub: string, exp = NOW + 100) => signJwt({ sub, exp }, SECRET);

describe("createWsAuthenticate (unidade)", () => {
  it("JWT válido + posse → ok", async () => {
    const auth = createWsAuthenticate({ secret: SECRET, verifyOwnership: () => true, now });
    expect(await auth(token(REC), IID)).toEqual({ ok: true, actorId: REC });
  });

  it("sem segredo → 4401", async () => {
    const auth = createWsAuthenticate({ secret: "", verifyOwnership: () => true, now });
    expect(await auth(token(REC), IID)).toMatchObject({ ok: false, code: 4401 });
  });

  it("JWT inválido/expirado → 4401", async () => {
    const auth = createWsAuthenticate({ secret: SECRET, verifyOwnership: () => true, now });
    expect(await auth("lixo", IID)).toMatchObject({ ok: false, code: 4401 });
    expect(await auth(token(REC, NOW - 1), IID)).toMatchObject({ ok: false, code: 4401 });
  });

  it("sem posse → 4403", async () => {
    const auth = createWsAuthenticate({ secret: SECRET, verifyOwnership: () => false, now });
    expect(await auth(token(REC), IID)).toMatchObject({ ok: false, code: 4403 });
  });

  it("erro na verificação de posse → 4401 (fail-closed)", async () => {
    const auth = createWsAuthenticate({
      secret: SECRET,
      now,
      verifyOwnership: () => {
        throw new Error("db down");
      },
    });
    expect(await auth(token(REC), IID)).toMatchObject({ ok: false, code: 4401 });
  });

  it("passa o interviewId+recruiterId à verificação de posse", async () => {
    const seen: Array<[string, string]> = [];
    const auth = createWsAuthenticate({
      secret: SECRET,
      now,
      verifyOwnership: (iid, rid) => {
        seen.push([iid, rid]);
        return true;
      },
    });
    await auth(token(REC), IID);
    expect(seen).toEqual([[IID, REC]]);
  });
});

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

describe("WsServer com auth real (socket localhost)", () => {
  it("JWT válido + posse → auth.ok", async () => {
    server = await WsServer.start({
      hooks: {
        authenticate: createWsAuthenticate({ secret: SECRET, verifyOwnership: () => true, now }),
      },
    });
    const ws = await connect(server);
    const frames: unknown[] = [];
    ws.on("message", (d: { toString(): string }) => frames.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: "auth", accessToken: token(REC), interviewId: IID }));
    await vi.waitFor(() => expect(frames.length).toBe(2));
    expect(frames[0]).toMatchObject({ type: "auth.ok", seq: 0 });
    ws.close();
  });

  it("JWT inválido → close 4401", async () => {
    server = await WsServer.start({
      hooks: {
        authenticate: createWsAuthenticate({ secret: SECRET, verifyOwnership: () => true, now }),
      },
    });
    const ws = await connect(server);
    ws.send(JSON.stringify({ type: "auth", accessToken: "forjado", interviewId: IID }));
    const [code] = (await once(ws, "close")) as [number];
    expect(code).toBe(4401);
  });

  it("sem posse → close 4403", async () => {
    server = await WsServer.start({
      hooks: {
        authenticate: createWsAuthenticate({ secret: SECRET, verifyOwnership: () => false, now }),
      },
    });
    const ws = await connect(server);
    ws.send(JSON.stringify({ type: "auth", accessToken: token(REC), interviewId: IID }));
    const [code] = (await once(ws, "close")) as [number];
    expect(code).toBe(4403);
  });

  it("mensagem gigante pré-auth → close 4401 (anti-DoS)", async () => {
    server = await WsServer.start({
      hooks: {
        authenticate: createWsAuthenticate({ secret: SECRET, verifyOwnership: () => true, now }),
      },
    });
    const ws = await connect(server);
    ws.send("x".repeat(9000));
    const [code] = (await once(ws, "close")) as [number];
    expect(code).toBe(4401);
  });
});
