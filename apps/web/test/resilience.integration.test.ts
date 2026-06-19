import { randomUUID } from "node:crypto";
import type { TickOutput } from "@rh/ai";
import type { EstadoVivo } from "@rh/core";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInterview } from "../lib/interviews";
import {
  closeGap,
  costCapTier,
  openGap,
  readGaps,
  runWithTimeout,
  sumTickCostUsd,
} from "../lib/resilience";
import { persistTick } from "../lib/ticks";

const url = process.env.TEST_DATABASE_URL;
const AG = "a6000000-0000-4000-8000-000000000001";
const REC = "a6000000-0000-4000-8000-000000000091";

function tick(): TickOutput {
  const estado: EstadoVivo = {
    requisitos: [],
    interessesCliente: [],
    afirmacoesCandidato: [],
    perguntasFeitas: [],
    redFlags: [],
    resumoCorrente: "",
  };
  return { estado, suggestion: null };
}

describe("resiliência — puro (sem DB)", () => {
  it("costCapTier: ok/alert/soft/hard nos limiares 70/90/100%", () => {
    expect(costCapTier(0, 10)).toBe("ok");
    expect(costCapTier(6.9, 10)).toBe("ok");
    expect(costCapTier(7, 10)).toBe("alert");
    expect(costCapTier(9, 10)).toBe("soft");
    expect(costCapTier(10, 10)).toBe("hard");
    expect(costCapTier(99, 10)).toBe("hard");
    expect(costCapTier(5, 0)).toBe("ok"); // sem teto
  });

  it("runWithTimeout: rápido devolve valor; lento degrada (timedOut)", async () => {
    expect(await runWithTimeout(() => Promise.resolve(42), 1000)).toEqual({
      value: 42,
      timedOut: false,
    });
    const slow = await runWithTimeout(
      () => new Promise<number>((r) => setTimeout(() => r(1), 50)),
      5,
    );
    expect(slow).toEqual({ value: null, timedOut: true });
  });
});

describe.skipIf(!url)("resiliência — gaps + custo (com DB)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa R" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("openGap/closeGap com CAS idempotente; readGaps", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    const gapId = await openGap(handle.db, AG, interviewId, {
      startMs: 1000,
      cause: "stt_reconnect",
    });
    let gaps = await readGaps(handle.db, AG, interviewId);
    expect(gaps).toEqual([{ startMs: 1000, endMs: null, cause: "stt_reconnect" }]);
    expect(await closeGap(handle.db, AG, gapId, { endMs: 4000 })).toBe(true);
    gaps = await readGaps(handle.db, AG, interviewId);
    expect(gaps[0]?.endMs).toBe(4000);
    // já fechado → CAS devolve false (idempotente)
    expect(await closeGap(handle.db, AG, gapId, { endMs: 9999 })).toBe(false);
  });

  it("sumTickCostUsd soma o custo dos ticks", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    expect(await sumTickCostUsd(handle.db, AG, interviewId)).toBe(0);
    await persistTick(handle.db, AG, interviewId, 0, tick(), { costUsd: 0.01 });
    await persistTick(handle.db, AG, interviewId, 1, tick(), { costUsd: 0.02 });
    expect(await sumTickCostUsd(handle.db, AG, interviewId)).toBeCloseTo(0.03, 5);
  });
});
