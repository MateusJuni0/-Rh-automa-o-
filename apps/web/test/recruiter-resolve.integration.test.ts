import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveSessionByUserId } from "../lib/recruiter-resolve";

/** Integração Ω-3c — mapeia o user.id do Supabase Auth → recruiter+agência. DB local; sem URL → SKIP. */
const url = process.env.TEST_DATABASE_URL;
const AG = "a3c00000-0000-4000-8000-000000000001";

describe.skipIf(!url)("integração — resolveSessionByUserId (apps/web)", () => {
  let handle: DbHandle;
  const userId = randomUUID();
  const recruiterId = randomUUID();

  beforeAll(async () => {
    handle = createDb(url as string);
    await handle.db
      .insert(schema.recruiter)
      .values({ id: recruiterId, agencyId: AG, userId, name: "Filipa" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("user ligado → devolve {agencyId, recruiterId}", async () => {
    const s = await resolveSessionByUserId(handle.db, userId);
    expect(s).toEqual({ agencyId: AG, recruiterId });
  });

  it("user sem recruiter ligado → null (fail-closed)", async () => {
    const s = await resolveSessionByUserId(handle.db, randomUUID());
    expect(s).toBeNull();
  });
});
