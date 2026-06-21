import { describe, expect, it } from "vitest";
import { assertSafeUrl, isInternalHost, SsrfBlockedError } from "../lib/net/guarded-fetch";

describe("guard anti-SSRF (assertSafeUrl / isInternalHost)", () => {
  it("recusa esquemas não-http(s)", () => {
    for (const u of ["file:///etc/passwd", "ftp://x.com", "gopher://x", "data:text/html,x"]) {
      expect(() => assertSafeUrl(u)).toThrow(SsrfBlockedError);
    }
  });

  it("recusa localhost + IPs internos (loopback/RFC1918/link-local/metadata)", () => {
    const blocked = [
      "http://localhost/x",
      "http://127.0.0.1:8000/",
      "https://169.254.169.254/latest/meta-data/", // metadata cloud
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.0.1/",
      "http://172.31.255.1/",
      "http://0.0.0.0/",
      "http://[::1]/",
      "http://[fe80::1]/",
      "http://[fd00::1]/",
      "http://app.internal/",
      "http://db.local/",
    ];
    for (const u of blocked) {
      expect(() => assertSafeUrl(u), u).toThrow(SsrfBlockedError);
    }
  });

  it("aceita URLs públicos http(s)", () => {
    for (const u of [
      "https://feedzai.com/careers",
      "http://example.com/job/1",
      "https://www.linkedin.com/jobs/x",
    ]) {
      expect(assertSafeUrl(u).hostname.length).toBeGreaterThan(0);
    }
  });

  it("isInternalHost: IPv4-mapped IPv6 e variantes", () => {
    expect(isInternalHost("::ffff:127.0.0.1")).toBe(true);
    expect(isInternalHost("172.15.0.1")).toBe(false); // 172.15 é público (fora do 16-31)
    expect(isInternalHost("172.16.0.1")).toBe(true);
    expect(isInternalHost("11.0.0.1")).toBe(false); // 11/8 é público
    expect(isInternalHost("feedzai.com")).toBe(false);
  });

  it("URL malformado → SsrfBlockedError", () => {
    expect(() => assertSafeUrl("nao-e-url")).toThrow(SsrfBlockedError);
  });
});
