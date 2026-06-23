import path from "node:path";
import { BrowserWindow, ipcMain } from "electron";

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

/**
 * Abre a janela de login e aguarda o resultado.
 * Retorna `LoginResult` em caso de sucesso, `null` se o utilizador fechar sem entrar.
 * ALLOW_DEV_SESSION=1 aceita qualquer credencial (modo dev).
 */
export function createLoginWindow(): Promise<LoginResult | null> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 420,
      height: 560,
      frame: false, // sem barra de título do SO
      resizable: false,
      center: true,
      skipTaskbar: false, // login DEVE aparecer na taskbar
      webPreferences: {
        preload: path.join(import.meta.dirname, "../preload/loginPreload.js"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    void win.loadFile(path.join(import.meta.dirname, "../renderer/login.html"));

    // O renderer envia "login:submit" com { email, password }
    ipcMain.once(
      "login:submit",
      (_event, { email, password }: { email: string; password: string }) => {
        // Validação mínima antes de tentar auth
        if (!email || !password) {
          win.webContents.send("login:error", "Email e senha são obrigatórios");
          return;
        }

        // TODO Fase K: chamar Supabase aqui com signInWithPassword
        // Por agora: aceitar qualquer credencial em dev (ALLOW_DEV_SESSION=1)
        if (process.env.ALLOW_DEV_SESSION === "1") {
          win.close();
          resolve({
            accessToken: "dev-token",
            refreshToken: "dev-refresh",
            userId: "dev-user",
          });
          return;
        }

        win.webContents.send("login:error", "Supabase auth não configurado neste build.");
      },
    );

    win.on("closed", () => {
      ipcMain.removeAllListeners("login:submit");
      resolve(null);
    });
  });
}
