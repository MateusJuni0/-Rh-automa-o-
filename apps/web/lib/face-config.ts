import { createFaceClient, createMockFaceClient, type FaceClient } from "./face";

/**
 * ⛔ PORTÃO DE SEGURANÇA — o login por rosto está DESLIGADO por defeito (`FACE_AUTH_ENABLED` ausente).
 * A revisão de segurança (2026-06-20) provou que o caminho biométrico v1 é forjável (liveness
 * confia no cliente, "embedding" = hash dos bytes, enroll aberto, sessão por shim) → NÃO pode
 * autenticar ninguém. Enquanto OFF, as rotas de biometria respondem "desativado" e a UI cai no
 * login por senha (Supabase real). Só ligar `FACE_AUTH_ENABLED=1` DEPOIS de: (1) medir a cor no
 * servidor a partir da imagem; (2) modelo facial REAL atrás do `FaceEmbedder`; (3) `/enroll`
 * protegido (login prévio, user_id da sessão); (4) sessão emitida pela auth Supabase; (5) o serviço
 * Python validar a secret S2S + ficar só na rede interna; (6) challenge single-use + rate-limit.
 * Ver KEYS-TODO.md.
 */
export const FACE_AUTH_ENABLED =
  Boolean(process.env.FACE_AUTH_ENABLED) &&
  // ⛔ Acoplado à auth Supabase (revisão 2026-06-20, HIGH): o rosto NUNCA pode ligar sem a auth real,
  // senão emitia a sessão pelo shim de cookie inseguro (combinação `FACE on + AUTH off` = bypass).
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

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
