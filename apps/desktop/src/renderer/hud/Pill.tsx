import { cx } from "@rh/ui";
import type { HudState } from "../../overlay/types";
import { coverageCount } from "./format";

interface PillProps {
  state: HudState;
  onExpand: () => void;
}

/** Pílula compacta (~300×44): o estado num relance; clique → expande. */
export function Pill({ state, onExpand }: PillProps) {
  const { done, total } = coverageCount(state.requisitos);
  const sug = state.suggestion;
  const line = sug
    ? sug.pergunta
    : state.interviewActive
      ? "a ouvir — segue a conversa"
      : "em espera";
  return (
    <button
      type="button"
      className={cx("vera-hud-pill", "vera-hud-drag", sug && "vera-hud-pill--alert")}
      onClick={onExpand}
    >
      <span className="vera-hud-pill__dot" aria-hidden="true" />
      {state.recording ? (
        <span className="vera-hud-pill__rec" role="img" aria-label="a gravar">
          🔴
        </span>
      ) : null}
      <span className="vera-hud-pill__line">{line}</span>
      {total > 0 ? (
        <span className="vera-hud-pill__count">
          {done}/{total}
        </span>
      ) : null}
      <span className="vera-hud-pill__chevron" aria-hidden="true">
        ⌄
      </span>
    </button>
  );
}
