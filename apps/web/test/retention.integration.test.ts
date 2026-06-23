import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  purgeExpiredPersonalFacts,
  purgeOldAsyncJobs,
  redactExpiredIntakeRaw,
  redactExpiredSourceDocs,
  runRetention,
} from "../lib/retention";

const url = process.env.TEST_DATABASE_URL;
const DAY = 86_400_000;
const NOW = new Date("2026-06-22T12:00:00.000Z");
const past = (d: number) => new Date(NOW.getTime() - d * DAY);
const future = (d: number) => new Date(NOW.getTime() + d * DAY);

const AG = randomUUID();
const AG2 = randomUUID();
const REC = randomUUID();
const CAND = randomUUID();

describe.skipIf(!url)("integração — retenção por TTL", () => {
  let handle: DbHandle;
  let db: DbHandle["db"];
  beforeAll(async () => {
    handle = createDb(url as string);
    db = handle.db;
    await db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa Ret" });
    await db.insert(schema.candidate).values({ id: CAND, agencyId: AG, name: "Cand Ret" });
  });
  afterAll(() => handle?.close());

  it("personal facts expirados saem; professional e personal-futuro ficam", async () => {
    const expired = randomUUID();
    const prof = randomUUID();
    const futuro = randomUUID();
    await db.insert(schema.candidateMemoryFact).values([
      {
        id: expired,
        candidateId: CAND,
        agencyId: AG,
        competencia: "x",
        factText: "pessoal velho",
        classificacao: "personal",
        retainUntil: past(1),
      },
      {
        id: prof,
        candidateId: CAND,
        agencyId: AG,
        competencia: "x",
        factText: "profissional",
        classificacao: "professional",
        retainUntil: past(1), // mesmo expirado, professional NÃO sai por tempo
      },
      {
        id: futuro,
        candidateId: CAND,
        agencyId: AG,
        competencia: "x",
        factText: "pessoal fresco",
        classificacao: "personal_saude_titular",
        retainUntil: future(30),
      },
    ]);
    const n = await purgeExpiredPersonalFacts(db, AG, NOW);
    expect(n).toBe(1);
    const ids = (
      await db
        .select({ id: schema.candidateMemoryFact.id })
        .from(schema.candidateMemoryFact)
        .where(eq(schema.candidateMemoryFact.candidateId, CAND))
    ).map((r) => r.id);
    expect(ids).toContain(prof);
    expect(ids).toContain(futuro);
    expect(ids).not.toContain(expired);
  });

  it("source_doc expirado: redige raw_text e mantém o summary", async () => {
    const exp = randomUUID();
    const fut = randomUUID();
    await db.insert(schema.sourceDoc).values([
      {
        id: exp,
        agencyId: AG,
        kind: "web",
        rawText: "html cru com PII",
        summary: "resumo destilado",
        expiresAt: past(1),
      },
      {
        id: fut,
        agencyId: AG,
        kind: "web",
        rawText: "ainda válido",
        expiresAt: future(30),
      },
    ]);
    const n = await redactExpiredSourceDocs(db, AG, NOW);
    expect(n).toBe(1);
    const [a] = await db
      .select({ rawText: schema.sourceDoc.rawText, summary: schema.sourceDoc.summary })
      .from(schema.sourceDoc)
      .where(eq(schema.sourceDoc.id, exp));
    expect(a?.rawText).toBeNull();
    expect(a?.summary).toBe("resumo destilado"); // sinal preservado
    const [b] = await db
      .select({ rawText: schema.sourceDoc.rawText })
      .from(schema.sourceDoc)
      .where(eq(schema.sourceDoc.id, fut));
    expect(b?.rawText).toBe("ainda válido");
  });

  it("intake_message: redige o cru >30d após confirmar; não toca em recente nem por-confirmar", async () => {
    const velho = randomUUID();
    const recente = randomUUID();
    const porConfirmar = randomUUID();
    await db.insert(schema.intakeMessage).values([
      {
        id: velho,
        agencyId: AG,
        recruiterId: REC,
        source: "telegram",
        rawText: "cru velho",
        confirmedAt: past(40),
      },
      {
        id: recente,
        agencyId: AG,
        recruiterId: REC,
        source: "telegram",
        rawText: "cru recente",
        confirmedAt: past(10),
      },
      {
        id: porConfirmar,
        agencyId: AG,
        recruiterId: REC,
        source: "telegram",
        rawText: "ainda por confirmar",
      },
    ]);
    const n = await redactExpiredIntakeRaw(db, AG, NOW);
    expect(n).toBe(1);
    const get = async (id: string) =>
      (
        await db
          .select({ rawText: schema.intakeMessage.rawText })
          .from(schema.intakeMessage)
          .where(eq(schema.intakeMessage.id, id))
      )[0]?.rawText;
    expect(await get(velho)).toBeNull();
    expect(await get(recente)).toBe("cru recente");
    expect(await get(porConfirmar)).toBe("ainda por confirmar");
  });

  it("async_job done/failed >30d apaga; recente e running ficam", async () => {
    const doneVelho = randomUUID();
    const doneRecente = randomUUID();
    const runningVelho = randomUUID();
    await db.insert(schema.asyncJob).values([
      {
        id: doneVelho,
        agencyId: AG,
        recruiterId: REC,
        kind: "sourcing",
        status: "done",
        updatedAt: past(40),
      },
      {
        id: doneRecente,
        agencyId: AG,
        recruiterId: REC,
        kind: "sourcing",
        status: "done",
        updatedAt: past(10),
      },
      {
        id: runningVelho,
        agencyId: AG,
        recruiterId: REC,
        kind: "sourcing",
        status: "running",
        updatedAt: past(40),
      },
    ]);
    const n = await purgeOldAsyncJobs(db, AG, NOW);
    expect(n).toBe(1);
    const ids = (
      await db
        .select({ id: schema.asyncJob.id })
        .from(schema.asyncJob)
        .where(eq(schema.asyncJob.recruiterId, REC))
    ).map((r) => r.id);
    expect(ids).toContain(doneRecente);
    expect(ids).toContain(runningVelho);
    expect(ids).not.toContain(doneVelho);
  });

  it("runRetention é agency-scoped: não toca nos dados de outra agência", async () => {
    const intruso = randomUUID();
    await db.insert(schema.asyncJob).values({
      id: intruso,
      agencyId: AG2, // OUTRA agência
      recruiterId: REC,
      kind: "sourcing",
      status: "done",
      updatedAt: past(99),
    });
    const result = await runRetention(db, AG, { now: NOW });
    expect(result).toHaveProperty("asyncJobs");
    // o job da AG2 continua lá (não foi purgado pela corrida da AG)
    const [still] = await db
      .select({ id: schema.asyncJob.id })
      .from(schema.asyncJob)
      .where(eq(schema.asyncJob.id, intruso));
    expect(still?.id).toBe(intruso);
  });
});

describe("runRetention — guard anti-falha-silenciosa", () => {
  it("agencyId vazio → lança (não corre uma purga sem tenant)", async () => {
    await expect(runRetention({} as never, "")).rejects.toThrow(/agencyId/);
  });
});
