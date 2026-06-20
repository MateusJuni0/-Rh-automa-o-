import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema as s } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { purgeCandidate } from "../lib/rgpd";

const url = process.env.TEST_DATABASE_URL;

interface Scenario {
  agencyId: string;
  candidateId: string;
  processId: string;
  interviewId: string;
  orphanInterviewId: string;
  threadId: string;
  asyncJobId: string;
}

/** Cria um candidato com processo+entrevista+tick+report+facto numa agência. Devolve os ids. */
async function seedScenario(db: DbHandle["db"], agencyId: string): Promise<Scenario> {
  const clientId = randomUUID();
  const recruiterId = randomUUID();
  const jobId = randomUUID();
  const candidateId = randomUUID();
  const processId = randomUUID();
  const interviewId = randomUUID();
  const orphanInterviewId = randomUUID();
  const threadId = randomUUID();
  const asyncJobId = randomUUID();

  await db.insert(s.client).values({ id: clientId, agencyId, name: "Cliente RGPD" });
  await db
    .insert(s.recruiter)
    .values({ id: recruiterId, agencyId, userId: randomUUID(), name: "Filipa RGPD" });
  await db.insert(s.job).values({
    id: jobId,
    agencyId,
    clientId,
    recruiterId,
    title: "Dev",
    roleTypeSlug: "dev_react",
    requirements: {
      roleType: "dev_react",
      nivel: "pleno",
      skills: { must: [], nice: [] },
      contexto: "",
    },
  });
  await db.insert(s.candidate).values({
    id: candidateId,
    agencyId,
    name: "Esquecível",
    nameNormalized: `esq-${candidateId}`,
    profile: { skillsDeclaradas: [], experienciaAnos: null, gapsCv: [], resumo: "" },
  });
  await db
    .insert(s.process)
    .values({ id: processId, agencyId, candidateId, jobId, recruiterId, stage: "interview" });
  await db
    .insert(s.interview)
    .values({ id: interviewId, agencyId, recruiterId, processId, candidateId });
  await db
    .insert(s.interviewTick)
    .values({ id: randomUUID(), agencyId, interviewId, tickN: 1, liveState: {} });
  await db.insert(s.report).values({ id: randomUUID(), agencyId, interviewId });
  // Entrevista ÓRFÃ (process NULL) atribuída ao candidato via candidate_id — Ω-1.
  await db.insert(s.interview).values({
    id: orphanInterviewId,
    agencyId,
    recruiterId,
    processId: null,
    candidateId,
    status: "unstructured",
  });
  await db
    .insert(s.interviewTick)
    .values({
      id: randomUUID(),
      agencyId,
      interviewId: orphanInterviewId,
      tickN: 1,
      liveState: {},
    });
  // Thread do assistente ligada ao candidato (active_context.candidate_id) + mensagem + ação — Ω-1.
  await db.insert(s.assistantThread).values({
    id: threadId,
    agencyId,
    recruiterId,
    activeContext: { candidate_id: candidateId },
  });
  await db.insert(s.assistantMessage).values({
    id: randomUUID(),
    threadId,
    agencyId,
    role: "recruiter",
    content: "menção PII ao candidato",
  });
  await db
    .insert(s.assistantAction)
    .values({ id: randomUUID(), agencyId, recruiterId, threadId, tool: "ler_candidato" });
  // async_job com PII no JSONB, ligado ao candidato via candidate_id — Ω-1.
  await db.insert(s.asyncJob).values({
    id: asyncJobId,
    agencyId,
    recruiterId,
    candidateId,
    kind: "gen_doc",
    args: { nome: "PII no args" },
  });
  await db.insert(s.candidateMemoryFact).values({
    id: randomUUID(),
    agencyId,
    candidateId,
    competencia: "Comunicação",
    factText: "PII a esquecer",
  });
  // PII polimórfica (sem FK)
  await db.insert(s.proactiveTask).values({
    id: randomUUID(),
    agencyId,
    recruiterId,
    kind: "prep_summary",
    targetType: "candidate",
    targetId: candidateId,
    dueAt: new Date(),
  });
  await db.insert(s.intakeMessage).values({
    id: randomUUID(),
    agencyId,
    recruiterId,
    source: "web_upload",
    rawText: "CV do candidato (PII)",
    entityType: "candidate_cv",
    entityId: candidateId,
  });
  return {
    agencyId,
    candidateId,
    processId,
    interviewId,
    orphanInterviewId,
    threadId,
    asyncJobId,
  };
}

