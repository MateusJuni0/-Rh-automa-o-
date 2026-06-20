import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbVerifyOwnership } from "../src/ownership";

/**
 * Integração 1b — posse REAL do WS contra a DB local.
 * Corre só com TEST_DATABASE_URL; sem URL → SKIP (não falha), como o resto da suite.
 */
const url = process.env.TEST_DATABASE_URL;
const AG = "a9000000-0000-4000-8000-000000000001";

describe.skipIf(!url)("integração — dbVerifyOwnership (apps/ws)", () => {
  let handle: DbHandle;
  const recruiterId = randomUUID();
  const otherRecruiterId = randomUUID();
  const interviewId = randomUUID();

  beforeAll(async () => {
    handle = createDb(url as string);
    const db = handle.db;
    await db
      .insert(schema.recruiter)
      .values({ id: recruiterId, agencyId: AG, userId: randomUUID(), name: "Filipa" })
      .onConflictDoNothing();
    await db
      .insert(schema.recruiter)
      .values({ id: otherRecruiterId, agencyId: AG, userId: randomUUID(), name: "Inês" })
      .onConflictDoNothing();
    await db
      .insert(schema.interview)
      .values({ id: interviewId, agencyId: AG, recruiterId, status: "scheduled" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("recruiter dono da entrevista → true", async () => {
    const verify = dbVerifyOwnership(handle.db);
    await expect(verify(interviewId, recruiterId)).resolves.toBe(true);
  });

  it("recruiter diferente → false (sem posse)", async () => {
    const verify = dbVerifyOwnership(handle.db);
    await expect(verify(interviewId, otherRecruiterId)).resolves.toBe(false);
  });

  it("entrevista inexistente → false", async () => {
    const verify = dbVerifyOwnership(handle.db);
    await expect(verify(randomUUID(), recruiterId)).resolves.toBe(false);
  });

  it("recruiterId não-UUID (sub do JWT inválido) → false (não rebenta)", async () => {
    const verify = dbVerifyOwnership(handle.db);
    await expect(verify(interviewId, "filipa")).resolves.toBe(false);
  });
});
