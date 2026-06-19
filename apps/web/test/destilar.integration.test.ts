import { createDb, type DbHandle, schema } from "@rh/db";
import { searchCandidateFacts } from "@rh/knowledge";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destilarFacto } from "../lib/destilar";
import { getEmbedder } from "../lib/embedder";

const url = process.env.TEST_DATABASE_URL;
const AG = "a6000000-0000-4000-8000-000000000001";
const CAND = "a6000000-0000-4000-8000-0000000000d1";

describe.skipIf(!url)("integração — destilar + RAG (apps/web)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.candidate)
      .values({ id: CAND, agencyId: AG, name: "Bruno" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("destila factos e o RAG devolve o mais próximo da query (isolado por agency)", async () => {
    await destilarFacto(handle.db, AG, {
      candidateId: CAND,
      competencia: "React",
      factText: "Domina React e hooks há três anos",
    });
    await destilarFacto(handle.db, AG, {
      candidateId: CAND,
      competencia: "Bases de dados",
      factText: "Experiência sólida com Postgres e indexação",
    });

    const results = await searchCandidateFacts(
      handle.db,
      { agencyId: AG, candidateId: CAND, query: "Domina React e hooks há três anos", k: 5 },
      getEmbedder(),
    );
    expect(results.length).toBeGreaterThanOrEqual(2);
    // texto exato → vetor idêntico → distância cosine ~0 → topo do ranking
    expect(results[0]?.factText).toBe("Domina React e hooks há três anos");
  });
});
