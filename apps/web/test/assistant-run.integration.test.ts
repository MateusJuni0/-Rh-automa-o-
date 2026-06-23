import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmAction, runMessage } from "../lib/assistant/run";

const url = process.env.TEST_DATABASE_URL;
const AG = randomUUID();
const REC = randomUUID();

describe.skipIf(!url)("integração — assistant run (chat + porta)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa A" });
  });
  afterAll(() => handle?.close());

  it("intenção de leitura corre logo (comparar → done)", async () => {
    const turn = await runMessage(handle.db, AG, REC, { message: "compara o João e a Maria" });
    expect(turn.reply.length).toBeGreaterThan(0);
    expect(turn.actions).toHaveLength(1);
    expect(turn.actions[0]?.tool).toBe("comparar_candidatos");
    expect(turn.actions[0]?.status).toBe("done");
  });

  it("Q&A genérico → resposta sem ações", async () => {
    const turn = await runMessage(handle.db, AG, REC, { message: "o que achas dele no geral?" });
    expect(turn.actions).toHaveLength(0);
  });

  it("enviar_fora fica PENDENTE (não executa sem confirmação) e confirma idempotente", async () => {
    const turn = await runMessage(handle.db, AG, REC, { message: "envia o email ao cliente" });
    expect(turn.actions).toHaveLength(1);
    const action = turn.actions[0];
    expect(action?.tool).toBe("enviar_email");
    expect(action?.efeito).toBe("enviar_fora");
    expect(action?.status).toBe("pending_confirm");
    // o registo na DB está pending (não foi enviado)
    const id = action?.actionId ?? "";
    const [row] = await handle.db
      .select({ status: schema.assistantAction.status })
      .from(schema.assistantAction)
      .where(eq(schema.assistantAction.id, id));
    expect(row?.status).toBe("pending_confirm");
    // confirma → done
    const confirmed = await confirmAction(handle.db, AG, REC, id);
    expect(confirmed.status).toBe("done");
    // re-confirma → idempotente (continua done, sem rebentar)
    const again = await confirmAction(handle.db, AG, REC, id);
    expect(again.status).toBe("done");
  });
});
