import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, isNull } from "drizzle-orm";

type Db = DbHandle["db"];

export interface NewCliente {
  name: string;
  notes?: string;
}

/** Cria um cliente na agência. `agency_id` predicado desde a v1 (§15.1). */
export async function createCliente(
  db: Db,
  agencyId: string,
  input: NewCliente,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db
    .insert(schema.client)
    .values({ id, agencyId, name: input.name, notes: input.notes ?? null });
  return { id };
}

export interface ClienteRow {
  id: string;
  name: string;
}

/** Lista os clientes (não apagados) da agência, mais recentes primeiro. */
export function listClientes(db: Db, agencyId: string): Promise<ClienteRow[]> {
  return db
    .select({ id: schema.client.id, name: schema.client.name })
    .from(schema.client)
    .where(and(eq(schema.client.agencyId, agencyId), isNull(schema.client.deletedAt)))
    .orderBy(desc(schema.client.createdAt));
}
