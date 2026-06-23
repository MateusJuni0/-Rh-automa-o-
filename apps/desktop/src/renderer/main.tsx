import "./vera-overlay.css";
import { serverMessage } from "@rh/core";
import { useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { goldenInterviewScript } from "../overlay/mockFeed";
import { hudReduce, initialHudState } from "../overlay/reducer";
import { FloatingVera } from "./FloatingVera";
import { playScript } from "./hud/player";
import type { ChatTurn, HudCallbacks } from "./hud/types";

/**
 * Overlay flutuante da Vera (white-label IRIS).
 * - Com `VERA_WS_ORIGIN` definido: liga WebSocket real ao servidor de estado com reconnect.
 * - Sem URL (v1 demo): corre o guião golden do `mockFeed` (auto-play 8 frames).
 * A janela é full-screen transparente click-through; `FloatingVera` gere posição e animações.
 */
function App() {
  const [state, dispatch] = useReducer(hudReduce, initialHudState);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const startRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    const timer = setInterval(() => {
      if (startRef.current !== null) setElapsedMs(Date.now() - startRef.current);
    }, 1000);

    const wsUrl = window.vera?.wsUrl ?? "";
    let cancel: (() => void) | undefined;
    let ws: WebSocket | undefined;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let destroyed = false;

    if (wsUrl) {
      // Modo real — WebSocket com reconnect automático (3 s) + handshake JWT (AUTENTICACAO §4).
      const wsToken = window.vera?.wsToken ?? "";
      const wsInterviewId = window.vera?.wsInterviewId ?? "";
      dispatch({ kind: "conn", status: "connecting" });
      const connect = (): void => {
        if (destroyed) return;
        ws = new WebSocket(wsUrl);
        ws.addEventListener("open", () => {
          // 1ª mensagem OBRIGATÓRIA: auth (JWT + interviewId). Sem isto o servidor fecha 4401.
          ws?.send(
            JSON.stringify({ type: "auth", accessToken: wsToken, interviewId: wsInterviewId }),
          );
        });
        ws.addEventListener("message", (e: MessageEvent) => {
          // Valida o frame na fronteira (anti-achismo: nunca confiar em dados externos do WS).
          let raw: unknown;
          try {
            raw = JSON.parse(e.data as string);
          } catch {
            return; // não-JSON — ignora
          }
          const parsed = serverMessage.safeParse(raw);
          if (parsed.success) {
            dispatch({ kind: "server", msg: parsed.data });
          }
          // frame desconhecido/inválido → ignora (não parte o overlay)
        });
        ws.addEventListener("close", () => {
          if (!destroyed) {
            dispatch({ kind: "conn", status: "reconnecting" });
            reconnectTimeout = setTimeout(connect, 3000);
          }
        });
        ws.addEventListener("error", () => {
          ws?.close();
        });
      };
      connect();
    } else {
      // Modo demo — guião golden em loop infinito: reinicia 2 s após o último frame.
      // `playScript` agenda todos os frames e devolve cancelador; o restart agenda a próxima iteração.
      const STEP_MS = 2500;
      const startLoop = (): void => {
        if (destroyed) return;
        const script = goldenInterviewScript(STEP_MS);
        const duration = script.length > 0 ? (script[script.length - 1]?.delayMs ?? 0) : 0;
        cancel = playScript(script, (msg) => dispatch({ kind: "server", msg }));
        // Após a última frame + 2 s de pausa, reinicia o loop (reset implícito ao voltar ao frame 0).
        reconnectTimeout = setTimeout(startLoop, duration + 2000);
      };
      startLoop();
    }

    return () => {
      destroyed = true;
      clearInterval(timer);
      clearTimeout(reconnectTimeout);
      cancel?.();
      ws?.close();
    };
  }, []);

  const callbacks: HudCallbacks = {
    onExpand: () => {},
    onCollapse: () => {},
    onUsei: () => window.vera?.sendAction({ kind: "usei" }),
    onPular: () => {
      dispatch({ kind: "dismissSuggestion" });
      window.vera?.sendAction({ kind: "pular" });
    },
    onStar: () => window.vera?.sendAction({ kind: "star" }),
    onEnd: () => window.vera?.sendAction({ kind: "end" }),
    onSendChat: (text) => {
      setChat((c) => [...c, { id: `f-${c.length}`, role: "filipa", text }]);
      window.vera?.sendAction({ kind: "chat", text });
      // Resposta MOCK local (o WS congelado não tem frame de chat — decisão na Fase K).
      setTimeout(() => {
        setChat((c) => [
          ...c,
          { id: `b-${c.length}`, role: "bot", text: "Ainda não falou de salário (mock)." },
        ]);
      }, 600);
    },
  };

  return (
    <FloatingVera
      state={state}
      elapsedMs={elapsedMs}
      contexto="Frontend Sr · João Silva"
      chat={chat}
      callbacks={callbacks}
    />
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
