import { describe, expect, it } from "vitest";
import { buildCsp } from "../src/shared/csp";
import { isAllowedNavigationUrl } from "../src/shared/navigation";
import { ALWAYS_ON_TOP_LEVEL, buildOverlayWindowOptions } from "../src/shared/windowConfig";

describe("buildOverlayWindowOptions (hardening R2)", () => {
  const opts = buildOverlayWindowOptions("/preload.js");

  it("força sandbox + contextIsolation + nodeIntegration:false (CONTRATO)", () => {
    expect(opts.webPreferences.sandbox).toBe(true);
    expect(opts.webPreferences.contextIsolation).toBe(true);
    expect(opts.webPreferences.nodeIntegration).toBe(false);
    expect(opts.webPreferences.webSecurity).toBe(true);
  });

  it("é um overlay frameless/transparent/always-on-top/skipTaskbar/não-focável", () => {
    expect(opts.frame).toBe(false);
    expect(opts.transparent).toBe(true);
    expect(opts.alwaysOnTop).toBe(true);
    expect(opts.skipTaskbar).toBe(true);
    expect(opts.focusable).toBe(false);
    expect(ALWAYS_ON_TOP_LEVEL).toBe("screen-saver");
  });

  it("inclui o preload quando dado; omite quando não", () => {
    expect(opts.webPreferences.preload).toBe("/preload.js");
    expect(buildOverlayWindowOptions().webPreferences.preload).toBeUndefined();
  });
});

describe("buildCsp", () => {
  it("é estrita: script-src 'self', object-src/frame-ancestors none", () => {
    const csp = buildCsp();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("adiciona as origens de connect-src dadas (WS de estado)", () => {
    const csp = buildCsp({ connectSrc: ["wss://vera.example"] });
    expect(csp).toContain("connect-src 'self' wss://vera.example");
  });
});

describe("isAllowedNavigationUrl (allowlist)", () => {
  const allow = ["https://vera.example"];

  it("permite file: (app empacotado) e origens na allowlist", () => {
    expect(isAllowedNavigationUrl("file:///index.html", allow)).toBe(true);
    expect(isAllowedNavigationUrl("https://vera.example/x", allow)).toBe(true);
  });

  it("nega origens fora da allowlist e URLs inválidas", () => {
    expect(isAllowedNavigationUrl("https://evil.example/x", allow)).toBe(false);
    expect(isAllowedNavigationUrl("not a url", allow)).toBe(false);
    expect(isAllowedNavigationUrl("javascript:alert(1)", allow)).toBe(false);
  });

  it("nega blob:/data: mesmo com origem de confiança, e credenciais embebidas", () => {
    expect(isAllowedNavigationUrl("blob:https://vera.example/uuid", allow)).toBe(false);
    expect(isAllowedNavigationUrl("data:text/html,<script>1</script>", allow)).toBe(false);
    expect(isAllowedNavigationUrl("https://x@evil.example/x", allow)).toBe(false);
  });
});
