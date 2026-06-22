import path from "node:path";
import { app, BrowserWindow, ipcMain, screen, session, shell } from "electron";
import { veraAction } from "../shared/action";
import { ALWAYS_ON_TOP_LEVEL } from "../shared/windowConfig";
import { buildCsp, navigationDecision, withCspHeader } from "./security";
import { createTray } from "./tray";

// Hardening R2: sandbox por defeito p/ TODOS os processos renderer (não só o overlay).
app.enableSandbox();

// Single-instance: nunca empilhar Veras. Uma 2ª abertura foca a existente e sai (anti-pile-up).
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

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

/**
 * A janela do overlay cobre o ecrã inteiro, transparente e SEM moldura, com **click-through** por
 * defeito: os cliques passam para a chamada (Meet/Zoom) por baixo. O renderer liga a interatividade
 * (`vera:interactive`) só quando o rato está em cima da Vera (ícone/balão/painel). Assim a Vera pode
 * flutuar e voar para qualquer ponto do ecrã sem roubar o rato à entrevista.
 */
function createOverlay(): BrowserWindow {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    hasShadow: false,
    focusable: true,
    show: false,
    icon: path.join(dir, "../assets/tray.png"),
    webPreferences: {
      preload: path.join(dir, "../preload/preload.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  win.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });

  // Hardening R2: negar janelas novas + navegação/redireção fora da allowlist.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const guardNavigation = (event: { preventDefault: () => void }, url: string): void => {
    if (navigationDecision(url, ALLOWED_ORIGINS) === "deny") {
      event.preventDefault();
    }
  };
  win.webContents.on("will-navigate", guardNavigation);
  win.webContents.on("will-redirect", guardNavigation);

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
  // 2ª abertura (single-instance) → traz a Vera existente para a frente.
  app.on("second-instance", () => overlay?.focus());
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

// O renderer liga/desliga o click-through: `true` quando o rato entra na Vera (apanha cliques),
// `false` quando sai (o rato volta a passar para a chamada por baixo).
ipcMain.on("vera:interactive", (event, on) => {
  if (!fromOwnRenderer(event)) {
    return;
  }
  overlay?.setIgnoreMouseEvents(on !== true, { forward: true });
});
