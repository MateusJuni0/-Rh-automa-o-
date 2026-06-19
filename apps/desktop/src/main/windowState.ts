import { readFileSync, writeFileSync } from "node:fs";

/** Posição persistida do overlay (preferência local não sensível — APP-DESKTOP §1). */
export interface SavedWindowPos {
  displayId: number;
  x: number;
  y: number;
}

export interface DisplayInfo {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
}

interface Size {
  width: number;
  height: number;
}

function centerOnPrimary(displays: readonly DisplayInfo[], size: Size): { x: number; y: number } {
  const primary = displays[0];
  if (!primary) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.round(primary.bounds.x + (primary.bounds.width - size.width) / 2),
    y: Math.round(primary.bounds.y + (primary.bounds.height - size.height) / 2),
  };
}

/**
 * Escolhe a posição do overlay: a guardada se o monitor ainda existe (com clamp aos seus
 * limites); senão centra no primário (sem erro — APP-DESKTOP §1: monitor lembrado desligou-se).
 */
export function pickWindowPosition(
  saved: SavedWindowPos | null,
  displays: readonly DisplayInfo[],
  size: Size,
): { x: number; y: number } {
  if (!saved) {
    return centerOnPrimary(displays, size);
  }
  const display = displays.find((d) => d.id === saved.displayId);
  if (!display) {
    return centerOnPrimary(displays, size);
  }
  const maxX = display.bounds.x + display.bounds.width - size.width;
  const maxY = display.bounds.y + display.bounds.height - size.height;
  return {
    x: Math.min(Math.max(saved.x, display.bounds.x), Math.max(display.bounds.x, maxX)),
    y: Math.min(Math.max(saved.y, display.bounds.y), Math.max(display.bounds.y, maxY)),
  };
}

const SHAPE_OK = (v: unknown): v is SavedWindowPos =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as SavedWindowPos).displayId === "number" &&
  typeof (v as SavedWindowPos).x === "number" &&
  typeof (v as SavedWindowPos).y === "number";

/** Lê a posição guardada; devolve null se o ficheiro não existe ou está corrompido. */
export function readWindowState(file: string): SavedWindowPos | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    return SHAPE_OK(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persiste a posição (best-effort; falha silenciosa só aqui é aceitável — é preferência local). */
export function writeWindowState(file: string, pos: SavedWindowPos): void {
  writeFileSync(file, JSON.stringify(pos), "utf8");
}
