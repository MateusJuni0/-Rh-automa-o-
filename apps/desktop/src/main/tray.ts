import { Menu, nativeImage, Tray } from "electron";

export interface TrayHandlers {
  onOpenWeb: () => void;
  onEnd: () => void;
  onQuit: () => void;
}

/**
 * Tray mínima (APP-DESKTOP §1): abrir a web, terminar a entrevista, sair.
 * O ícone real (⚪/🔴) entra no packaging — aqui um ícone vazio (sem asset commitado).
 */
export function createTray(handlers: TrayHandlers): Tray {
  const tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("Vera — copiloto");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir o painel web", click: handlers.onOpenWeb },
      { label: "Terminar entrevista", click: handlers.onEnd },
      { type: "separator" },
      { label: "Sair", click: handlers.onQuit },
    ]),
  );
  return tray;
}
