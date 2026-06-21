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
  reportId: string;
  actionId: string;
  sessionId: string;
}

/**
 * Semeia um candidato com a subárvore RGPD COMPLETA numa agência, com PII em todos os campos de
 * texto livre + o ground-truth de calibração (`client_verdict`/`placement_outcome`/`report`) e o
 * custo operacional (`interview_tick`). Prova a regra-mãe (DATA-RETENTION §6): apagar = ANONIMIZAR.
 */
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
  const reportId = randomUUID();
  const actionId = randomUUID();
  const sessionId = randomUUID();

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
  // Candidato com PII em TODOS os campos sensíveis — têm de ficar limpos após a purga.
  await db.insert(s.candidate).values({
    id: candidateId,
    agencyId,
    name: "Esquecível Silva",
    nameNormalized: `esq-${candidateId}`,
    email: "esquecivel@example.com",
    phone: "+351900000000",
    linkedinUrl: "https://linkedin.com/in/esquecivel",
    profile: { skillsDeclaradas: ["x"], experienciaAnos: 5, gapsCv: [], resumo: "PII no resumo" },
  });
  // Processo com motivo/refs em texto livre (PII a limpar), mas a LINHA sobrevive (FK do ground-truth).
  await db.insert(s.process).values({
    id: processId,
    agencyId,
    candidateId,
    jobId,
    recruiterId,
    stage: "interview",
    consentStatus: "dado",
    statusReason: "Esquecível recusado (PII no motivo)",
    consentEvidenceRef: "ref-doc-pii",
  });
  // Entrevista do parecer + sala com nome (PII no livekit_room).
  await db.insert(s.interview).values({
    id: interviewId,
    agencyId,
    recruiterId,
    processId,
    candidateId,
    livekitRoom: "sala-EsquecivelSilva-20260601",
  });
  // interview_tick: estado vivo (PII) + custo operacional (a PRESERVAR — DATA-RETENTION §1.6).
  await db.insert(s.interviewTick).values({
    id: randomUUID(),
    agencyId,
    interviewId,
    tickN: 1,
    liveState: { nota: "PII no estado vivo" },
    suggestion: { texto: "PII na sugestão", lente: "tecnica" },
    tokensIn: 100,
    tokensOut: 50,
    modelUsed: "claude-opus-4-8",
  });
  // Camada A (transcrição = PII bruta — desaparece).
  await db.insert(s.transcriptChunk).values({
    id: randomUUID(),
    agencyId,
    interviewId,
    seq: 1,
    speaker: "candidate",
    tsStart: "00:00",
    text: "PII na transcrição",
  });
  // Parecer: conteúdo livre (PII) + veredito estrutural (ground-truth a PRESERVAR).
  await db.insert(s.report).values({
    id: reportId,
    agencyId,
    interviewId,
    contentMd: "Parecer de Esquecível Silva (PII)",
    contentEdited: "Edição da Filipa sobre Esquecível (PII)",
    contentClientMd: "Versão cliente sobre Esquecível (PII)",
    filipaOverrideReason: "motivo do override (PII)",
    botVerdict: "weak",
    status: "ready",
  });
  // Ground-truth da calibração — TEM de sobreviver SEM PII (DATA-RETENTION §6, §1.6).
  await db.insert(s.clientVerdict).values({
    id: randomUUID(),
    agencyId,
    processId,
    reportId,
    verdict: "rejected",
    reason: "o cliente disse que Esquecível não servia (PII)",
    reasonType: "skill_gap",
    botPredicted: "weak",
  });
  await db.insert(s.placementOutcome).values({
    id: randomUUID(),
    agencyId,
    processId,
    decision: "rejected",
    declineReason: "motivo com PII",
    botPredicted: "weak",
    guaranteeResult: "pending",
  });
  // Entrevista ÓRFÃ (process NULL, sem parecer) — sem ground-truth → apagada (Ω-1).
  await db.insert(s.interview).values({
    id: orphanInterviewId,
    agencyId,
    recruiterId,
    processId: null,
    candidateId,
    status: "unstructured",
  });
  await db.insert(s.interviewTick).values({
    id: randomUUID(),
    agencyId,
    interviewId: orphanInterviewId,
    tickN: 1,
    liveState: {},
  });
  // Thread do assistente ligada ao candidato (active_context.candidate_id) + mensagem — Ω-1.
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
  // Trilho de auditoria: a LINHA sobrevive (redigida); `args` + `result_ref` (PII) são limpos.
  await db.insert(s.assistantAction).values({
    id: actionId,
    agencyId,
    recruiterId,
    threadId,
    tool: "ler_candidato",
    args: { nome: "PII nos args" },
    resultRef: `candidates/${candidateId}/cv.pdf`,
  });
  // async_job com PII no JSONB, ligado ao candidato — apagado (Ω-1).
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
  await db.insert(s.proactiveTask).values({
    id: randomUUID(),
    agencyId,
    recruiterId,
    kind: "prep_summary",
    targetType: "candidate",
    targetId: candidateId,
    dueAt: new Date(),
  });
  // Sessão de intake (PII no messages_raw) → redigida; a mensagem (PII) → apagada.
  await db.insert(s.intakeSession).values({
    id: sessionId,
    agencyId,
    recruiterId,
    telegramChatId: 12345,
    status: "confirmed",
    targetEntity: "candidate_cv",
    messagesRaw: [{ from: "filipa", text: "CV de Esquecível Silva (PII)" }],
    extraction: { nome: "Esquecível (PII)" },
  });
  await db.insert(s.intakeMessage).values({
    id: randomUUID(),
    agencyId,
    recruiterId,
    source: "web_upload",
    sessionId,
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
    reportId,
    actionId,
    sessionId,
  };
}

