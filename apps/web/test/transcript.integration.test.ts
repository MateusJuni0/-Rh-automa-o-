import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema as s } from "@rh/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { persistChunk, verifyChunkChain } from "../lib/transcript";

const url = process.env.TEST_DATABASE_URL;
const AG = "a7000000-0000-4000-8000-000000000001";
const REC = "a7000000-0000-4000-8000-000000000091";

describe.skipIf(!url)("integração — Camada A (transcript_chunk) + hash-chain", () => {
  let handle: DbHandle;
  let interviewId: string;

  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(s.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa T" })
      .onConflictDoNothing();
    interviewId = randomUUID();
    await handle.db.insert(s.interview).values({
      id: interviewId,
      agencyId: AG,
      recruiterId: REC,
      status: "live",
      captureType: "none",
    });
  });
  afterAll(() => handle?.close());

  it("persiste chunks com hash-chain encadeado (prev_hash = content_hash anterior)", async () => {
    const c1 = await persistChunk(handle.db, AG, {
      interviewId,
      seq: 1,
      speaker: "candidate",
      tsStart: "00:01",
      text: "Olá, sou a Sofia.",
    });
    const c2 = await persistChunk(handle.db, AG, {
      interviewId,
      seq: 2,
      speaker: "recruiter",
      tsStart: "00:05",
      text: "Fala-me do teu percurso.",
    });
    const c3 = await persistChunk(handle.db, AG, {
      interviewId,
      seq: 3,
      speaker: "candidate",
      tsStart: "00:10",
      text: "Liderei a migração para Next.js.",
    });
    expect(c1.prevHash).toBeNull();
    expect(c2.prevHash).toBe(c1.contentHash);
    expect(c3.prevHash).toBe(c2.contentHash);
    expect(await verifyChunkChain(handle.db, interviewId)).toEqual({
      ok: true,
      brokenAtSeq: null,
      count: 3,
    });
  });

  it("editar um chunk no Postgres QUEBRA a cadeia (tamper-evident, SEGURANCA §13.b)", async () => {
    // adultera o texto do chunk seq=2 diretamente (sem recomputar o hash) → a prova parte aí.
    await handle.db
      .update(s.transcriptChunk)
      .set({ text: "TEXTO ADULTERADO" })
      .where(and(eq(s.transcriptChunk.interviewId, interviewId), eq(s.transcriptChunk.seq, 2)));
    const verdict = await verifyChunkChain(handle.db, interviewId);
    expect(verdict.ok).toBe(false);
    expect(verdict.brokenAtSeq).toBe(2);
  });
});
