import { contextBridge, ipcRenderer } from "electron";

/**
 * Preload mínimo para a janela de login.
 * Expõe apenas as operações estritamente necessárias: submeter credenciais e ouvir erros.
 * Sandbox: true · contextIsolation: true · nodeIntegration: false.
 */
const loginApi = {
  /** Envia as credenciais para o processo main. */
  submit(email: string, password: string): void {
    ipcRenderer.send("login:submit", { email, password });
  },
  /** Regista callback chamado quando o main processo reporta erro de autenticação. */
  onError(cb: (msg: string) => void): void {
    ipcRenderer.on("login:error", (_event, msg: string) => cb(msg));
  },
};

contextBridge.exposeInMainWorld("loginApi", loginApi);

export type LoginBridge = typeof loginApi;
