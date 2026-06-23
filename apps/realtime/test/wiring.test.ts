import { describe, expect, it, vi } from "vitest";
import { chooseTranscriptMode } from "../src/wiring";

describe("chooseTranscriptMode (config-not-code: real vs mock)", () => {
  it("sem chaves → 'mock' (manual feed; €0)", () => {
    vi.stubEnv("SONIOX_API_KEY", "");
    vi.stubEnv("LIVEKIT_URL", "");
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    expect(chooseTranscriptMode()).toBe("mock");
    vi.unstubAllEnvs();
  });

  it("Soniox + LiveKit completos → 'live'", () => {
    vi.stubEnv("SONIOX_API_KEY", "k");
    vi.stubEnv("LIVEKIT_URL", "wss://x");
    vi.stubEnv("LIVEKIT_API_KEY", "k");
    vi.stubEnv("LIVEKIT_API_SECRET", "s");
    expect(chooseTranscriptMode()).toBe("live");
    vi.unstubAllEnvs();
  });

  it("Soniox sem LiveKit (ou vice-versa) → 'mock' (não meia-ligação)", () => {
    vi.stubEnv("SONIOX_API_KEY", "k");
    vi.stubEnv("LIVEKIT_URL", "");
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    expect(chooseTranscriptMode()).toBe("mock");
    vi.unstubAllEnvs();
  });
});
