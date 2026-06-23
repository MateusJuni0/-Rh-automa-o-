import { randomUUID } from "node:crypto";
import type { TickOutput } from "@rh/ai";
import type { EstadoVivo } from "@rh/core";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInterview } from "../lib/interviews";
import { createTickPersister, nextTickN, persistTick, readTicks } from "../lib/ticks";

const url = process.env.TEST_DATABASE_URL;
const AG = "a5000000-0000-4000-8000-000000000001";
const OTHER_AG = "a5000000-0000-4000-8000-0000000000ff";
const REC = "a5000000-0000-4000-8000-000000000091";

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

describe.skipIf(!url)("integração — ticks lib (escritor único + CAS)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa K2" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("persiste um tick e lê-o de volta (isolado por agency)", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    expect(await nextTickN(handle.db, interviewId)).toBe(0);
    const res = await persistTick(handle.db, AG, interviewId, 0, tick("início"));
    expect(res).toEqual({ persisted: true, tickN: 0 });
    const ticks = await readTicks(handle.db, AG, interviewId);
    expect(ticks).toHaveLength(1);
    expect((ticks[0]?.liveState as EstadoVivo).resumoCorrente).toBe("início");
    expect(await readTicks(handle.db, OTHER_AG, interviewId)).toHaveLength(0);
  });

  it("CAS: o mesmo tick_n não duplica (idempotente)", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    await persistTick(handle.db, AG, interviewId, 0, tick("a"));
    const again = await persistTick(handle.db, AG, interviewId, 0, tick("b"));
    expect(again.persisted).toBe(false);
    expect(await readTicks(handle.db, AG, interviewId)).toHaveLength(1);
  });

  it("createTickPersister escreve tick_n monótono (bridge do TickEngine)", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    const onTick = createTickPersister(handle.db, AG, interviewId);
    await onTick(tick("t0"));
    await onTick(tick("t1"));
    await onTick(tick("t2"));
    const ticks = await readTicks(handle.db, AG, interviewId);
    expect(ticks.map((t) => t.tickN)).toEqual([0, 1, 2]);
    expect(ticks.map((t) => (t.liveState as EstadoVivo).resumoCorrente)).toEqual([
      "t0",
      "t1",
      "t2",
    ]);
    expect(await nextTickN(handle.db, interviewId)).toBe(3);
  });
});
