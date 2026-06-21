import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, count, countDistinct, desc, eq, isNull } from "drizzle-orm";

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

export interface UpdateCliente {
  name?: string;
  sector?: string | null;
  website?: string | null;
  description?: string | null;
  location?: string | null;
  founded?: string | null;
  headcount?: string | null;
  linkedinUrl?: string | null;
  techStack?: string[] | null;
}

/** Atualiza a ficha do cliente (a Filipa edita). Predicado por agência (§15.1). */
export async function updateCliente(
  db: Db,
  agencyId: string,
  id: string,
  input: UpdateCliente,
): Promise<void> {
  await db
    .update(schema.client)
    .set(input)
    .where(and(eq(schema.client.id, id), eq(schema.client.agencyId, agencyId)));
}

export interface ClienteRow {
  id: string;
  name: string;
  sector: string | null;
  logoUrl: string | null;
  numVagas: number;
  numCandidatos: number;
}

/** Lista os clientes (não apagados) da agência, com setor + nº de vagas + candidatos no funil. */
export function listClientes(db: Db, agencyId: string): Promise<ClienteRow[]> {
  return db
    .select({
      id: schema.client.id,
      name: schema.client.name,
      sector: schema.client.sector,
      logoUrl: schema.client.logoUrl,
      numVagas: countDistinct(schema.job.id),
      numCandidatos: countDistinct(schema.process.id),
    })
    .from(schema.client)
    .leftJoin(
      schema.job,
      and(eq(schema.job.clientId, schema.client.id), isNull(schema.job.deletedAt)),
    )
    .leftJoin(
      schema.process,
      and(eq(schema.process.jobId, schema.job.id), isNull(schema.process.deletedAt)),
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

export interface ClienteFacto {
  factType: string; // preference | rejection_reason | context
  factText: string;
}

export interface ClienteCriterio {
  criterio: string;
  peso: string; // must | normal | nice
}

/** Reunião/intake com o cliente — nota + excerto da transcrição (proveniência do facto). */
export interface ClienteReuniao {
  titulo: string;
  data: string | null;
  excerto: string | null;
}

export interface ClienteDetail {
  id: string;
  name: string;
  sector: string | null;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
  location: string | null;
  founded: string | null;
  headcount: string | null;
  linkedinUrl: string | null;
  techStack: string[] | null;
  vagas: ClienteVaga[];
  /** O que sabemos deste cliente (de reuniões/intake): valoriza, não aceita, contexto. */
  factos: ClienteFacto[];
  /** Critérios que este cliente pede sempre (viram rubric). */
  criterios: ClienteCriterio[];
  /** Reuniões/intake registadas (com excerto de transcrição). */
  reunioes: ClienteReuniao[];
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
      location: schema.client.location,
      founded: schema.client.founded,
      headcount: schema.client.headcount,
      linkedinUrl: schema.client.linkedinUrl,
      techStack: schema.client.techStack,
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

  const allFacts = await db
    .select({
      factType: schema.clientMemoryFact.factType,
      factText: schema.clientMemoryFact.factText,
      sourceRef: schema.clientMemoryFact.sourceRef,
      sourceSnippet: schema.clientMemoryFact.sourceSnippet,
    })
    .from(schema.clientMemoryFact)
    .where(
      and(
        eq(schema.clientMemoryFact.clientId, id),
        eq(schema.clientMemoryFact.agencyId, agencyId),
        isNull(schema.clientMemoryFact.deletedAt),
      ),
    )
    .orderBy(desc(schema.clientMemoryFact.createdAt));

  const factos: ClienteFacto[] = allFacts
    .filter((f) => f.factType !== "meeting")
    .map((f) => ({ factType: f.factType, factText: f.factText }));
  const reunioes: ClienteReuniao[] = allFacts
    .filter((f) => f.factType === "meeting")
    .map((f) => ({ titulo: f.factText, data: f.sourceRef, excerto: f.sourceSnippet }));

  const criterios: ClienteCriterio[] = await db
    .select({
      criterio: schema.clientCriteria.criterio,
      peso: schema.clientCriteria.peso,
    })
    .from(schema.clientCriteria)
    .where(
      and(
        eq(schema.clientCriteria.clientId, id),
        eq(schema.clientCriteria.agencyId, agencyId),
        isNull(schema.clientCriteria.deletedAt),
      ),
    )
    .orderBy(desc(schema.clientCriteria.createdAt));

  return { ...c, vagas, factos, criterios, reunioes };
}
