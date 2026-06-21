import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteMemoryFact, listMemoryFacts, saveMemoryFact } from "../lib/assistant/memory";

const url = process.env.TEST_DATABASE_URL;
const AG = "a5000000-0000-4000-8000-000000000001";
const REC = "a5000000-0000-4000-8000-000000000091";
const OTHER = "a5000000-0000-4000-8000-0000000000ff";

describe.skipIf(!url)("integração — onboarding/memory do recrutador (apps/web)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa O" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("guarda um facto e aparece na lista", async () => {
    const id = await saveMemoryFact(handle.db, AG, REC, {
      text: "assina 'Abraço, Filipa'",
      kind: "style",
      sourceRef: "assinatura",
    });
    const facts = await listMemoryFacts(handle.db, AG, REC, { limit: 100 });
    expect(facts.some((f) => f.id === id)).toBe(true);
  });

  it("soft-delete remove da lista; remover de novo → false", async () => {
    const id = await saveMemoryFact(handle.db, AG, REC, {
      text: "evita reuniões depois das 18h",
      kind: "preference",
    });
    expect(await deleteMemoryFact(handle.db, AG, REC, id)).toBe(true);
    const facts = await listMemoryFacts(handle.db, AG, REC, { limit: 100 });
    expect(facts.some((f) => f.id === id)).toBe(false);
    expect(await deleteMemoryFact(handle.db, AG, REC, id)).toBe(false);
  });

  it("isola por recrutador: outro recruiter não remove o facto do dono", async () => {
    const id = await saveMemoryFact(handle.db, AG, REC, {
      text: "facto do dono",
      kind: "preference",
    });
    expect(await deleteMemoryFact(handle.db, AG, OTHER, id)).toBe(false);
    expect(await deleteMemoryFact(handle.db, AG, REC, id)).toBe(true);
  });
});
