import { ExpandedPanel } from "./ExpandedPanel";
import { Pill } from "./Pill";
import type { HudProps } from "./types";

/** Raiz do overlay: pílula compacta ou painel expandido conforme `expanded`. */
export function Hud({ state, expanded, elapsedMs, contexto, chat = [], callbacks }: HudProps) {
  if (!expanded) {
    return <Pill state={state} onExpand={callbacks.onExpand} />;
  }
  return (
    <ExpandedPanel
      state={state}
      elapsedMs={elapsedMs}
      contexto={contexto}
      chat={chat}
      callbacks={callbacks}
    />
  );
}
