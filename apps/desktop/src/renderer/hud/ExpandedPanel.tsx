import { Button, StateLight } from "@rh/ui";
import type { HudState } from "../../overlay/types";
import { ChatPanel } from "./ChatPanel";
import { formatElapsed } from "./format";
import type { ChatTurn, HudCallbacks } from "./types";

interface ExpandedPanelProps {
  state: HudState;
  elapsedMs: number;
  contexto?: string;
  chat: ChatTurn[];
  callbacks: HudCallbacks;
}

/** Painel expandido (~360px): a Tela 6 completa, glanceable. */
export function ExpandedPanel({ state, elapsedMs, contexto, chat, callbacks }: ExpandedPanelProps) {
  const sug = state.suggestion;
  return (
    <section className="vera-hud-panel">
      <header className="vera-hud-panel__header vera-hud-drag">
        <span className="vera-hud-panel__ctx">
          {state.recording ? (
            <span role="img" aria-label="a gravar">
              🔴
            </span>
          ) : null}{" "}
          {contexto ?? "Entrevista"}
        </span>
        <span className="vera-hud-panel__time">{formatElapsed(elapsedMs)}</span>
        <button
          type="button"
          className="vera-hud-panel__collapse vera-hud-nodrag"
          aria-label="Recolher"
          onClick={callbacks.onCollapse}
        >
          ⌃
        </button>
      </header>

      <div className="vera-hud-panel__section">
        <p className="vera-hud-panel__label">Próxima pergunta</p>
        {sug ? (
          <>
            <p className="vera-hud-panel__q">{sug.pergunta}</p>
            <p className="vera-hud-panel__why">
              <span aria-hidden="true">💡</span> {sug.porque}
            </p>
            <div className="vera-hud-panel__actions vera-hud-nodrag">
              <Button size="sm" onClick={callbacks.onUsei}>
                Usei
              </Button>
              <Button size="sm" variant="ghost" onClick={callbacks.onPular}>
                Pular
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Marcar momento"
                onClick={callbacks.onStar}
              >
                ★
              </Button>
            </div>
          </>
        ) : (
          <p className="vera-hud-panel__calm">
            <span aria-hidden="true">✅</span> no caminho — segue a conversa
          </p>
        )}
      </div>

      {state.queue.length > 0 ? (
        <div className="vera-hud-panel__section">
          <p className="vera-hud-panel__label">Na fila</p>
          <ul className="vera-hud-queue">
            {state.queue.map((q) => (
              <li key={`${q.requisitoId ?? "n"}:${q.pergunta}`} className="vera-hud-queue__item">
                · {q.pergunta}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="vera-hud-panel__section">
        <p className="vera-hud-panel__label">Estado dos requisitos</p>
        <ul className="vera-hud-reqs">
          {state.requisitos.map((r) => (
            <li key={r.requisitoId}>
              <StateLight status={r.status} label={r.display} showIcon />
            </li>
          ))}
        </ul>
      </div>

      {state.alerts.length > 0 ? (
        <div className="vera-hud-panel__section vera-hud-safety">
          {state.alerts.map((a) => (
            <p key={a} className="vera-hud-safety__item">
              <span aria-hidden="true">⚠</span> {a}
            </p>
          ))}
        </div>
      ) : null}

      <div className="vera-hud-panel__section">
        <ChatPanel chat={chat} onSend={callbacks.onSendChat} />
      </div>
    </section>
  );
}
