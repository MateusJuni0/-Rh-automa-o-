import { createDb, type DbHandle, schema } from "@rh/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { indexCandidateFact, mockEmbedder, searchCandidateFacts } from "../src/index";

// Gated: só com Postgres real + migração aplicada (TEST_DATABASE_URL).
const url = process.env.TEST_DATABASE_URL;

const AG = "aa000000-0000-4000-8000-000000000001";
const CAND = "cc000000-0000-4000-8000-000000000001";
const FACT = "ff000000-0000-4000-8000-000000000001";
const TEXT = "domina hooks e reconciliation no React";

describe.skipIf(!url)("integração — RAG do candidato (pgvector)", () => {
  let handle: DbHandle;
  const embedder = mockEmbedder();

  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.agency)
      .values({ id: AG, name: "RAG test" })
      .onConflictDoNothing();
    await handle.db
      .insert(schema.candidate)
      .values({ id: CAND, agencyId: AG, name: "Cand RAG" })
      .onConflictDoNothing();
    await handle.db
      .insert(schema.candidateMemoryFact)
      .values({ id: FACT, candidateId: CAND, agencyId: AG, competencia: "React", factText: TEXT })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await handle.db.execute(sql`delete from candidate_memory_embedding where fact_id = ${FACT}`);
    await handle.close();
  });

  it("indexa e recupera o facto pela mesma query (dist cosine ≈ 0)", async () => {
    await handle.db.execute(sql`delete from candidate_memory_embedding where fact_id = ${FACT}`);
    await indexCandidateFact(handle.db, { factId: FACT, agencyId: AG, text: TEXT }, embedder);

    const hits = await searchCandidateFacts(
      handle.db,
      { agencyId: AG, candidateId: CAND, query: TEXT, k: 5 },
      embedder,
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe(FACT);
    expect(Number(hits[0]?.dist)).toBeLessThan(0.0001); // mesma query → distância ~0
  });

  it("isola por agency_id (outra agência não vê o facto)", async () => {
    const hits = await searchCandidateFacts(
      handle.db,
      { agencyId: "bb000000-0000-4000-8000-000000000099", candidateId: CAND, query: TEXT },
      embedder,
    );
    expect(hits).toHaveLength(0);
  });
});
