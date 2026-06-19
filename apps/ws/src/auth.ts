import { verifyJwt } from "./jwt";
import type { WsServerHooks } from "./server";

export interface WsAuthOptions {
  /** Segredo HS256 (do env `WS_JWT_SECRET`). Vazio → todas as ligações são recusadas (4401). */
  secret: string;
  /**
   * Posse da entrevista (cobre `can_join_interview`, AUTENTICACAO §4). A app injeta a query
   * (`SELECT 1 FROM interview WHERE id=$1 AND recruiter_id=$2`) → @rh/ws fica SEM @rh/db.
   */
  verifyOwnership(interviewId: string, recruiterId: string): Promise<boolean> | boolean;
  /** Relógio injetável (testes). Default: agora. */
  now?: () => number;
}

/**
 * Hook real de autenticação do WS (v1): valida o JWT HS256 (assinatura+exp → 4401) e a **posse**
 * da entrevista (→ 4403). Substitui o stub injetado. O segredo NUNCA é hardcoded (vem do env).
 */
export function createWsAuthenticate(opts: WsAuthOptions): WsServerHooks["authenticate"] {
  return async (accessToken, interviewId) => {
    if (!opts.secret) {
      return { ok: false, code: 4401 };
    }
    const nowSec = Math.floor((opts.now?.() ?? Date.now()) / 1000);
    const verified = verifyJwt(accessToken, opts.secret, nowSec);
    if (!verified.ok) {
      return { ok: false, code: 4401 };
    }
    let owns: boolean;
    try {
      owns = await opts.verifyOwnership(interviewId, verified.payload.sub);
    } catch {
      // Erro na verificação de posse (ex.: DB) → fail-closed (nega, não deixa a ligação pendente).
      return { ok: false, code: 4401 };
    }
    if (!owns) {
      return { ok: false, code: 4403 };
    }
    return { ok: true, actorId: verified.payload.sub };
  };
}
