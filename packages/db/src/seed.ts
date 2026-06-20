import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/** IDs fixos do seed (deterministas → idempotência). */
export const SEED_IDS = {
  agency: "11111111-0000-4000-8000-000000000001",
  recruiterFilipa: "22222222-0000-4000-8000-000000000001",
  recruiterInes: "22222222-0000-4000-8000-000000000002",
  client: "44444444-0000-4000-8000-000000000001",
  job: "55555555-0000-4000-8000-000000000001",
  jobWaiting: "55555555-0000-4000-8000-000000000002",
  candidate: "66666666-0000-4000-8000-000000000001",
  process: "77777777-0000-4000-8000-000000000001",
  interviewSoon: "88888888-0000-4000-8000-000000000001",
  interviewLater: "88888888-0000-4000-8000-000000000002",
} as const;

const FILIPA_USER_ID = "33333333-0000-4000-8000-000000000001";
const INES_USER_ID = "33333333-0000-4000-8000-000000000002";

/**
 * Seed de dev (INFRA-E-MIGRACAO §8): 1 agência IRIS + Filipa/Inês + 1 cliente + 1 vaga + 1 candidato
 * + o `process` que os liga. Idempotente (UUIDs fixos + `onConflictDoNothing`) — re-correr não duplica.
 */
export async function seed(db: NodePgDatabase<typeof schema>): Promise<typeof SEED_IDS> {
  await db
    .insert(schema.agency)
    .values({ id: SEED_IDS.agency, name: "IRIS Tech" })
    .onConflictDoNothing();

  await db
    .insert(schema.recruiter)
    .values([
      {
        id: SEED_IDS.recruiterFilipa,
        agencyId: SEED_IDS.agency,
        userId: FILIPA_USER_ID,
        name: "Filipa",
      },
      { id: SEED_IDS.recruiterInes, agencyId: SEED_IDS.agency, userId: INES_USER_ID, name: "Inês" },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.client)
    .values({ id: SEED_IDS.client, agencyId: SEED_IDS.agency, name: "TechCorp (demo)" })
    .onConflictDoNothing();

  await db
    .insert(schema.job)
    .values({
      id: SEED_IDS.job,
      agencyId: SEED_IDS.agency,
      clientId: SEED_IDS.client,
      recruiterId: SEED_IDS.recruiterFilipa,
      title: "Dev Frontend React Pleno",
      roleTypeSlug: "dev_frontend_react_pleno",
      requirements: { must: ["React", "TypeScript"], nice: ["Next.js"] },
    })
    .onConflictDoNothing();

  // Vaga SEM candidatos (demo da secção "Vagas à espera" no painel).
  await db
    .insert(schema.job)
    .values({
      id: SEED_IDS.jobWaiting,
      agencyId: SEED_IDS.agency,
      clientId: SEED_IDS.client,
      recruiterId: SEED_IDS.recruiterFilipa,
      title: "Backend Python Sénior",
      roleTypeSlug: "dev_backend_python_senior",
      requirements: { must: ["Python", "PostgreSQL"], nice: ["FastAPI"] },
    })
    .onConflictDoNothing();

  await db
    .insert(schema.candidate)
    .values({
      id: SEED_IDS.candidate,
      agencyId: SEED_IDS.agency,
      name: "João Demonstração",
      nameNormalized: "joao demonstracao",
      email: "joao.demo@example.com",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.process)
    .values({
      id: SEED_IDS.process,
      agencyId: SEED_IDS.agency,
      candidateId: SEED_IDS.candidate,
      jobId: SEED_IDS.job,
      recruiterId: SEED_IDS.recruiterFilipa,
      stage: "screening",
    })
    .onConflictDoNothing();

  // 2 entrevistas agendadas (demo da agenda do painel). startedAt relativo ao seed → fica no futuro.
  const now = Date.now();
  await db
    .insert(schema.interview)
    .values([
      {
        id: SEED_IDS.interviewSoon,
        agencyId: SEED_IDS.agency,
        processId: SEED_IDS.process,
        candidateId: SEED_IDS.candidate,
        recruiterId: SEED_IDS.recruiterFilipa,
        status: "scheduled",
        startedAt: new Date(now + 35 * 60 * 1000),
      },
      {
        id: SEED_IDS.interviewLater,
        agencyId: SEED_IDS.agency,
        processId: SEED_IDS.process,
        candidateId: SEED_IDS.candidate,
        recruiterId: SEED_IDS.recruiterFilipa,
        status: "scheduled",
        startedAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
      },
    ])
    .onConflictDoNothing();

  return SEED_IDS;
}
