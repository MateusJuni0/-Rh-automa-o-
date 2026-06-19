import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { AGENCY_GUC, setAgencyIdSql, type TxExecutor, withAgencySession } from "../src/client";

const AGENCY = "11111111-1111-4111-8111-111111111111";
const dialect = new PgDialect();

describe("contrato GUC de tenant — setAgencyIdSql", () => {
  it("emite set_config parametrizado para app.agency_id (is_local=true)", () => {
    const q = dialect.sqlToQuery(setAgencyIdSql(AGENCY));
    expect(q.sql).toContain("set_config");
    expect(q.sql).toContain("true"); // is_local
    expect(q.params).toContain(AGENCY_GUC);
    expect(q.params).toContain(AGENCY);
    // o agency_id é parâmetro (não interpolado) → sem injeção
    expect(q.sql).not.toContain(AGENCY);
  });
});

describe("withAgencySession", () => {
  it("abre 1 transação e fixa o tenant ANTES de correr o fn", async () => {
    const order: string[] = [];
    let txExecuteCount = 0;
    let capturedAgency: unknown;

    const fakeTx: TxExecutor = {
      execute: async (query: SQL) => {
        txExecuteCount += 1;
        order.push("set_agency");
        capturedAgency = dialect.sqlToQuery(query).params.at(-1);
        return undefined;
      },
    };
    const fakeDb = {
      transaction: async <T>(fn: (tx: TxExecutor) => Promise<T>): Promise<T> => {
        order.push("tx_open");
        return fn(fakeTx);
      },
    };

    const result = await withAgencySession(fakeDb, AGENCY, async (tx) => {
      expect(tx).toBe(fakeTx);
      order.push("fn");
      return 42;
    });

    expect(result).toBe(42);
    expect(txExecuteCount).toBe(1);
    expect(capturedAgency).toBe(AGENCY);
    // ordem: abre tx → fixa tenant → corre fn
    expect(order).toEqual(["tx_open", "set_agency", "fn"]);
  });

  it("propaga o resultado de uma leitura simulada", async () => {
    const fakeDb = {
      transaction: async <T>(fn: (tx: TxExecutor) => Promise<T>): Promise<T> =>
        fn({ execute: async () => undefined }),
    };
    const rows = await withAgencySession(fakeDb, AGENCY, async () => [{ id: "x" }]);
    expect(rows).toEqual([{ id: "x" }]);
  });
});
