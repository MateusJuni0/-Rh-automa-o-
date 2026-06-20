import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, count, desc, eq, isNull } from "drizzle-orm";

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
  sector: string | null;
  logoUrl: string | null;
  numVagas: number;
}

/** Lista os clientes (não apagados) da agência, com setor + nº de vagas abertas. */
export function listClientes(db: Db, agencyId: string): Promise<ClienteRow[]> {
  return db
    .select({
      id: schema.client.id,
      name: schema.client.name,
      sector: schema.client.sector,
      logoUrl: schema.client.logoUrl,
      numVagas: count(schema.job.id),
    })
    .from(schema.client)
    .leftJoin(
      schema.job,
      and(eq(schema.job.clientId, schema.client.id), isNull(schema.job.deletedAt)),
    )
    .where(and(eq(schema.client.agencyId, agencyId), isNull(schema.client.deletedAt)))
    .groupBy(schema.client.id)
    .orderBy(desc(schema.client.createdAt));
}

export interface ClienteVaga {
  id: string;
  title: string;
  roleTypeSlug: string;
  numCandidatos: number;
}

export interface ClienteDetail {
  id: string;
  name: string;
  sector: string | null;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
  vagas: ClienteVaga[];
}

/** Ficha do cliente: perfil + as suas vagas (cada uma com nº de candidatos no funil). */
export async function getCliente(
  db: Db,
  agencyId: string,
  id: string,
): Promise<ClienteDetail | null> {
  const [c] = await db
    .select({
      id: schema.client.id,
      name: schema.client.name,
      sector: schema.client.sector,
      website: schema.client.website,
      description: schema.client.description,
      logoUrl: schema.client.logoUrl,
    })
    .from(schema.client)
    .where(
      and(
        eq(schema.client.id, id),
        eq(schema.client.agencyId, agencyId),
        isNull(schema.client.deletedAt),
      ),
    );
  if (!c) {
    return null;
  }
  const vagas = await db
    .select({
      id: schema.job.id,
      title: schema.job.title,
      roleTypeSlug: schema.job.roleTypeSlug,
      numCandidatos: count(schema.process.id),
    })
    .from(schema.job)
    .leftJoin(
      schema.process,
      and(eq(schema.process.jobId, schema.job.id), isNull(schema.process.deletedAt)),
    )
    .where(
      and(
        eq(schema.job.clientId, id),
        eq(schema.job.agencyId, agencyId),
        isNull(schema.job.deletedAt),
      ),
    )
    .groupBy(schema.job.id)
    .orderBy(desc(schema.job.createdAt));
  return { ...c, vagas };
}
