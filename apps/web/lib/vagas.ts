import { randomUUID } from "node:crypto";
import { extractJobRequirements } from "@rh/ai";
import type { JobRequirements } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { aiOptions } from "./ai";

type Db = DbHandle["db"];

/** Recrutadora por defeito (= Filipa do seed) até a auth dar o utilizador (Fase H). */
export const DEV_RECRUITER_ID = "22222222-0000-4000-8000-000000000001";

export interface NewVaga {
  clientId: string;
  title: string;
  roleTypeSlug?: string;
  /** Texto/documento do cliente — o cérebro extrai os requisitos estruturados. */
  requirementsText: string;
}

/** Requisitos canned (determinísticos) quando não há chave — demo sem custo. */
function stubRequirements(input: NewVaga): JobRequirements {
  return {
    roleType: input.roleTypeSlug ?? "demo_role",
    nivel: "pleno",
    skills: { must: [], nice: [] },
    contexto: input.requirementsText.slice(0, 500),
  };
}

/** Cria uma vaga, extraindo os requisitos do texto via `@rh/ai` (real com chave; stub sem). */
export async function createVaga(
  db: Db,
  agencyId: string,
  input: NewVaga,
  recruiterId: string = DEV_RECRUITER_ID,
): Promise<{ id: string; requirements: JobRequirements }> {
  const requirements = await extractJobRequirements(
    input.requirementsText,
    aiOptions(stubRequirements(input)),
  );
  const id = randomUUID();
  await db.insert(schema.job).values({
    id,
    agencyId,
    clientId: input.clientId,
    recruiterId,
    title: input.title,
    roleTypeSlug: requirements.roleType,
    requirements,
  });
  return { id, requirements };
}

export interface VagaRow {
  id: string;
  title: string;
  roleTypeSlug: string;
}

export function listVagas(db: Db, agencyId: string): Promise<VagaRow[]> {
  return db
    .select({ id: schema.job.id, title: schema.job.title, roleTypeSlug: schema.job.roleTypeSlug })
    .from(schema.job)
    .where(and(eq(schema.job.agencyId, agencyId), isNull(schema.job.deletedAt)))
    .orderBy(desc(schema.job.createdAt));
}
