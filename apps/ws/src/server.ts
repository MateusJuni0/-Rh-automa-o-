import { once } from "node:events";
import { type WebSocket, WebSocketServer } from "ws";
import { FrameSession, parseClientMessage, type ServerFramePayload } from "./codec";

/** Resultado da autenticação de uma ligação WS. code: 4401 (não autenticado) | 4403 (sem posse). */
export interface AuthResult {
  ok: boolean;
  code?: 4401 | 4403;
  actorId?: string;
}

export interface WsServerHooks {
  /**
   * Valida o JWT + posse da entrevista (cobre `can_join_interview`). Em dev é um stub;
   * o real liga ao Supabase Auth + `can_join_interview` (AUTH-CONTRACT). NUNCA chamar Supabase aqui.
   */
  authenticate(accessToken: string, interviewId: string): Promise<AuthResult> | AuthResult;
}

interface ConnState {
  authed: boolean;
  session: FrameSession;
  interviewId: string;
  actorId: string | undefined;
  lastAck: number;
}

/**
 * Servidor WebSocket do painel/overlay. 1ª mensagem TEM de ser `auth` (JWT no corpo, AUTENTICACAO §4);
 * recusa = close 44xx. Cada ligação tem um `FrameSession` (seq monótono p/ replay/ack).
 */
export class WsServer {
  readonly #wss: WebSocketServer;
  readonly #hooks: WsServerHooks;

  private constructor(wss: WebSocketServer, hooks: WsServerHooks) {
    this.#wss = wss;
    this.#hooks = hooks;
    this.#wss.on("connection", (sock: WebSocket) => this.#onConnection(sock));
  }

  static async start(opts: { port?: number; hooks: WsServerHooks }): Promise<WsServer> {
    const wss = new WebSocketServer({ port: opts.port ?? 0, host: "127.0.0.1" });
    await once(wss, "listening");
    return new WsServer(wss, opts.hooks);
  }

  /** Porta TCP atribuída (útil para testes com porto efémero). */
  get port(): number {
    const addr = this.#wss.address();
    if (addr === null || typeof addr === "string") {
      throw new Error("servidor WS sem porta TCP");
    }
    return addr.port;
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#wss.close((err) => (err ? reject(err) : resolve()));
    });
  }

  #onConnection(sock: WebSocket): void {
    const state: ConnState = {
      authed: false,
      session: new FrameSession(),
      interviewId: "",
      actorId: undefined,
      lastAck: 0,
    };
    sock.on("message", (data: { toString(): string }) => {
      void this.#onMessage(sock, state, data.toString());
    });
  }

  async #onMessage(sock: WebSocket, state: ConnState, raw: string): Promise<void> {
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      if (!state.authed) {
        sock.close(4401, "auth requerido");
      }
      return;
    }
    const msg = parsed.value;

    if (!state.authed) {
      if (msg.type !== "auth") {
        sock.close(4401, "auth requerido");
        return;
      }
      const result = await this.#hooks.authenticate(msg.accessToken, msg.interviewId);
      if (!result.ok) {
        sock.close(result.code ?? 4401, "auth recusado");
        return;
      }
      state.authed = true;
      state.interviewId = msg.interviewId;
      state.actorId = result.actorId;
      this.#send(sock, state, { type: "auth.ok" });
      this.#send(sock, state, { type: "interview.active", interviewId: msg.interviewId, on: true });
      return;
    }

    if (msg.type === "ack") {
      state.lastAck = msg.lastSeq;
    }
  }

  #send(sock: WebSocket, state: ConnState, payload: ServerFramePayload): void {
    sock.send(JSON.stringify(state.session.build(payload)));
  }
}
