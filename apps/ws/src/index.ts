// @rh/ws — servidor WebSocket do painel/overlay. Por agora: o codec de frames (consome @rh/core).
// O wiring do socket real (ws + upgrade HTTP + auth.refresh) entra numa fatia seguinte.
export * from "./codec";
