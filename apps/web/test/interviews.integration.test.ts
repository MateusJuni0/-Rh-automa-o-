import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createInterview,
  getInterview,
  InterviewNotFoundError,
  InvalidTransitionError,
  joinInterview,
  reportInterview,
  transitionInterview,
} from "../lib/interviews";

const url = process.env.TEST_DATABASE_URL;
const AG = "a4000000-0000-4000-8000-000000000001";
const OTHER_AG = "a4000000-0000-4000-8000-0000000000ff";
const REC = "a4000000-0000-4000-8000-000000000091";

describe.skipIf(!url)("integração — interviews lib (apps/web)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa K" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("cria entrevista órfã (unstructured) com sala/token mock", async () => {
    const res = await createInterview(handle.db, AG, { recruiterId: REC });
    expect(res.interviewId).toMatch(/[0-9a-f-]{36}/);
    expect(res.room).toContain("mock-room-");
    expect(res.token).toContain("mock-token-");
    const row = await getInterview(handle.db, AG, res.interviewId);
    expect(row?.status).toBe("unstructured");
    expect(row?.recruiterId).toBe(REC);
  });

  it("isola por agency (outra agência não vê)", async () => {
    const res = await createInterview(handle.db, AG, { recruiterId: REC });
    expect(await getInterview(handle.db, OTHER_AG, res.interviewId)).toBeNull();
  });

  it("transita unstructured→live→done com guarda; idempotente", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    expect(await transitionInterview(handle.db, AG, interviewId, "live")).toBe("live");
    expect(await transitionInterview(handle.db, AG, interviewId, "live")).toBe("live"); // idempotente
    expect(await transitionInterview(handle.db, AG, interviewId, "done")).toBe("done");
    const row = await getInterview(handle.db, AG, interviewId);
    expect(row?.status).toBe("done");
  });

  it("rejeita transição inválida (done→live)", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    await transitionInterview(handle.db, AG, interviewId, "live");
    await transitionInterview(handle.db, AG, interviewId, "done");
    await expect(transitionInterview(handle.db, AG, interviewId, "live")).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
  });

  it("joinInterview transita p/ live e devolve sala/token", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    const res = await joinInterview(handle.db, AG, interviewId);
    expect(res.room).toContain("mock-room-");
    expect((await getInterview(handle.db, AG, interviewId))?.status).toBe("live");
  });

  it("joinInterview falha em entrevista inexistente", async () => {
    await expect(
      joinInterview(handle.db, AG, "a4000000-0000-4000-8000-0000000000ee"),
    ).rejects.toBeInstanceOf(InterviewNotFoundError);
  });

  it("reportInterview transita p/ done e gera parecer (mesmo órfã)", async () => {
    const { interviewId } = await createInterview(handle.db, AG, { recruiterId: REC });
    const res = await reportInterview(handle.db, AG, interviewId);
    expect(res.reportId).not.toBe("");
    expect(res.contentMd.length).toBeGreaterThan(0);
    expect((await getInterview(handle.db, AG, interviewId))?.status).toBe("done");
    // idempotente: re-gerar não rebenta
    const again = await reportInterview(handle.db, AG, interviewId);
    expect(again.reportId).toBe(res.reportId);
  });
});
