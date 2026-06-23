import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmarIntake, ingerirMensagem } from "../lib/intake";
import { DEV_RECRUITER_ID } from "../lib/vagas";

const url = process.env.TEST_DATABASE_URL;
const AG = "a8000000-0000-4000-8000-000000000001";

describe.skipIf(!url)("integração — intake (apps/web)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.recruiter)
      .values({ id: DEV_RECRUITER_ID, agencyId: AG, userId: randomUUID(), name: "Filipa" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("ingere → grava intake_message por confirmar → confirma cria candidato (idempotente)", async () => {
    const ing = await ingerirMensagem(handle.db, AG, {
      source: "web_upload",
      text: "Encaminho o CV do João Silva, dev backend com 4 anos.",
    });
    expect(ing.envelope.alvo).toBe("candidato");
    expect(ing.messageId).toMatch(/^[0-9a-f-]{36}$/);

    const conf = await confirmarIntake(handle.db, AG, {
      messageId: ing.messageId,
      name: "João Silva",
    });
    expect(conf.created).toBe(true);
    expect(conf.entityType).toBe("candidate");
    expect(conf.entityId).toMatch(/^[0-9a-f-]{36}$/);

    // candidato existe
    const cands = await handle.db
      .select({ id: schema.candidate.id, name: schema.candidate.name })
      .from(schema.candidate)
      .where(and(eq(schema.candidate.id, conf.entityId ?? ""), eq(schema.candidate.agencyId, AG)));
    expect(cands[0]?.name).toBe("João Silva");

    // intake_message confirmado
    const [msg] = await handle.db
      .select({
        confirmedAt: schema.intakeMessage.confirmedAt,
        entityId: schema.intakeMessage.entityId,
      })
      .from(schema.intakeMessage)
      .where(eq(schema.intakeMessage.id, ing.messageId));
    expect(msg?.confirmedAt).not.toBeNull();
    expect(msg?.entityId).toBe(conf.entityId);

    // re-confirmar = no-op
    const again = await confirmarIntake(handle.db, AG, { messageId: ing.messageId });
    expect(again.created).toBe(false);
    expect(again.reason).toBe("já confirmado");
  });
});
