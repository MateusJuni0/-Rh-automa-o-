import path from "node:path";
import { app, BrowserWindow, ipcMain, screen, session, shell } from "electron";
import { veraAction } from "../shared/action";
import { ALWAYS_ON_TOP_LEVEL, buildOverlayWindowOptions } from "../shared/windowConfig";
import { buildCsp, navigationDecision, withCspHeader } from "./security";
import { createTray } from "./tray";
import { pickWindowPosition, readWindowState, writeWindowState } from "./windowState";

// Hardening R2: sandbox por defeito p/ TODOS os processos renderer (não só o overlay).
app.enableSandbox();

/** Só o nosso renderer (file:) pode mandar IPC (anti-sender-spoofing). */
function fromOwnRenderer(event: { senderFrame: { url: string } | null }): boolean {
  return event.senderFrame?.url?.startsWith("file://") ?? false;
}

// URLs PÚBLICAS via env (nunca segredos). Vazias no v1 mock → só `file:` é navegável.
const API_ORIGIN = process.env.VERA_API_ORIGIN ?? "";
const WS_ORIGIN = process.env.VERA_WS_ORIGIN ?? "";
const ALLOWED_ORIGINS = [API_ORIGIN].filter(Boolean);
const CSP = buildCsp({ connectSrc: [WS_ORIGIN, API_ORIGIN].filter(Boolean) });

const dir = import.meta.dirname;
let overlay: BrowserWindow | null = null;

function statePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

function createOverlay(): BrowserWindow {
  const opts = buildOverlayWindowOptions(path.join(dir, "../preload/preload.js"));
  const displays = screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds }));
  const pos = pickWindowPosition(readWindowState(statePath()), displays, {
    width: opts.width,
    height: opts.height,
  });
  const win = new BrowserWindow({ ...opts, x: pos.x, y: pos.y, show: false });
  win.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Hardening R2: negar janelas novas + navegação/redireção fora da allowlist.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const guardNavigation = (event: { preventDefault: () => void }, url: string): void => {
    if (navigationDecision(url, ALLOWED_ORIGINS) === "deny") {
      event.preventDefault();
    }
  };
  win.webContents.on("will-navigate", guardNavigation);
  win.webContents.on("will-redirect", guardNavigation);

  win.on("moved", () => {
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    writeWindowState(statePath(), { displayId: display.id, x: bounds.x, y: bounds.y });
  });

  void win.loadFile(path.join(dir, "../renderer/index.html"));
  win.once("ready-to-show", () => win.show());
  return win;
}

/**
 * CSP nos response headers de recursos HTTP/HTTPS (ex.: fetch ao backend na Fase K).
 * NÃO cobre o renderer carregado por `loadFile` (esquema `file:` não passa por
 * onHeadersReceived) — para esse, a CSP <meta> em index.html é a defesa ativa.
 */
function installCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: withCspHeader(details.responseHeaders ?? {}, CSP) });
  });
}

/** Nega permissões sensíveis do SO (v1 não capta áudio/vídeo — APP-DESKTOP §5). */
function denySensitivePermissions(): void {
  const denied = new Set(["media", "microphone", "camera", "geolocation", "notifications"]);
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(!denied.has(permission));
  });
}

function endInterview(): void {
  // TODO Fase K: POST /api/interviews/:id/report (o parecer é gerado no backend).
  overlay?.close();
  overlay = null;
}

function openWebPanel(): void {
  // Só http/https — `shell.openExternal` num file:/custom-scheme podia executar ficheiros.
  try {
    const url = new URL(API_ORIGIN);
    if (url.protocol === "https:" || url.protocol === "http:") {
      void shell.openExternal(API_ORIGIN);
    }
  } catch {
    // URL inválida → ignorar.
  }
}

app.whenReady().then(() => {
  installCsp();
  denySensitivePermissions();
  overlay = createOverlay();
  createTray({
    onOpenWeb: openWebPanel,
    onEnd: endInterview,
    onQuit: () => app.quit(),
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      overlay = createOverlay();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Ações do overlay — só do nosso renderer + payload validado (stub até à API/WS da Fase K).
ipcMain.on("vera:action", (event, raw) => {
  if (!fromOwnRenderer(event)) {
    return;
  }
  const parsed = veraAction.safeParse(raw);
  if (!parsed.success) {
    return;
  }
  // TODO Fase K: encaminhar parsed.data (Usei/Pular/★/chat) ao backend (motor ao vivo).
});
ipcMain.on("vera:end", (event) => {
  if (fromOwnRenderer(event)) {
    endInterview();
  }
});
