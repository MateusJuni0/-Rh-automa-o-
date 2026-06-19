import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEV_RECRUITER_ID } from "../lib/vagas";
import { registarVerdict } from "../lib/verdict";

const url = process.env.TEST_DATABASE_URL;
const AG = "a7000000-0000-4000-8000-000000000001";
const CLIENT = "a7000000-0000-4000-8000-0000000000c1";
const JOB = "a7000000-0000-4000-8000-0000000000b1";
const CAND = "a7000000-0000-4000-8000-0000000000d1";
const PROC = "a7000000-0000-4000-8000-0000000000e1";

describe.skipIf(!url)("integração — verdict/calibração (apps/web)", () => {
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
      .insert(schema.candidate)
      .values({ id: CAND, agencyId: AG, name: "C" })
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
    await db
      .insert(schema.process)
      .values({
        id: PROC,
        agencyId: AG,
        candidateId: CAND,
        jobId: JOB,
        recruiterId: DEV_RECRUITER_ID,
      })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("grava o veredito do cliente com a previsão do bot e lê de volta", async () => {
    const { id } = await registarVerdict(handle.db, AG, {
      processId: PROC,
      verdict: "approved",
      botPredicted: "strong",
      reasonType: "skill_gap",
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const rows = await handle.db
      .select({ verdict: schema.clientVerdict.verdict, bot: schema.clientVerdict.botPredicted })
      .from(schema.clientVerdict)
      .where(eq(schema.clientVerdict.processId, PROC));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.verdict).toBe("approved");
    expect(rows[0]?.bot).toBe("strong");
  });
});
