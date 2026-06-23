import { randomUUID } from "node:crypto";
import type { TickOutput } from "@rh/ai";
import type { EstadoVivo } from "@rh/core";
import { createDb, type DbHandle, schema as s } from "@rh/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { transitionInterview } from "../lib/interviews";
import { withCandidateLock } from "../lib/serialize";
import { persistTick, readTicks } from "../lib/ticks";
import { InterviewClosedError, persistChunk } from "../lib/transcript";

const url = process.env.TEST_DATABASE_URL;
const AG = "a8000000-0000-4000-8000-000000000001";
const REC = "a8000000-0000-4000-8000-000000000091";

function estado(resumo: string): EstadoVivo {
  return {
    requisitos: [],
    interessesCliente: [],
    afirmacoesCandidato: [],
    perguntasFeitas: [],
    redFlags: [],
    resumoCorrente: resumo,
  };
}
const tick = (resumo: string): TickOutput => ({ estado: estado(resumo), suggestion: null });

/** Cria uma entrevista 'live' (insert direto — evita a árvore client/job/process). */
async function liveInterview(db: DbHandle["db"]): Promise<string> {
  const id = randomUUID();
  await db
    .insert(s.interview)
    .values({ id, agencyId: AG, recruiterId: REC, status: "live", captureType: "none" });
  return id;
}

describe.skipIf(!url)("integração — serialização família G (§11.1)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(s.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa G" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("persistTick recusa escrita após o encerramento (escritor único pára, §11.1/3)", async () => {
    const interviewId = await liveInterview(handle.db);
    const r1 = await persistTick(handle.db, AG, interviewId, 0, tick("ao vivo"));
    expect(r1).toEqual({ persisted: true, tickN: 0 });

    await transitionInterview(handle.db, AG, interviewId, "done");

    const r2 = await persistTick(handle.db, AG, interviewId, 1, tick("tardio"));
    expect(r2).toEqual({ persisted: false, tickN: 1, reason: "interview_closed" });
    // O tick tardio NÃO foi escrito — só o que entrou enquanto viva.
    expect(await readTicks(handle.db, AG, interviewId)).toHaveLength(1);
  });

  it("persistChunk recusa escrita após o encerramento (lança InterviewClosedError, §11.1/1)", async () => {
    const interviewId = await liveInterview(handle.db);
    const c1 = await persistChunk(handle.db, AG, {
      interviewId,
      seq: 1,
      speaker: "candidate",
      tsStart: "00:00",
      text: "ao vivo",
    });
    expect(c1.contentHash).toBeTruthy();

    await transitionInterview(handle.db, AG, interviewId, "done");

    await expect(
      persistChunk(handle.db, AG, {
        interviewId,
        seq: 2,
        speaker: "candidate",
        tsStart: "00:05",
        text: "tardio",
      }),
    ).rejects.toBeInstanceOf(InterviewClosedError);

    const rows = await handle.db
      .select({ id: s.transcriptChunk.id })
      .from(s.transcriptChunk)
      .where(eq(s.transcriptChunk.interviewId, interviewId));
    expect(rows).toHaveLength(1); // só o chunk vivo
  });

  it("withCandidateLock serializa o MESMO candidato (exclusão mútua, §11.1/4)", async () => {
    const other = createDb(url as string);
    const cid = randomUUID();
    try {
      // Enquanto o lock é TIDO por uma conexão, outra conexão NÃO o consegue (try → false).
      let lockedWhileHeld: unknown;
      const result = await withCandidateLock(handle.db, cid, async () => {
        const r = await other.db.execute(
          sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${cid}, 0)) AS ok`,
        );
        lockedWhileHeld = (r.rows as Array<{ ok: boolean }>)[0]?.ok;
        return "feito";
      });
      expect(result).toBe("feito"); // devolve o valor do callback
      expect(lockedWhileHeld).toBe(false); // a 2ª conexão ficou bloqueada do mesmo candidato

      // Libertado no fim da transação → agora a 2ª conexão consegue.
      const r2 = await other.db.execute(
        sql`SELECT pg_try_advisory_xact_lock(hashtext(${cid})) AS ok`,
      );
      expect((r2.rows as Array<{ ok: boolean }>)[0]?.ok).toBe(true);
    } finally {
      other.close();
    }
  });

  it("withCandidateLock NÃO bloqueia candidatos DIFERENTES", async () => {
    const other = createDb(url as string);
    const cidA = randomUUID();
    const cidB = randomUUID();
    try {
      let bLockedWhileAHeld: unknown;
      await withCandidateLock(handle.db, cidA, async () => {
        const r = await other.db.execute(
          sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${cidB}, 0)) AS ok`,
        );
        bLockedWhileAHeld = (r.rows as Array<{ ok: boolean }>)[0]?.ok;
      });
      expect(bLockedWhileAHeld).toBe(true); // candidato B livre enquanto A está tido
    } finally {
      other.close();
    }
  });

  it("withCandidateLock LIBERTA o lock se o callback lança (rollback, sem lock órfão)", async () => {
    const other = createDb(url as string);
    const cid = randomUUID();
    try {
      await expect(
        withCandidateLock(handle.db, cid, async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      // O rollback da transação libertou o advisory lock → a 2ª conexão consegue-o.
      const r = await other.db.execute(
        sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${cid}, 0)) AS ok`,
      );
      expect((r.rows as Array<{ ok: boolean }>)[0]?.ok).toBe(true);
    } finally {
      other.close();
    }
  });
});
