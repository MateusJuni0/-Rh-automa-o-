import path from "node:path";
import { app, BrowserWindow, ipcMain, screen, session, shell, type Tray } from "electron";
import { createLoginWindow } from "../login/loginMain";
import { veraAction } from "../shared/action";
import { ALWAYS_ON_TOP_LEVEL } from "../shared/windowConfig";
import { buildCsp, navigationDecision, withCspHeader } from "./security";
import { createTray } from "./tray";

// Hardening R2: sandbox por defeito p/ TODOS os processos renderer (não só o overlay).
app.enableSandbox();

// Registar o protocolo `vera://` para que o browser abra a Vera ao clicar em links vera://.
// Em dev (`process.defaultApp`), o executável é o Electron com o script como 2º argumento.
if (process.defaultApp) {
  if (process.argv.length >= 2 && process.argv[1]) {
    app.setAsDefaultProtocolClient("vera", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient("vera");
}

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
let tray: Tray | null = null;

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
    skipTaskbar: true,
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

/**
 * Processa um deep link `vera://interview/{id}?token={tok}&wsUrl={url}`:
 * injeta os parâmetros nas env vars do processo e recarrega o overlay para que o preload os releia.
 * v1: token é MOCK — Fase Ω substitui por JWT Supabase real.
 */
function handleVeraUrl(url: string): void {
  try {
    const u = new URL(url);
    if (u.hostname !== "interview") return;
    const interviewId = u.pathname.replace(/^\//, "");
    const token = u.searchParams.get("token") ?? "";
    const wsUrl = u.searchParams.get("wsUrl") ?? "";
    if (interviewId) process.env.VERA_INTERVIEW_ID = interviewId;
    if (token) process.env.VERA_ACCESS_TOKEN = token;
    if (wsUrl) process.env.VERA_WS_ORIGIN = wsUrl;
    // Recarrega o renderer para que o preload leia os env vars atualizados.
    overlay?.webContents.reload();
    overlay?.focus();
  } catch {
    // URL inválida — ignorar sem crash.
  }
}

// macOS: deep link chega via evento (a app já está a correr).
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleVeraUrl(url);
});

function endInterview(): void {
  // TODO Fase K: POST /api/interviews/:id/report (o parecer é gerado no backend).
  overlay?.close();
  overlay = null;
}

function openWebPanel(): void {
  // Só http/https — `shell.openExternal` num file:/custom-scheme podia executar ficheiros.
  // Se API_ORIGIN estiver vazio (demo/dev), abre localhost:3000 como fallback de desenvolvimento.
  const target = API_ORIGIN || "http://localhost:3000";
  try {
    const url = new URL(target);
    if (url.protocol === "https:" || url.protocol === "http:") {
      void shell.openExternal(target);
    }
  } catch {
    // URL inválida → ignorar sem crash.
  }
}

app.whenReady().then(async () => {
  installCsp();
  denySensitivePermissions();

  // Fluxo de login: só pede se não houver token já injectado (e.g. lançado da web ou modo dev inline).
  // ALLOW_DEV_SESSION=1 aceita qualquer credencial no login sem Supabase.
  if (!process.env.VERA_ACCESS_TOKEN) {
    const loginResult = await createLoginWindow();
    if (!loginResult) {
      // Utilizador fechou a janela de login sem entrar → sair.
      app.quit();
      return;
    }
    // Propagar o token para que o preload do overlay o leia no createOverlay().
    process.env.VERA_ACCESS_TOKEN = loginResult.accessToken;
  }

  overlay = createOverlay();
  tray = createTray({
    onOpenWeb: openWebPanel,
    onEnd: endInterview,
    onQuit: () => app.quit(),
  });
  // 2ª abertura (single-instance): Windows/Linux entregam o deep link via argv.
  app.on("second-instance", (_event, argv) => {
    const veraUrl = argv.find((a) => a.startsWith("vera://"));
    if (veraUrl) {
      handleVeraUrl(veraUrl);
    } else {
      overlay?.focus();
    }
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      overlay = createOverlay();
    }
  });
});

// Handler `window-all-closed` removido: a app não deve fechar quando o overlay fecha —
// o tray fica sempre visível até o utilizador clicar "Sair". A saída acontece só em `onQuit`.

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

// Actualiza o tooltip do tray consoante o estado da entrevista (recording = true/false).
// O renderer envia `vera:status` quando o estado muda (entrevista a decorrer / em espera).
ipcMain.on("vera:status", (event, payload: { recording: boolean }) => {
  if (!fromOwnRenderer(event) || !tray) {
    return;
  }
  tray.setToolTip(payload.recording ? "IRIS — 🔴 a gravar" : "IRIS — em espera");
});