/** Estreita uma linha que a invariante diz existir SEMPRE (âncora preservada) — falha alto se faltar. */
function must<T>(row: T | undefined, label: string): T {
  if (!row) throw new Error(`linha-âncora ausente no snapshot: ${label}`);
  return row;
}

/** Lê o estado pós-purga: as linhas preservadas (com campos) + as contagens da PII que deve sumir. */
async function snapshot(db: DbHandle["db"], sc: Scenario) {
  const cand = must(
    (await db.select().from(s.candidate).where(eq(s.candidate.id, sc.candidateId)))[0],
    "candidate",
  );
  const proc = must(
    (await db.select().from(s.process).where(eq(s.process.id, sc.processId)))[0],
    "process",
  );
  const cv = must(
    (await db.select().from(s.clientVerdict).where(eq(s.clientVerdict.processId, sc.processId)))[0],
    "client_verdict",
  );
  const po = must(
    (
      await db
        .select()
        .from(s.placementOutcome)
        .where(eq(s.placementOutcome.processId, sc.processId))
    )[0],
    "placement_outcome",
  );
  const rep = must(
    (await db.select().from(s.report).where(eq(s.report.id, sc.reportId)))[0],
    "report",
  );
  const iv = must(
    (await db.select().from(s.interview).where(eq(s.interview.id, sc.interviewId)))[0],
    "interview",
  );
  const tick = must(
    (
      await db.select().from(s.interviewTick).where(eq(s.interviewTick.interviewId, sc.interviewId))
    )[0],
    "interview_tick",
  );
  const act = must(
    (await db.select().from(s.assistantAction).where(eq(s.assistantAction.id, sc.actionId)))[0],
    "assistant_action",
  );
  const sess = must(
    (await db.select().from(s.intakeSession).where(eq(s.intakeSession.id, sc.sessionId)))[0],
    "intake_session",
  );
  const count = async (rows: { id: string }[]) => rows.length;
  const removed = {
    chunk: await count(
      await db
        .select({ id: s.transcriptChunk.id })
        .from(s.transcriptChunk)
        .where(eq(s.transcriptChunk.interviewId, sc.interviewId)),
    ),
    fact: await count(
      await db
        .select({ id: s.candidateMemoryFact.id })
        .from(s.candidateMemoryFact)
        .where(eq(s.candidateMemoryFact.candidateId, sc.candidateId)),
    ),
    ptask: await count(
      await db
        .select({ id: s.proactiveTask.id })
        .from(s.proactiveTask)
        .where(eq(s.proactiveTask.targetId, sc.candidateId)),
    ),
    imsg: await count(
      await db
        .select({ id: s.intakeMessage.id })
        .from(s.intakeMessage)
        .where(eq(s.intakeMessage.entityId, sc.candidateId)),
    ),
    orphanIv: await count(
      await db
        .select({ id: s.interview.id })
        .from(s.interview)
        .where(eq(s.interview.id, sc.orphanInterviewId)),
    ),
    orphanTick: await count(
      await db
        .select({ id: s.interviewTick.id })
        .from(s.interviewTick)
        .where(eq(s.interviewTick.interviewId, sc.orphanInterviewId)),
    ),
    thread: await count(
      await db
        .select({ id: s.assistantThread.id })
        .from(s.assistantThread)
        .where(eq(s.assistantThread.id, sc.threadId)),
    ),
    amsg: await count(
      await db
        .select({ id: s.assistantMessage.id })
        .from(s.assistantMessage)
        .where(eq(s.assistantMessage.threadId, sc.threadId)),
    ),
    ajob: await count(
      await db
        .select({ id: s.asyncJob.id })
        .from(s.asyncJob)
        .where(eq(s.asyncJob.id, sc.asyncJobId)),
    ),
  };
  return { cand, proc, cv, po, rep, iv, tick, act, sess, removed };
}

