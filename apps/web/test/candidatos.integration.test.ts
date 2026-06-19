import { createDb, type DbHandle } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCandidato, listCandidatos } from "../lib/candidatos";

// Gated: Postgres real. candidate.agency_id não tem FK → sem setup. Sem chave → extração stub.
const url = process.env.TEST_DATABASE_URL;
const AG = "a2000000-0000-4000-8000-000000000001";

describe.skipIf(!url)("integração — candidatos lib (apps/web)", () => {
  let handle: DbHandle;
  beforeAll(() => {
    handle = createDb(url as string);
  });
  afterAll(() => handle?.close());

  it("cria candidato (perfil stub) e lista", async () => {
    const { id, profile } = await createCandidato(handle.db, AG, {
      name: "João Demo",
      cvText: "5 anos React, TypeScript, testes.",
    });
    expect(profile.resumo).toContain("React");
    const rows = await listCandidatos(handle.db, AG);
    expect(rows.some((r) => r.id === id && r.name === "João Demo")).toBe(true);
  });
});
