import { Button } from "@rh/ui";
import { type FormEvent, useState } from "react";
import type { ChatTurn } from "./types";

interface ChatPanelProps {
  chat: ChatTurn[];
  onSend: (text: string) => void;
}

/** Chat ao vivo do overlay: pergunta ao bot a meio da call (Tela 6 / APP-DESKTOP §3). */
export function ChatPanel({ chat, onSend }: ChatPanelProps) {
  const [text, setText] = useState("");

  function submit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const t = text.trim();
    if (!t) {
      return;
    }
    onSend(t);
    setText("");
  }

  return (
    <div className="vera-hud-chat">
      {chat.length > 0 ? (
        <ul className="vera-hud-chat__log">
          {chat.map((turn) => (
            <li key={turn.id} className={`vera-hud-chat__turn vera-hud-chat__turn--${turn.role}`}>
              <strong>{turn.role === "bot" ? "Vera" : "Tu"}:</strong> {turn.text}
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={submit} className="vera-hud-chat__form vera-hud-nodrag">
        <input
          className="vera-hud-chat__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="falta algo? ex.: já falou de salário?"
          aria-label="Perguntar ao bot ao vivo"
        />
        <Button type="submit" size="sm">
          Perguntar
        </Button>
      </form>
    </div>
  );
}
