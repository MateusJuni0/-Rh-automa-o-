import path from "node:path";
import { Menu, nativeImage, Tray } from "electron";

export interface TrayHandlers {
  onOpenWeb: () => void;
  onEnd: () => void;
  onQuit: () => void;
}

/** Ícone IRIS (asset copiado pelo build para dist-build/assets). Cai para vazio se faltar. */
function trayIcon(): Electron.NativeImage {
  const img = nativeImage.createFromPath(path.join(import.meta.dirname, "../assets/tray.png"));
  return img.isEmpty() ? img : img.resize({ width: 18, height: 18 });
}

/**
 * Tray (APP-DESKTOP §1): a forma sempre-visível de gerir e FECHAR a Vera (ícone IRIS no relógio).
 * "Sair" termina a app — sem isto a janela frameless ficava impossível de fechar.
 */
export function createTray(handlers: TrayHandlers): Tray {
  const tray = new Tray(trayIcon());
  tray.setToolTip("IRIS — copiloto");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir o painel web", click: handlers.onOpenWeb },
      { label: "Terminar entrevista", click: handlers.onEnd },
      { type: "separator" },
      { label: "Sair (fechar a IRIS)", click: handlers.onQuit },
    ]),
  );
  // Clique no ícone do tray também fecha o menu/foca — duplo-clique sai (atalho de teste).
  tray.on("double-click", handlers.onQuit);
  return tray;
}