async function counts(db: DbHandle["db"], sc: Scenario) {
  const cand = await db
    .select({ id: s.candidate.id })
    .from(s.candidate)
    .where(eq(s.candidate.id, sc.candidateId));
  const proc = await db
    .select({ id: s.process.id })
    .from(s.process)
    .where(eq(s.process.id, sc.processId));
  const iv = await db
    .select({ id: s.interview.id })
    .from(s.interview)
    .where(eq(s.interview.id, sc.interviewId));
  const tick = await db
    .select({ id: s.interviewTick.id })
    .from(s.interviewTick)
    .where(eq(s.interviewTick.interviewId, sc.interviewId));
  const rep = await db
    .select({ id: s.report.id })
    .from(s.report)
    .where(eq(s.report.interviewId, sc.interviewId));
  const fact = await db
    .select({ id: s.candidateMemoryFact.id })
    .from(s.candidateMemoryFact)
    .where(eq(s.candidateMemoryFact.candidateId, sc.candidateId));
  const ptask = await db
    .select({ id: s.proactiveTask.id })
    .from(s.proactiveTask)
    .where(eq(s.proactiveTask.targetId, sc.candidateId));
  const imsg = await db
    .select({ id: s.intakeMessage.id })
    .from(s.intakeMessage)
    .where(eq(s.intakeMessage.entityId, sc.candidateId));
  const orphanIv = await db
    .select({ id: s.interview.id })
    .from(s.interview)
    .where(eq(s.interview.id, sc.orphanInterviewId));
  const thread = await db
    .select({ id: s.assistantThread.id })
    .from(s.assistantThread)
    .where(eq(s.assistantThread.id, sc.threadId));
  const amsg = await db
    .select({ id: s.assistantMessage.id })
    .from(s.assistantMessage)
    .where(eq(s.assistantMessage.threadId, sc.threadId));
  const aact = await db
    .select({ id: s.assistantAction.id })
    .from(s.assistantAction)
    .where(eq(s.assistantAction.threadId, sc.threadId));
  const ajob = await db
    .select({ id: s.asyncJob.id })
    .from(s.asyncJob)
    .where(eq(s.asyncJob.id, sc.asyncJobId));
  return {
    candidate: cand.length,
    process: proc.length,
    interview: iv.length,
    tick: tick.length,
    report: rep.length,
    fact: fact.length,
    ptask: ptask.length,
    imsg: imsg.length,
    orphanIv: orphanIv.length,
    thread: thread.length,
    amsg: amsg.length,
    aact: aact.length,
    ajob: ajob.length,
  };
}

describe.skipIf(!url)("integração — purga RGPD em cascata", () => {
  let handle: DbHandle;
  const AG_A = randomUUID();
  const AG_B = randomUUID();
  let a: Scenario;
  let b: Scenario;

  beforeAll(async () => {
    handle = createDb(url as string);
    a = await seedScenario(handle.db, AG_A);
    b = await seedScenario(handle.db, AG_B);
  });
  afterAll(() => handle?.close());

  it("purga remove o candidato + toda a subárvore PII (resumo correto)", async () => {
    const before = await counts(handle.db, a);
    expect(before).toEqual({
      candidate: 1,
      process: 1,
      interview: 1,
      tick: 1,
      report: 1,
      fact: 1,
      ptask: 1,
      imsg: 1,
      orphanIv: 1,
      thread: 1,
      amsg: 1,
      aact: 1,
      ajob: 1,
    });

    const summary = await purgeCandidate(handle.db, AG_A, a.candidateId);
    expect(summary.removed.candidate).toBe(1);
    expect(summary.removed.process).toBe(1);
    // via-processo (1) + órfã (1) = 2 entrevistas e 2 ticks.
    expect(summary.removed.interview).toBe(2);
    expect(summary.removed.interview_tick).toBe(2);
    expect(summary.removed.report).toBe(1);
    expect(summary.removed.candidate_memory_fact).toBe(1);
    expect(summary.removed["proactive_task(candidate)"]).toBe(1);
    expect(summary.removed.intake_message).toBe(1);
    expect(summary.removed["async_job(candidate)"]).toBe(1);
    expect(summary.removed.assistant_message).toBe(1);
    expect(summary.removed.assistant_action).toBe(1);
    expect(summary.removed.assistant_thread).toBe(1);

    const after = await counts(handle.db, a);
    expect(after).toEqual({
      candidate: 0,
      process: 0,
      interview: 0,
      tick: 0,
      report: 0,
      fact: 0,
      ptask: 0,
      imsg: 0,
      orphanIv: 0,
      thread: 0,
      amsg: 0,
      aact: 0,
      ajob: 0,
    });
  });

  it("não toca em candidatos de OUTRA agência (isolamento)", async () => {
    // tentar purgar o candidato da agência B a partir da agência A = no-op
    const noop = await purgeCandidate(handle.db, AG_A, b.candidateId);
    expect(noop.removed.candidate).toBe(0);
    const bAfter = await counts(handle.db, b);
    expect(bAfter).toEqual({
      candidate: 1,
      process: 1,
      interview: 1,
      tick: 1,
      report: 1,
      fact: 1,
      ptask: 1,
      imsg: 1,
      orphanIv: 1,
      thread: 1,
      amsg: 1,
      aact: 1,
      ajob: 1,
    });
  });
});
