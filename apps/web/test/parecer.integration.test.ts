import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gerarParecer } from "../lib/parecer";
import { DEV_RECRUITER_ID } from "../lib/vagas";

const url = process.env.TEST_DATABASE_URL;
const AG = "a5000000-0000-4000-8000-000000000001";
const CLIENT = "a5000000-0000-4000-8000-0000000000c1";
const JOB = "a5000000-0000-4000-8000-0000000000b1";
const CAND = "a5000000-0000-4000-8000-0000000000d1";
const PROC = "a5000000-0000-4000-8000-0000000000e1";
const INTERVIEW = "a5000000-0000-4000-8000-0000000000f1";

describe.skipIf(!url)("integração — parecer lib (apps/web)", () => {
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
      .values({ id: CAND, agencyId: AG, name: "Ana Costa" })
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
    await db
      .insert(schema.interview)
      .values({
        id: INTERVIEW,
        agencyId: AG,
        processId: PROC,
        recruiterId: DEV_RECRUITER_ID,
        status: "done",
      })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("gera o parecer, renderiza markdown com o nome e persiste o report (idempotente)", async () => {
    const r1 = await gerarParecer(handle.db, AG, { interviewId: INTERVIEW });
    expect(r1.contentMd).toContain("# Parecer — Ana Costa");
    expect(r1.parecer.veredito.length).toBeGreaterThan(0);
    expect(r1.reportId).toMatch(/^[0-9a-f-]{36}$/);

    const r2 = await gerarParecer(handle.db, AG, { interviewId: INTERVIEW });
    expect(r2.reportId).toBe(r1.reportId); // interview_id UNIQUE → mesmo report

    const reports = await handle.db
      .select({ id: schema.report.id, status: schema.report.status })
      .from(schema.report)
      .where(eq(schema.report.interviewId, INTERVIEW));
    expect(reports.length).toBe(1);
    expect(reports[0]?.status).toBe("ready");
  });
});
