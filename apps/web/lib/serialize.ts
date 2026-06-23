import type { DbHandle } from "@rh/db";
import { sql } from "drizzle-orm";

type Db = DbHandle["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Serialização da ENTIDADE GLOBAL (família G, ARQUITETURA-TEMPO-REAL §11.1/4): o `candidate` é
 * partilhado (a Filipa **e** a Inês podem entrevistar o mesmo candidato em paralelo). Operações que
 * tocam o estado "geral" do candidato — `candidate.profile`, `revalidate_after`, promoção de factos a
 * `process=NULL` — passam por um **advisory lock por `candidate_id`** (fila por entidade) → sem
 * last-write-wins quando o mesmo candidato está em 2 calls simultâneas.
 *
 * `pg_advisory_xact_lock` liberta automaticamente no fim da transação (commit/rollback) — sem risco de
 * lock órfão se `fn` lançar. `hashtextextended` mapeia o UUID (texto) para a chave `bigint` do lock
 * (int8 → colisão entre candidatos distintos é desprezável, ao contrário do `hashtext` int4).
 *
 * ⚠️ `fn` DEVE usar a `tx` recebida para todas as escritas que precisem de estar sob o lock —
 * usar o `db` original lá dentro corre noutra conexão e ESCAPA à serialização.
 */
export async function withCandidateLock<T>(
  db: Db,
  candidateId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${candidateId}, 0))`);
    return fn(tx);
  });
}
