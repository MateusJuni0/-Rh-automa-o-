import type { Lente, RequisitoStatus, ServerMessage } from "@rh/core";

/** Estado da ligação ao WS de estado (APP-DESKTOP §8 — sem falha silenciosa). */
export type ConnStatus = "connecting" | "live" | "reconnecting" | "offline";

/** Um requisito no semáforo do overlay (vista da máquina de estados §9). */
export interface RequisitoView {
  requisitoId: string;
  display: string;
  status: RequisitoStatus;
  evidencia?: string;
}

/** A sugestão como o HUD a mostra: pergunta + lente + porquê (derivado do estado). */
export interface HudSuggestionView {
  pergunta: string;
  lente: Lente;
  requisitoId: string | null;
  porque: string;
}

/** Vista comprimida que o overlay pinta (Tela 6). Derivada das mensagens do WS. */
export interface HudState {
  conn: ConnStatus;
  interviewActive: boolean;
  /** 🔴 — gravação/consentimento visível enquanto a entrevista está ativa. */
  recording: boolean;
  /** Sugestão em destaque (uma por vez). */
  suggestion: HudSuggestionView | null;
  /** Fila discreta de sugestões secundárias. */
  queue: HudSuggestionView[];
  /** Semáforo dos requisitos. */
  requisitos: RequisitoView[];
  /** Rede de segurança / avisos do fim (texto dos frames `alert`). */
  alerts: string[];
  resumoCorrente: string;
  /** Último `seq` recebido — para `ack`/replay na reconexão. */
  lastSeq: number;
}

export type HudAction =
  | { kind: "server"; msg: ServerMessage }
  | { kind: "conn"; status: ConnStatus }
  /** Timer de ~30s do cliente: descarta a sugestão atual e promove a próxima. */
  | { kind: "dismissSuggestion" };
