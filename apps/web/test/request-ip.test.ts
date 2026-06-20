import { describe, expect, it } from "vitest";
import { clientIp, isHttps } from "../lib/request-ip";

function req(headers: Record<string, string>, url = "http://localhost/x"): Request {
  return new Request(url, { headers });
}

describe("clientIp", () => {
  it("usa o 1.º IP do x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }))).toBe("203.0.113.1");
  });
  it("cai para x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });
  it("sem header → unknown (fail-safe, não permissivo)", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("isHttps", () => {
  it("x-forwarded-proto=https → true", () => {
    expect(isHttps(req({ "x-forwarded-proto": "https" }))).toBe(true);
  });
  it("x-forwarded-proto=http → false", () => {
    expect(isHttps(req({ "x-forwarded-proto": "http" }))).toBe(false);
  });
  it("sem header → deriva do URL (https → true, http → false)", () => {
    expect(isHttps(req({}, "https://app.iris.tech/x"))).toBe(true);
    expect(isHttps(req({}, "http://localhost/x"))).toBe(false);
  });
  it("x-forwarded-proto com lista usa o 1.º", () => {
    expect(isHttps(req({ "x-forwarded-proto": "https, http" }))).toBe(true);
  });
});
