import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema as s } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmarIntake, ingerirMensagem, listPendingIntake } from "../lib/intake";

const url = process.env.TEST_DATABASE_URL;
const AG = "a9000000-0000-4000-8000-000000000001";
const REC = "a9000000-0000-4000-8000-000000000091";

describe.skipIf(!url)("integração — intake: porta de confirmação (pending → confirmado)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(s.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa I" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("ingerir → aparece por confirmar; confirmar cria a entidade e sai da lista", async () => {
    const { messageId, envelope } = await ingerirMensagem(handle.db, AG, {
      source: "web_upload",
      text: "CV: Sofia Marques, 5 anos React, liderou a migração para Next.js.",
      recruiterId: REC,
    });
    expect(envelope.intencao).toBe("novo_candidato");
    const before = await listPendingIntake(handle.db, AG);
    expect(before.some((p) => p.id === messageId)).toBe(true);

    const r = await confirmarIntake(handle.db, AG, { messageId, name: "Sofia Marques" });
    expect(r.created).toBe(true);
    expect(r.entityType).toBe("candidate");

    const after = await listPendingIntake(handle.db, AG);
    expect(after.some((p) => p.id === messageId)).toBe(false);
  });

  it("confirmar de novo é idempotente (já confirmado, não duplica)", async () => {
    const { messageId } = await ingerirMensagem(handle.db, AG, {
      source: "email",
      text: "outro CV qualquer para o teste de idempotência",
      recruiterId: REC,
    });
    await confirmarIntake(handle.db, AG, { messageId, name: "Teste" });
    const again = await confirmarIntake(handle.db, AG, { messageId });
    expect(again.created).toBe(false);
    expect(again.reason).toContain("já confirmado");
  });
});
