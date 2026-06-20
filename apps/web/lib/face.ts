import { z } from "zod";

/**
 * Cliente do serviço de biometria (`services/face`). config-not-code: com `FACE_SERVICE_URL` →
 * chama o serviço real (challenge → enroll/verify com flash liveness); sem env → mock determinístico
 * (login facial demo sem câmara/serviço). `fetchImpl` injetável (testes sem rede). A secret S2S
 * (`FACE_S2S_SECRET`) vai no header só no servidor — NUNCA no browser. Sem segredos hardcoded.
 */

const rgb = z.tuple([z.number(), z.number(), z.number()]);

const challengeResponse = z.object({
  sequence: z.array(rgb),
  token: z.string().min(1),
});
export type FaceChallenge = z.infer<typeof challengeResponse>;

const verifyResponse = z.object({
  match: z.boolean(),
  score: z.number(),
  liveness_ok: z.boolean(),
  reason: z.string().nullable().optional(),
});
export type FaceVerifyResult = z.infer<typeof verifyResponse>;

export interface FaceFrame {
  imageB64: string;
  measuredColor: [number, number, number];
}

export interface FaceClient {
  challenge(): Promise<FaceChallenge>;
  verify(userId: string, token: string, frames: FaceFrame[]): Promise<FaceVerifyResult>;
}

export const FACE_ENABLED = Boolean(process.env.FACE_SERVICE_URL);

/** Mock determinístico: challenge fixo, verify sempre "vivo + match" (login facial demo). */
export function createMockFaceClient(): FaceClient {
  const sequence: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];
  return {
    challenge: () => Promise.resolve({ sequence, token: "mock-token" }),
    verify: () => Promise.resolve({ match: true, score: 1, liveness_ok: true, reason: null }),
  };
}

export interface RealFaceClientOptions {
  baseUrl: string;
  s2sSecret?: string;
  fetchImpl?: typeof fetch;
}

/** Cliente REAL do serviço face (server-only). Erro do serviço → lança (sem falha silenciosa). */
export function createFaceClient(opts: RealFaceClientOptions): FaceClient {
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.s2sSecret) {
    headers["x-face-s2s"] = opts.s2sSecret;
  }

  async function post(path: string, body: unknown): Promise<unknown> {
    const res = await doFetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`face service ${path}: ${res.status}`);
    }
    return res.json();
  }

  return {
    async challenge() {
      return challengeResponse.parse(await post("/challenge", {}));
    },
    async verify(userId, token, frames) {
      const payload = {
        user_id: userId,
        challenge_token: token,
        frames: frames.map((f) => ({ image_b64: f.imageB64, measured_color: f.measuredColor })),
      };
      return verifyResponse.parse(await post("/verify", payload));
    },
  };
}
