import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema as s } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { distillFinal } from "../lib/destilar";
import { persistChunk } from "../lib/transcript";

const url = process.env.TEST_DATABASE_URL;
const AG = "a8000000-0000-4000-8000-000000000001";
const REC = "a8000000-0000-4000-8000-000000000091";

describe.skipIf(!url)("integração — destilação-final durável (distill_final)", () => {
  let handle: DbHandle;
  let candidateId: string;
  let interviewId: string;

  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(s.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa D" })
      .onConflictDoNothing();
    candidateId = randomUUID();
    await handle.db.insert(s.candidate).values({
      id: candidateId,
      agencyId: AG,
      name: "Destilável",
      nameNormalized: `dest-${candidateId}`,
      profile: { skillsDeclaradas: [], experienciaAnos: null, gapsCv: [], resumo: "" },
    });
    interviewId = randomUUID();
    await handle.db.insert(s.interview).values({
      id: interviewId,
      agencyId: AG,
      recruiterId: REC,
      candidateId,
      status: "done",
      captureType: "none",
    });
    // Camada A: 1 do recrutador + 2 do candidato (só estes viram facto).
    await persistChunk(handle.db, AG, {
      interviewId,
      seq: 1,
      speaker: "recruiter",
      tsStart: "00:01",
      text: "Conta-me do teu percurso.",
    });
    await persistChunk(handle.db, AG, {
      interviewId,
      seq: 2,
      speaker: "candidate",
      tsStart: "00:05",
      text: "Liderei a migração para Next.js e cortei o LCP.",
    });
    await persistChunk(handle.db, AG, {
      interviewId,
      seq: 3,
      speaker: "candidate",
      tsStart: "00:12",
      text: "Construí um design system com 80 componentes.",
    });
  });
  afterAll(() => handle?.close());

  it("destila a Camada A → factos + seta distilled_at + job done", async () => {
    const r = await distillFinal(handle.db, AG, interviewId);
    expect(r.status).toBe("done");
    expect(r.factsCreated).toBe(2); // só os 2 chunks do candidato
    const facts = await handle.db
      .select({ id: s.candidateMemoryFact.id })
      .from(s.candidateMemoryFact)
      .where(eq(s.candidateMemoryFact.candidateId, candidateId));
    expect(facts.length).toBe(2);
    const [iv] = await handle.db
      .select({ distilledAt: s.interview.distilledAt })
      .from(s.interview)
      .where(eq(s.interview.id, interviewId));
    expect(iv?.distilledAt).not.toBeNull();
    expect(r.jobId).not.toBeNull();
    if (r.jobId) {
      const [job] = await handle.db
        .select({ status: s.asyncJob.status })
        .from(s.asyncJob)
        .where(eq(s.asyncJob.id, r.jobId));
      expect(job?.status).toBe("done");
    }
  });

  it("idempotente: re-correr não duplica factos (gate distilled_at)", async () => {
    const r2 = await distillFinal(handle.db, AG, interviewId);
    expect(r2.status).toBe("already_done");
    expect(r2.factsCreated).toBe(0);
    const facts = await handle.db
      .select({ id: s.candidateMemoryFact.id })
      .from(s.candidateMemoryFact)
      .where(eq(s.candidateMemoryFact.candidateId, candidateId));
    expect(facts.length).toBe(2); // continua 2, não 4
  });

  it("entrevista inexistente nesta agência → not_found", async () => {
    expect((await distillFinal(handle.db, AG, randomUUID())).status).toBe("not_found");
  });
});