const ZERO = {
  chunk: 0,
  fact: 0,
  ptask: 0,
  imsg: 0,
  orphanIv: 0,
  orphanTick: 0,
  thread: 0,
  amsg: 0,
  ajob: 0,
};

describe.skipIf(!url)("integração — purga RGPD anonimiza e preserva calibração", () => {
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

  it("anonimiza o candidato e PRESERVA o ground-truth de calibração SEM PII", async () => {
    const summary = await purgeCandidate(handle.db, AG_A, a.candidateId);
    expect(summary.anonymized).toBe(true);

    const after = await snapshot(handle.db, a);

    // Candidato: a linha SOBREVIVE (âncora dos outcomes), anonimizada e sem PII.
    expect(after.cand.anonymizedAt).not.toBeNull();
    expect(after.cand.deletedAt).not.toBeNull();
    expect(after.cand.name).toBe("[anonimizado]");
    expect(after.cand.email).toBeNull();
    expect(after.cand.phone).toBeNull();
    expect(after.cand.linkedinUrl).toBeNull();
    expect(after.cand.nameNormalized).toBeNull();
    expect(after.cand.profile).toEqual({});

    // Processo: sobrevive (FK do ground-truth), texto livre limpo.
    expect(after.proc.statusReason).toBeNull();
    expect(after.proc.consentEvidenceRef).toBeNull();

    // client_verdict: PRESERVADO, sinal intacto, PII limpa.
    expect(after.cv.verdict).toBe("rejected");
    expect(after.cv.botPredicted).toBe("weak");
    expect(after.cv.reason).toBeNull();

    // placement_outcome: PRESERVADO, sinal intacto, PII limpa.
    expect(after.po.decision).toBe("rejected");
    expect(after.po.botPredicted).toBe("weak");
    expect(after.po.declineReason).toBeNull();

    // report: PRESERVADO (existe sem PII), veredito mantido, TODO o conteúdo livre a NULL.
    expect(after.rep.botVerdict).toBe("weak");
    expect(after.rep.contentMd).toBeNull();
    expect(after.rep.contentEdited).toBeNull();
    expect(after.rep.contentClientMd).toBeNull();
    expect(after.rep.filipaOverrideReason).toBeNull();
    expect(after.rep.staleReason).toBeNull();

    // interview do parecer mantida (FK report→interview), mas a sala (PII) limpa.
    expect(after.iv.livekitRoom).toBeNull();

    // interview_tick PRESERVADO: custo intacto (§1.6), estado vivo (PII) redigido.
    expect(after.tick.tokensIn).toBe(100);
    expect(after.tick.modelUsed).toBe("claude-opus-4-8");
    expect(after.tick.liveState).toEqual({});
    expect(after.tick.suggestion).toBeNull();

    // Auditoria: a LINHA sobrevive (redigida), payload + referência limpos, solta da thread apagada.
    expect(after.act.args).toEqual({});
    expect(after.act.resultRef).toBeNull();
    expect(after.act.threadId).toBeNull();

    // intake_session: a linha sobrevive (FK das mensagens), conteúdo cru (PII) redigido.
    expect(after.sess.messagesRaw).toEqual([]);
    expect(after.sess.extraction).toBeNull();

    // PII bruta: tudo a zero (inclui a entrevista órfã + o seu tick).
    expect(after.removed).toEqual(ZERO);
  });

  it("não toca em candidatos de OUTRA agência (isolamento)", async () => {
    const noop = await purgeCandidate(handle.db, AG_A, b.candidateId);
    expect(noop.anonymized).toBe(false);

    const bAfter = await snapshot(handle.db, b);
    // Tudo intacto, com PII original.
    expect(bAfter.cand.anonymizedAt).toBeNull();
    expect(bAfter.cand.name).toBe("Esquecível Silva");
    expect(bAfter.cand.email).toBe("esquecivel@example.com");
    expect(bAfter.proc.statusReason).not.toBeNull();
    expect(bAfter.cv.reason).not.toBeNull();
    expect(bAfter.rep.contentMd).not.toBeNull();
    expect(bAfter.iv.livekitRoom).not.toBeNull();
    expect(bAfter.tick.liveState).not.toEqual({});
    expect(bAfter.act.resultRef).not.toBeNull();
    expect(bAfter.sess.messagesRaw).not.toEqual([]);
    expect(bAfter.removed).toEqual({
      chunk: 1,
      fact: 1,
      ptask: 1,
      imsg: 1,
      orphanIv: 1,
      orphanTick: 1,
      thread: 1,
      amsg: 1,
      ajob: 1,
    });
  });
});
