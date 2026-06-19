import "@rh/ui/styles/tokens.css";
import "@rh/ui/styles/ui.css";
import "./hud/hud.css";
import { useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { goldenInterviewScript } from "../overlay/mockFeed";
import { hudReduce, initialHudState } from "../overlay/reducer";
import type { VeraBridge } from "../preload/preload";
import { Hud } from "./hud/Hud";
import { playScript } from "./hud/player";
import type { ChatTurn, HudCallbacks } from "./hud/types";

declare global {
  interface Window {
    vera?: VeraBridge;
  }
}

function App() {
  const [state, dispatch] = useReducer(hudReduce, initialHudState);
  const [expanded, setExpanded] = useState(true);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const startRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Feed MOCK no v1 (substituível pelo WS real via window.vera.onFrame na Fase K).
  useEffect(() => {
    startRef.current = Date.now();
    const cancel = playScript(goldenInterviewScript(), (msg) => dispatch({ kind: "server", msg }));
    const timer = setInterval(() => {
      if (startRef.current !== null) {
        setElapsedMs(Date.now() - startRef.current);
      }
    }, 1000);
    return () => {
      cancel();
      clearInterval(timer);
    };
  }, []);

  const callbacks: HudCallbacks = {
    onExpand: () => setExpanded(true),
    onCollapse: () => setExpanded(false),
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
      // Resposta MOCK local — o WS congelado não tem frame de chat (decisão na Fase K).
      setTimeout(() => {
        setChat((c) => [
          ...c,
          { id: `b-${c.length}`, role: "bot", text: "Ainda não falou de salário (mock)." },
        ]);
      }, 600);
    },
  };

  return (
    <Hud
      state={state}
      expanded={expanded}
      elapsedMs={elapsedMs}
      contexto="Frontend Sr — João Silva"
      chat={chat}
      callbacks={callbacks}
    />
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
