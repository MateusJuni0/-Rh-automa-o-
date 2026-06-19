import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle, withAgencySession } from "../src/index";

// Teste de integração — só corre quando há um Postgres real (TEST_DATABASE_URL).
// Sem DB salta (CI sem Docker continua verde). Com DB prova o contrato GUC end-to-end.
const url = process.env.TEST_DATABASE_URL;

type GucRow = { rows: Array<{ v: string | null }> };

describe.skipIf(!url)("integração — createDb + withAgencySession (Postgres real)", () => {
  let handle: DbHandle;
  beforeAll(() => {
    handle = createDb(url as string);
  });
  afterAll(() => handle?.close());

  it("withAgencySession fixa app.agency_id na transação", async () => {
    const agencyId = "11111111-1111-4111-8111-111111111111";
    const got = await withAgencySession(handle.db, agencyId, async (tx) => {
      const res = (await tx.execute(
        sql`select current_setting('app.agency_id', true) as v`,
      )) as GucRow;
      return res.rows[0]?.v ?? null;
    });
    expect(got).toBe(agencyId);
  });

  it("o GUC é LOCAL à transação (fora dela não está fixado)", async () => {
    const res = (await handle.db.execute(
      sql`select current_setting('app.agency_id', true) as v`,
    )) as GucRow;
    expect(res.rows[0]?.v ?? "").toBe("");
  });
});
