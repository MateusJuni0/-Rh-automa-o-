import { createFaceClient, createMockFaceClient, type FaceClient } from "./face";

/**
 * Factory config-not-code do cliente de biometria (server-only). Com `FACE_SERVICE_URL` → serviço
 * real (com a secret S2S no header); sem env → mock. A secret nunca vai ao browser. Sem hardcode.
 */
export function getFaceClient(): FaceClient {
  const baseUrl = process.env.FACE_SERVICE_URL;
  if (!baseUrl) {
    return createMockFaceClient();
  }
  return createFaceClient({ baseUrl, s2sSecret: process.env.FACE_S2S_SECRET });
}
