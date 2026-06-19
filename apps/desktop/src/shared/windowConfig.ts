/**
 * Configuração da janela do overlay (APP-DESKTOP §1 + §10 hardening R2).
 * Puro: devolve as opções; o `main` passa-as a `new BrowserWindow(...)`.
 * O hardening R2 (sandbox+contextIsolation+nodeIntegration:false) é CONTRATO, não escolha.
 */

/** Nível de always-on-top que vence o fullscreen do Meet/Zoom (Electron `setAlwaysOnTop`). */
export const ALWAYS_ON_TOP_LEVEL = "screen-saver" as const;

export interface OverlayWebPreferences {
  sandbox: boolean;
  contextIsolation: boolean;
  nodeIntegration: boolean;
  webSecurity: boolean;
  preload?: string;
}

export interface OverlayWindowOptions {
  width: number;
  height: number;
  minWidth: number;
  frame: boolean;
  transparent: boolean;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  resizable: boolean;
  /** false por defeito: clicar no overlay não rouba foco ao Meet (exceto chat ao vivo). */
  focusable: boolean;
  webPreferences: OverlayWebPreferences;
}

/** Opções da `BrowserWindow` do overlay — frameless/transparent/always-on-top + hardening R2. */
export function buildOverlayWindowOptions(preloadPath?: string): OverlayWindowOptions {
  return {
    width: 360,
    height: 120,
    minWidth: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      ...(preloadPath ? { preload: preloadPath } : {}),
    },
  };
}
