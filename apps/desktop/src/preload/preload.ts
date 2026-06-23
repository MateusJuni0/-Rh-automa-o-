import { contextBridge, ipcRenderer } from "electron";
import type { VeraAction } from "../shared/action";

/**
 * Bridge mínima exposta ao renderer (hardening R2: contextBridge, sem nodeIntegration).
 * Só o estritamente necessário: enviar ações e (futuro) receber frames do WS de estado.
 */
const api = {
  sendAction(action: VeraAction): void {
    ipcRenderer.send(action.kind === "end" ? "vera:end" : "vera:action", action);
  },
  /** Liga/desliga o click-through da janela: `true` quando o rato entra na Vera. */
  setInteractive(on: boolean): void {
    ipcRenderer.send("vera:interactive", on);
  },
  /** Actualiza o estado da entrevista no tray (tooltip + indicador de gravação). */
  setStatus(recording: boolean): void {
    ipcRenderer.send("vera:status", { recording });
  },
  /** Subscreve frames do WS de estado (inerte no v1 mock; ligado na Fase K). */
  onFrame(cb: (msg: unknown) => void): () => void {
    // `_event` é Electron.IpcRendererEvent; tipado unknown de propósito — o `sender`
    // NUNCA é reencaminhado ao mundo do renderer (barreira do contextBridge).
    const listener = (_event: unknown, msg: unknown): void => cb(msg);
    ipcRenderer.on("vera:frame", listener);
    return () => {
      ipcRenderer.removeListener("vera:frame", listener);
    };
  },
  /** URL do WebSocket do servidor de estado (vazia em modo demo/mock). */
  wsUrl: process.env.VERA_WS_ORIGIN ?? "",
  /** JWT Supabase do recrutador (injetado ao lançar a Vera da app web; vazio em demo). */
  wsToken: process.env.VERA_ACCESS_TOKEN ?? "",
  /** UUID da entrevista em curso (injetado ao lançar; vazio em demo). */
  wsInterviewId: process.env.VERA_INTERVIEW_ID ?? "",
};

contextBridge.exposeInMainWorld("vera", api);

export type VeraBridge = typeof api;
