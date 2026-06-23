import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * JWT HS256 mínimo (sem dependências) para o WS v1 (AUTENTICACAO §4). O segredo vem do env
 * (`WS_JWT_SECRET`) — NUNCA hardcoded. O Supabase Auth real (RS256 + JWKS) entra na FASE Ω.
 */

export interface JwtPayload {
  /** recruiter_id (subject). */
  sub: string;
  /** expiração em epoch-segundos. */
  exp: number;
}

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Assina um JWT HS256. */
export function signJwt(payload: JwtPayload, secret: string): string {
  const data = `${b64urlJson({ alg: "HS256", typ: "JWT" })}.${b64urlJson(payload)}`;
  return `${data}.${sign(data, secret)}`;
}

export type VerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "bad_payload" };

function isPayload(v: unknown): v is JwtPayload {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as JwtPayload).sub === "string" &&
    (v as JwtPayload).sub.length > 0 &&
    typeof (v as JwtPayload).exp === "number"
  );
}

/** Verifica assinatura HS256 (tempo constante) + `exp`. `nowSec` injetável p/ testes. */
export function verifyJwt(token: string, secret: string, nowSec: number): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, reason: "malformed" };
  }
  const [header, body, sig] = parts;
  if (header === undefined || body === undefined || sig === undefined) {
    return { ok: false, reason: "malformed" };
  }
  // Recusa explícita de algorithm-confusion: SÓ HS256 (o header não é decorativo).
  let head: unknown;
  try {
    head = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof head !== "object" || head === null || (head as { alg?: unknown }).alg !== "HS256") {
    return { ok: false, reason: "malformed" };
  }
  // `sig` e `expected` são ambos base64url (Node Buffer): comprimentos iguais sse os HMAC raw o
  // forem (HS256 = 32 bytes → 43 chars). timingSafeEqual sobre os bytes da string é seguro.
  const expected = sign(`${header}.${body}`, secret);
  const got = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!isPayload(payload)) {
    return { ok: false, reason: "bad_payload" };
  }
  if (payload.exp <= nowSec) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
