import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type DisplayInfo,
  pickWindowPosition,
  readWindowState,
  writeWindowState,
} from "../src/main/windowState";

const SIZE = { width: 360, height: 120 };
const primary: DisplayInfo = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
const second: DisplayInfo = { id: 2, bounds: { x: 1920, y: 0, width: 1280, height: 720 } };

describe("pickWindowPosition", () => {
  it("sem posição guardada → centra no primário", () => {
    const pos = pickWindowPosition(null, [primary], SIZE);
    expect(pos).toEqual({ x: (1920 - 360) / 2, y: (1080 - 120) / 2 });
  });

  it("posição guardada num monitor existente → respeita (com clamp aos limites)", () => {
    const pos = pickWindowPosition({ displayId: 2, x: 2000, y: 100 }, [primary, second], SIZE);
    expect(pos).toEqual({ x: 2000, y: 100 });
  });

  it("clampa quando a posição guardada sai do monitor", () => {
    const pos = pickWindowPosition({ displayId: 2, x: 99999, y: 99999 }, [primary, second], SIZE);
    expect(pos.x).toBe(1920 + 1280 - 360);
    expect(pos.y).toBe(720 - 120);
  });

  it("monitor lembrado desligou-se → cai no primário (sem erro)", () => {
    const pos = pickWindowPosition({ displayId: 2, x: 2000, y: 100 }, [primary], SIZE);
    expect(pos).toEqual({ x: (1920 - 360) / 2, y: (1080 - 120) / 2 });
  });

  it("sem monitores → (0,0)", () => {
    expect(pickWindowPosition(null, [], SIZE)).toEqual({ x: 0, y: 0 });
  });
});

describe("read/writeWindowState", () => {
  const file = join(tmpdir(), "vera-winstate-test.json");

  it("round-trip; ficheiro em falta ou corrompido → null", () => {
    rmSync(file, { force: true });
    expect(readWindowState(file)).toBeNull();
    writeWindowState(file, { displayId: 2, x: 10, y: 20 });
    expect(readWindowState(file)).toEqual({ displayId: 2, x: 10, y: 20 });
    rmSync(file, { force: true });
  });
});
