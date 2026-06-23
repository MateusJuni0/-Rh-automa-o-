import { once } from "node:events";
import { type WebSocket, WebSocketServer } from "ws";
import {
  buildServerFrame,
  FrameSession,
  parseClientMessage,
  type ServerFramePayload,
} from "./codec";

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

/** Frame já enviado, guardado para replay na reconexão (seq + payload original). */
interface BufferedFrame {
  seq: number;
  payload: ServerFramePayload;
}

interface ConnState {
  authed: boolean;
  session: FrameSession;
  interviewId: string;
  actorId: string | undefined;
  lastAck: number;
  /** Buffer dos frames enviados nesta ligação (anel limitado) → replay por `ack {lastSeq}`. */
  sent: BufferedFrame[];
}

/** Teto do buffer de replay por ligação (anti-crescimento ilimitado de memória). */
const REPLAY_BUFFER_MAX = 256;

/**
 * Servidor WebSocket do painel/overlay. 1ª mensagem TEM de ser `auth` (JWT no corpo, AUTENTICACAO §4);
 * recusa = close 44xx. Cada ligação tem um `FrameSession` (seq monótono p/ replay/ack).
 */
export class WsServer {
  readonly #wss: WebSocketServer;
  readonly #hooks: WsServerHooks;
  /** Ligações autenticadas (p/ broadcast de ticks/sugestões a quem está numa entrevista). */
  readonly #conns = new Map<WebSocket, ConnState>();

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
      sent: [],
    };
    sock.on("message", (data: { toString(): string }) => {
      void this.#onMessage(sock, state, data.toString());
    });
    sock.on("close", () => this.#conns.delete(sock));
  }

  async #onMessage(sock: WebSocket, state: ConnState, raw: string): Promise<void> {
    // Teto de tamanho (anti-DoS pré-auth): auth/ack são pequenos; nada legítimo passa de 8 KB.
    if (raw.length > 8192) {
      sock.close(4401, "mensagem demasiado grande");
      return;
    }
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
      this.#conns.set(sock, state);
      this.#send(sock, state, { type: "auth.ok" });
      this.#send(sock, state, { type: "interview.active", interviewId: msg.interviewId, on: true });
      return;
    }

    if (msg.type === "ack") {
      state.lastAck = msg.lastSeq;
      this.#replay(sock, state, msg.lastSeq);
    }
  }

  /** Reenvia os frames bufferizados com `seq > lastSeq` (recuperação na reconexão). */
  #replay(sock: WebSocket, state: ConnState, lastSeq: number): void {
    for (const f of state.sent) {
      if (f.seq > lastSeq) {
        sock.send(JSON.stringify(buildServerFrame(f.payload, f.seq)));
      }
    }
  }

  /**
   * Envia um frame a TODAS as ligações autenticadas da entrevista (ticks/sugestões/etc.).
   * v1: difunde a todas as ligações autenticadas (single-tenant, 1 recrutador por entrevista).
   */
  broadcast(payload: ServerFramePayload): void {
    for (const [sock, state] of this.#conns) {
      if (state.authed) {
        this.#send(sock, state, payload);
      }
    }
  }

  #send(sock: WebSocket, state: ConnState, payload: ServerFramePayload): void {
    const frame = state.session.build(payload);
    // Guarda para replay (anel limitado): o seq vem do frame já construído.
    state.sent.push({ seq: frame.seq, payload });
    if (state.sent.length > REPLAY_BUFFER_MAX) {
      state.sent.shift();
    }
    sock.send(JSON.stringify(frame));
  }
}
