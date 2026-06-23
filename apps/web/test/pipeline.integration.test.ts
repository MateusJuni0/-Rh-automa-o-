import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listPipeline } from "../lib/pipeline";

const url = process.env.TEST_DATABASE_URL;
const AG = randomUUID();
const CLIENT = randomUUID();
const REC = randomUUID();
const JOB = randomUUID();
const CAND = randomUUID();
const PROC = randomUUID();

describe.skipIf(!url)("integração — pipeline (Tela 1)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    const db = handle.db;
    await db.insert(schema.client).values({ id: CLIENT, agencyId: AG, name: "C" });
    await db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa P" });
    await db.insert(schema.job).values({
      id: JOB,
      agencyId: AG,
      clientId: CLIENT,
      recruiterId: REC,
      title: "Dev Pipeline",
      roleTypeSlug: "dev",
    });
    await db.insert(schema.candidate).values({
      id: CAND,
      agencyId: AG,
      name: "Carla Pipe",
      nameNormalized: `carla-${CAND}`,
    });
    await db.insert(schema.process).values({
      id: PROC,
      agencyId: AG,
      candidateId: CAND,
      jobId: JOB,
      recruiterId: REC,
      stage: "screening",
    });
  });
  afterAll(() => handle?.close());

  it("lista os processos com nome do candidato + título da vaga + stage", async () => {
    const cards = await listPipeline(handle.db, AG);
    const card = cards.find((c) => c.processId === PROC);
    expect(card?.candidateName).toBe("Carla Pipe");
    expect(card?.jobTitle).toBe("Dev Pipeline");
    expect(card?.stage).toBe("screening");
    expect(card?.candidateId).toBe(CAND);
  });

  it("isola por agência (outra agência não vê)", async () => {
    const cards = await listPipeline(handle.db, randomUUID());
    expect(cards.some((c) => c.processId === PROC)).toBe(false);
  });
});
