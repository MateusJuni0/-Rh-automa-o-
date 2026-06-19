import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listMemoryFacts, saveMemoryFact, searchMemoryFacts } from "../lib/assistant/memory";
import { confirmAction, runMessage } from "../lib/assistant/run";

const url = process.env.TEST_DATABASE_URL;
const AG = randomUUID();
const REC = randomUUID();
const OTHER = randomUUID();

describe.skipIf(!url)("integração — memória durável do recrutador", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db.insert(schema.recruiter).values([
      { id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa M" },
      { id: OTHER, agencyId: AG, userId: randomUUID(), name: "Inês M" },
    ]);
  });
  afterAll(() => handle?.close());

  it("save → list → search, isolado por recruiter", async () => {
    await saveMemoryFact(handle.db, AG, REC, { text: "O cliente Acme prefere comunicação em PT." });
    const facts = await listMemoryFacts(handle.db, AG, REC);
    expect(facts.some((f) => f.factText.includes("Acme"))).toBe(true);
    const hits = await searchMemoryFacts(handle.db, AG, REC, "Acme");
    expect(hits).toHaveLength(1);
    // outro recrutador da mesma agência NÃO vê o facto
    const otherFacts = await listMemoryFacts(handle.db, AG, OTHER);
    expect(otherFacts.some((f) => f.factText.includes("Acme"))).toBe(false);
  });

  it("'anota que X' → pending_confirm → confirma → facto persistido (recall)", async () => {
    const turn = await runMessage(handle.db, AG, REC, {
      message: "anota que a Maria fala alemão fluente",
    });
    const action = turn.actions[0];
    expect(action?.tool).toBe("save_memory_fact");
    expect(action?.efeito).toBe("gravar");
    expect(action?.status).toBe("pending_confirm");
    // antes da confirmação não há facto
    expect(await searchMemoryFacts(handle.db, AG, REC, "alemão")).toHaveLength(0);
    // confirma → persiste
    await confirmAction(handle.db, AG, REC, action?.actionId ?? "");
    const hits = await searchMemoryFacts(handle.db, AG, REC, "alemão");
    expect(hits.some((f) => f.factText.includes("alemão"))).toBe(true);
  });
});
