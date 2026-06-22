import "./vera-overlay.css";
import { useEffect, useReducer, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { goldenInterviewScript } from "../overlay/mockFeed";
import { hudReduce, initialHudState } from "../overlay/reducer";
import { FloatingVera } from "./FloatingVera";
import { playScript } from "./hud/player";
import type { ChatTurn, HudCallbacks } from "./hud/types";

/**
 * Overlay flutuante da Vera (white-label IRIS). Feed MOCK no v1 (o guião "golden" do `mockFeed`);
 * na Fase Ω troca-se por `window.vera.onFrame` (WS real). A janela é full-screen transparente
 * click-through; o `FloatingVera` gere a posição (arrasto), o expandir e as animações.
 */
function App() {
  const [state, dispatch] = useReducer(hudReduce, initialHudState);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const startRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    // Corre o guião golden UMA vez e assenta (estável). Na vida real o estado muda com a fala
    // do candidato, não cicla. Para re-ver a reação, basta relançar a Vera (atalho de teste).
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
