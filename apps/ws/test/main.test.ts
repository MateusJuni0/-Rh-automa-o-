import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { signJwt } from "../src/jwt";
import { mockVerifyOwnership, resolveConfig, startFromConfig } from "../src/main";
import type { WsServer } from "../src/server";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("resolveConfig", () => {
  it("lê WS_PORT/WS_JWT_SECRET/DATABASE_URL", () => {
    expect(
      resolveConfig({ WS_PORT: "1234", WS_JWT_SECRET: "s", DATABASE_URL: "postgres://x" }),
    ).toEqual({ port: 1234, secret: "s", databaseUrl: "postgres://x" });
  });
  it("defaults: porta 18792, segredo vazio, sem DATABASE_URL", () => {
    expect(resolveConfig({})).toEqual({ port: 18792, secret: "", databaseUrl: undefined });
  });
  it("DATABASE_URL vazio/espaços → undefined (cai no mock)", () => {
    expect(resolveConfig({ DATABASE_URL: "   " }).databaseUrl).toBeUndefined();
  });
});

describe("mockVerifyOwnership", () => {
  it("par não-vazio → true; vazio → false", () => {
    expect(mockVerifyOwnership("iv", "rec")).toBe(true);
    expect(mockVerifyOwnership("", "rec")).toBe(false);
  });
});

describe("startFromConfig — boot real (JWT HS256 + posse)", () => {
  let server: WsServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("token HS256 válido → auth.ok + interview.active", async () => {
    const secret = "dev-test-secret";
    server = await startFromConfig({ port: 0, secret }, mockVerifyOwnership);
    const token = signJwt({ sub: "filipa", exp: Math.floor(Date.now() / 1000) + 60 }, secret);
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await once(ws, "open");
    const frames: unknown[] = [];
    ws.on("message", (d: { toString(): string }) => frames.push(JSON.parse(d.toString())));
    ws.send(JSON.stringify({ type: "auth", accessToken: token, interviewId: UUID }));
    await vi.waitFor(() => expect(frames.length).toBe(2));
    expect(frames[0]).toMatchObject({ type: "auth.ok" });
    ws.close();
  });

  it("token inválido → close 4401", async () => {
    server = await startFromConfig({ port: 0, secret: "s" }, mockVerifyOwnership);
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await once(ws, "open");
    ws.send(JSON.stringify({ type: "auth", accessToken: "garbage", interviewId: UUID }));
    const [code] = (await once(ws, "close")) as [number];
    expect(code).toBe(4401);
  });
});
