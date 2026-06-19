// Núcleo puro do desktop (testável sem Electron). O `main`/`renderer` consomem isto.

export type { ScheduledFrame } from "./overlay/mockFeed";
export {
  goldenInterviewFrames,
  goldenInterviewScript,
  MOCK_INTERVIEW_ID,
} from "./overlay/mockFeed";
export { derivePorque, hudReduce, initialHudState } from "./overlay/reducer";
export type {
  ConnStatus,
  HudAction,
  HudState,
  HudSuggestionView,
  RequisitoView,
} from "./overlay/types";
export type { CspOptions } from "./shared/csp";
export { buildCsp } from "./shared/csp";
export { isAllowedNavigationUrl } from "./shared/navigation";
export type { OverlayWebPreferences, OverlayWindowOptions } from "./shared/windowConfig";
export { ALWAYS_ON_TOP_LEVEL, buildOverlayWindowOptions } from "./shared/windowConfig";
