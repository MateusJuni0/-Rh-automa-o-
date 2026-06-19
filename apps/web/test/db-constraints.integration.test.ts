import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema as s } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const AG = randomUUID();
const REC = randomUUID();

describe.skipIf(!url)("integração — constraints de integridade (endurecimento DB)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(s.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa DB" });
  });
  afterAll(() => handle?.close());

  it("UNIQUE(interview_id, tick_n): segundo tick com o mesmo n → erro", async () => {
    const ivId = randomUUID();
    await handle.db.insert(s.interview).values({ id: ivId, agencyId: AG, recruiterId: REC });
    await handle.db
      .insert(s.interviewTick)
      .values({ id: randomUUID(), agencyId: AG, interviewId: ivId, tickN: 1, liveState: {} });
    await expect(
      handle.db
        .insert(s.interviewTick)
        .values({ id: randomUUID(), agencyId: AG, interviewId: ivId, tickN: 1, liveState: {} }),
    ).rejects.toThrow();
  });

  it("CHECK interview.status: valor fora do conjunto → erro", async () => {
    await expect(
      handle.db
        .insert(s.interview)
        .values({ id: randomUUID(), agencyId: AG, recruiterId: REC, status: "bogus" }),
    ).rejects.toThrow();
  });

  it("CHECK interview.capture_type: valor fora do conjunto → erro; NULL ok", async () => {
    await expect(
      handle.db
        .insert(s.interview)
        .values({ id: randomUUID(), agencyId: AG, recruiterId: REC, captureType: "webcam_hd" }),
    ).rejects.toThrow();
    // NULL é permitido
    const ok = await handle.db
      .insert(s.interview)
      .values({ id: randomUUID(), agencyId: AG, recruiterId: REC })
      .returning({ id: s.interview.id });
    expect(ok).toHaveLength(1);
  });
});
