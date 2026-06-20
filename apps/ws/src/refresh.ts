import { signJwt, verifyJwt } from "./jwt";

/**
 * Refresh / rotação do token WS (1c). O protocolo congelado (`@rh/core`) tem o frame de SERVIDOR
 * `auth.refresh_needed` (sinaliza ao cliente "vai buscar token novo"), mas NÃO tem frame de
 * cliente→servidor para refresh. Por isso a rotação faz-se **ao nível do token/endpoint**: o
 * servidor emite `auth.refresh_needed` quando `shouldRefresh`; o cliente obtém um token novo
 * (via endpoint HTTP que chama `issueWsToken`/`refreshWsToken`) e **reautentica** com `auth`.
 * NÃO inventamos frames fora do protocolo.
 */

/** TTL por defeito de um token WS (curto — minimiza a janela de um token roubado). */
export const DEFAULT_WS_TOKEN_TTL_SEC = 15 * 60;

export interface IssueWsTokenInput {
  recruiterId: string;
  secret: string;
  /** Vida do token em segundos (default `DEFAULT_WS_TOKEN_TTL_SEC`). */
  ttlSec?: number;
  /** Relógio injetável (epoch-segundos). Default: agora. */
  now?: number;
}

/** Emite um JWT HS256 curto para o WS (`sub` = recruiterId, `exp` = now + ttl). */
export function issueWsToken(input: IssueWsTokenInput): string {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const exp = now + (input.ttlSec ?? DEFAULT_WS_TOKEN_TTL_SEC);
  return signJwt({ sub: input.recruiterId, exp }, input.secret);
}

export interface RefreshWsTokenInput {
  currentToken: string;
  secret: string;
  ttlSec?: number;
  now?: number;
}

export type RefreshWsTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "bad_payload" };

/**
 * Re-emite um token a partir de um válido (rotação). Só renova se o token actual ainda for
 * verificável (assinatura + não expirado) — fail-closed: token expirado/forjado NÃO é renovado.
 */
export function refreshWsToken(input: RefreshWsTokenInput): RefreshWsTokenResult {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const verified = verifyJwt(input.currentToken, input.secret, now);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason };
  }
  const token = issueWsToken({
    recruiterId: verified.payload.sub,
    secret: input.secret,
    ttlSec: input.ttlSec,
    now,
  });
  return { ok: true, token };
}

export interface ShouldRefreshInput {
  /** `exp` do token actual (epoch-segundos). */
  exp: number;
  /** Agora (epoch-segundos). */
  now: number;
  /** Antecedência: sinaliza refresh quando faltam ≤ thresholdSec para expirar. */
  thresholdSec: number;
}

/** Decide se o servidor deve emitir `auth.refresh_needed` (token perto de — ou já — expirado). */
export function shouldRefresh(input: ShouldRefreshInput): boolean {
  return input.exp - input.now <= input.thresholdSec;
}
