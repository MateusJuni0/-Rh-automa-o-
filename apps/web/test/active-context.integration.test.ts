import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseActiveContext } from "../lib/assistant/active-context";
import { runMessage } from "../lib/assistant/run";

const url = process.env.TEST_DATABASE_URL;
const AG = randomUUID();
const REC = randomUUID();
const ANA = randomUUID();
const RUI1 = randomUUID();
const RUI2 = randomUUID();
const CLIENT = randomUUID();

async function threadContext(db: DbHandle["db"], threadId: string) {
  const [t] = await db
    .select({ ac: schema.assistantThread.activeContext })
    .from(schema.assistantThread)
    .where(eq(schema.assistantThread.id, threadId));
  return parseActiveContext(t?.ac);
}

describe.skipIf(!url)("integração — contexto ativo do assistente", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    const db = handle.db;
    await db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa Ctx" });
    await db.insert(schema.client).values({ id: CLIENT, agencyId: AG, name: "Feedzai" });
    await db.insert(schema.candidate).values([
      {
        id: ANA,
        agencyId: AG,
        name: "Ana Marques",
        nameNormalized: `ana-${ANA}`,
        profile: { skillsDeclaradas: [], experienciaAnos: null, gapsCv: [], resumo: "" },
      },
      {
        id: RUI1,
        agencyId: AG,
        name: "Rui Silva",
        nameNormalized: `ruis-${RUI1}`,
        profile: { skillsDeclaradas: [], experienciaAnos: null, gapsCv: [], resumo: "" },
      },
      {
        id: RUI2,
        agencyId: AG,
        name: "Rui Costa",
        nameNormalized: `ruic-${RUI2}`,
        profile: { skillsDeclaradas: [], experienciaAnos: null, gapsCv: [], resumo: "" },
      },
    ]);
  });
  afterAll(() => handle?.close());

  it("foca o candidato mencionado e persiste no active_context", async () => {
    const turn = await runMessage(handle.db, AG, REC, { message: "fala-me da Ana Marques" });
    expect(turn.reply).toContain("Ana Marques");
    const ctx = await threadContext(handle.db, turn.threadId);
    expect(ctx.candidate_id).toBe(ANA);
  });

  it("HERDA o foco: o turno seguinte sem menção continua a falar da Ana", async () => {
    const t1 = await runMessage(handle.db, AG, REC, { message: "quero ver a Ana Marques" });
    const t2 = await runMessage(handle.db, AG, REC, {
      message: "e o que achas dela no geral?",
      threadId: t1.threadId,
    });
    expect(t2.reply).toContain("Ana Marques");
    const ctx = await threadContext(handle.db, t1.threadId);
    expect(ctx.candidate_id).toBe(ANA);
  });

  it("'o Rui' é AMBÍGUO (2 Ruis) → não foca ninguém (não cola ao primeiro)", async () => {
    const turn = await runMessage(handle.db, AG, REC, { message: "fala-me do Rui" });
    const ctx = await threadContext(handle.db, turn.threadId);
    expect(ctx.candidate_id).toBeUndefined();
  });

  it("mudar de foco para um cliente preserva o candidato em foco", async () => {
    const t1 = await runMessage(handle.db, AG, REC, { message: "abre a Ana Marques" });
    const t2 = await runMessage(handle.db, AG, REC, {
      message: "como vai o processo com a Feedzai?",
      threadId: t1.threadId,
    });
    const ctx = await threadContext(handle.db, t2.threadId);
    expect(ctx.client_id).toBe(CLIENT);
    expect(ctx.candidate_id).toBe(ANA);
  });
});
