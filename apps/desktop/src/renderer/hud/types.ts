import type { HudState } from "../../overlay/types";

/** Um turno do chat ao vivo do overlay (Tela 6). NÃO faz parte do estado do WS — é local. */
export interface ChatTurn {
  id: string;
  role: "filipa" | "bot";
  text: string;
}

/** Ações que o overlay dispara (toques únicos + chat). O `main`/demo liga-as. */
export interface HudCallbacks {
  onExpand: () => void;
  onCollapse: () => void;
  onUsei: () => void;
  onPular: () => void;
  onStar: () => void;
  onEnd: () => void;
  onSendChat: (text: string) => void;
}

export interface HudProps {
  state: HudState;
  expanded: boolean;
  elapsedMs: number;
  /** Contexto da entrevista (ex.: "Frontend Sr — João Silva"). Vem da metadata, não do WS. */
  contexto?: string;
  chat?: ChatTurn[];
  callbacks: HudCallbacks;
}
