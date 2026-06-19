import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { matchCandidatoVaga } from "../lib/match";
import { DEV_RECRUITER_ID } from "../lib/vagas";

const url = process.env.TEST_DATABASE_URL;
const AG = "a3000000-0000-4000-8000-000000000001";
const CLIENT = "a3000000-0000-4000-8000-0000000000c1";
const JOB = "a3000000-0000-4000-8000-0000000000a1";
const CAND = "a3000000-0000-4000-8000-0000000000d1";

describe.skipIf(!url)("integração — match lib (apps/web)", () => {
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
      .values({ id: CAND, agencyId: AG, name: "Cand Match", profile: { anos: 5 } })
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
        requirements: { must: ["React"] },
      })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("cria o process e devolve um MatchResult (stub)", async () => {
    const { processId, match } = await matchCandidatoVaga(handle.db, AG, {
      candidateId: CAND,
      jobId: JOB,
    });
    expect(processId).not.toBe("");
    expect(typeof match.matchScore).toBe("number");
    expect(Array.isArray(match.gapsAInvestigar)).toBe(true);
  });

  it("é idempotente no process (re-correr não duplica a candidatura)", async () => {
    const a = await matchCandidatoVaga(handle.db, AG, { candidateId: CAND, jobId: JOB });
    const b = await matchCandidatoVaga(handle.db, AG, { candidateId: CAND, jobId: JOB });
    expect(a.processId).toBe(b.processId);
  });
});
