/**
 * Rate-limit do login (SEGURANÇA Ω). Janela deslizante de falhas por chave (IP+email) + lockout
 * temporário após N falhas. In-memory e por-processo.
 *
 * ⚠️ PRODUÇÃO: num deploy multi-instância (serverless/várias réplicas) isto NÃO é partilhado entre
 * processos — um atacante distribuído contorna-o. Antes de produção, mover o estado para um store
 * partilhado (Redis/Upstash) com a MESMA interface (`RateLimiter`). A lógica fica idêntica; só muda
 * o backend do `Map`. Aqui mantém-se in-memory (single-tenant IRIS, instância única) — defesa real
 * contra brute-force trivial, sem dependência nova no v1.
 */

export interface RateLimitConfig {
  /** Falhas permitidas dentro da janela antes do lockout. */
  maxAttempts: number;
  /** Janela deslizante (ms) onde as falhas contam. */
  windowMs: number;
  /** Duração do bloqueio (ms) depois de exceder `maxAttempts`. */
  lockoutMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Segundos até poder tentar de novo (só quando `allowed:false`). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitDecision;
  recordFailure(key: string): void;
  recordSuccess(key: string): void;
}

interface Entry {
  /** Timestamps (ms) das falhas recentes dentro da janela. */
  failures: number[];
  /** Epoch ms até quando a chave está bloqueada (0 = não bloqueada). */
  lockedUntil: number;
}

/** Defaults sensatos para o login (5 falhas / 5 min de janela → 15 min de bloqueio). */
export const DEFAULT_LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 5 * 60_000,
  lockoutMs: 15 * 60_000,
};

const ALLOWED: RateLimitDecision = { allowed: true, retryAfterSeconds: 0 };

/**
 * Cria um rate-limiter in-memory. `now` é injetável (testes deterministas, sem timers reais).
 * Estado por chave: descarta falhas fora da janela a cada toque (sem leak ilimitado por chave ativa).
 */
export function createLoginRateLimiter(
  config: RateLimitConfig = DEFAULT_LOGIN_RATE_LIMIT,
  now: () => number = Date.now,
): RateLimiter {
  const entries = new Map<string, Entry>();

  function prune(entry: Entry, t: number): void {
    const cutoff = t - config.windowMs;
    entry.failures = entry.failures.filter((ts) => ts > cutoff);
  }

  return {
    check(key) {
      const entry = entries.get(key);
      if (!entry) {
        return ALLOWED;
      }
      const t = now();
      if (entry.lockedUntil > t) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((entry.lockedUntil - t) / 1000),
        };
      }
      return ALLOWED;
    },

    recordFailure(key) {
      const t = now();
      const entry = entries.get(key) ?? { failures: [], lockedUntil: 0 };
      prune(entry, t);
      entry.failures.push(t);
      if (entry.failures.length >= config.maxAttempts) {
        entry.lockedUntil = t + config.lockoutMs;
        entry.failures = []; // já bloqueado; recomeça a contar após o lockout
      }
      entries.set(key, entry);
    },

    recordSuccess(key) {
      // Login bem-sucedido → limpa o histórico de falhas dessa chave (não pune o utilizador legítimo).
      entries.delete(key);
    },
  };
}
