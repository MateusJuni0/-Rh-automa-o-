import { createDb, type DbHandle } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCliente, listClientes } from "../lib/clientes";

// Gated: só com Postgres real (TEST_DATABASE_URL). client.agency_id não tem FK → não precisa de seed.
const url = process.env.TEST_DATABASE_URL;
const AG = "ae000000-0000-4000-8000-000000000001";

describe.skipIf(!url)("integração — clientes lib (apps/web)", () => {
  let handle: DbHandle;
  beforeAll(() => {
    handle = createDb(url as string);
  });
  afterAll(() => handle?.close());

  it("cria e lista clientes por agência", async () => {
    const { id } = await createCliente(handle.db, AG, { name: "Cliente Teste", notes: "demo" });
    const rows = await listClientes(handle.db, AG);
    expect(rows.some((r) => r.id === id && r.name === "Cliente Teste")).toBe(true);
  });

  it("isola por agência (outra agência não vê)", async () => {
    await createCliente(handle.db, AG, { name: "Só da AG" });
    const outras = await listClientes(handle.db, "af000000-0000-4000-8000-000000000099");
    expect(outras.every((r) => r.name !== "Só da AG")).toBe(true);
  });
});
