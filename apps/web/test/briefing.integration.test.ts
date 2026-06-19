import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateBriefing } from "../lib/briefing";
import { DEV_RECRUITER_ID } from "../lib/vagas";

const url = process.env.TEST_DATABASE_URL;
const AG = "a4000000-0000-4000-8000-000000000001";
const CLIENT = "a4000000-0000-4000-8000-0000000000c1";
const JOB = "a4000000-0000-4000-8000-0000000000b1";

describe.skipIf(!url)("integração — briefing lib (apps/web)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    const db = handle.db;
    await db
      .insert(schema.client)
      .values({ id: CLIENT, agencyId: AG, name: "C" })
      .onConflictDoNothing();
    await db
      .insert(schema.recruiter)
      .values({ id: DEV_RECRUITER_ID, agencyId: AG, userId: randomUUID(), name: "Filipa" })
      .onConflictDoNothing();
    await db
      .insert(schema.job)
      .values({
        id: JOB,
        agencyId: AG,
        clientId: CLIENT,
        recruiterId: DEV_RECRUITER_ID,
        title: "Dev",
        roleTypeSlug: "dev",
        requirements: {},
      })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("compila rubric (com requisitoId) + briefing e persiste a rubric", async () => {
    const { rubric, briefing } = await generateBriefing(handle.db, AG, { jobId: JOB });
    expect(rubric.criteria[0]?.requisitoId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(briefing.perguntas.length).toBeGreaterThan(0);

    const saved = await handle.db
      .select({ id: schema.rubric.id })
      .from(schema.rubric)
      .where(eq(schema.rubric.jobId, JOB));
    expect(saved.length).toBe(1);
  });
});
