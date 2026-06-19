import { type SQL, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Isolamento de tenant na conexão (GUC) — contrato OBRIGATÓRIO (FASE-3-ARRANQUE §3,
 * SEGURANCA §1 / MODELO §15.9). Toda a unidade de trabalho corre numa transação curta com
 * `SET LOCAL app.agency_id` (via `set_config(..., is_local=true)`), e o reset é garantido pelo
 * fim da transação (o agente Python não pode furar o isolamento). As políticas RLS da v2 leem
 * `current_setting('app.agency_id', true)` — funciona mesmo quando `auth.uid()` é NULL (role de serviço).
 */
export const AGENCY_GUC = "app.agency_id";

/** SQL que fixa o tenant na transação corrente (is_local=true → reset no commit/rollback). */
export function setAgencyIdSql(agencyId: string): SQL {
  return sql`select set_config(${AGENCY_GUC}, ${agencyId}, true)`;
}

/** Executor mínimo (estruturalmente compatível com uma transação Drizzle). */
export interface TxExecutor {
  execute(query: SQL): Promise<unknown>;
}

/** DB capaz de abrir transações (estruturalmente compatível com `PgDatabase`). */
export interface TransactionalDb {
  transaction<T>(fn: (tx: TxExecutor) => Promise<T>): Promise<T>;
}

/**
 * Corre `fn` numa transação com o tenant fixado. NUNCA aceder à DB sem passar por aqui
 * (ou pelo equivalente no lado Python) — é o que garante o isolamento por `agency_id`.
 */
export async function withAgencySession<Db extends TransactionalDb, T>(
  db: Db,
  agencyId: string,
  fn: (tx: TxExecutor) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(setAgencyIdSql(agencyId));
    return fn(tx);
  });
}

/** Cliente Drizzle vivo (com schema tipado) + fecho do pool. */
export interface DbHandle {
  db: NodePgDatabase<typeof schema>;
  close(): Promise<void>;
}

/**
 * Cria o cliente Drizzle real sobre um pool `pg`. A `connectionString` vem do `DATABASE_URL`
 * (NUNCA hardcoded). O `db` satisfaz `TransactionalDb` → usar SEMPRE com `withAgencySession`.
 */
export function createDb(connectionString: string): DbHandle {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}
