import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../src/index";
import * as schema from "../src/schema";
import { SEED_IDS, seed } from "../src/seed";

// Gated: só corre com TEST_DATABASE_URL (Postgres real com a migração aplicada).
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("integração — seed (Postgres real)", () => {
  let handle: DbHandle;
  beforeAll(() => {
    handle = createDb(url as string);
  });
  afterAll(() => handle?.close());

  it("insere IRIS + Filipa/Inês + cliente/vaga/candidato/process e é idempotente", async () => {
    await seed(handle.db);
    await seed(handle.db); // 2ª passagem não duplica nem falha (FK + onConflictDoNothing)

    const ag = await handle.db
      .select()
      .from(schema.agency)
      .where(eq(schema.agency.id, SEED_IDS.agency));
    expect(ag[0]?.name).toBe("IRIS Tech");

    const recs = await handle.db
      .select()
      .from(schema.recruiter)
      .where(eq(schema.recruiter.agencyId, SEED_IDS.agency));
    expect(recs.map((r) => r.name).sort()).toEqual(["Filipa", "Inês"]);

    // o process liga o candidato à vaga (FK integrity num DB real)
    const proc = await handle.db
      .select()
      .from(schema.process)
      .where(eq(schema.process.id, SEED_IDS.process));
    expect(proc[0]?.candidateId).toBe(SEED_IDS.candidate);
    expect(proc[0]?.jobId).toBe(SEED_IDS.job);
  });
});
