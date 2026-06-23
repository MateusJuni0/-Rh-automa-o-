import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCandidato, getCandidato, listCandidatos } from "../lib/candidatos";

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

  it("getCandidato devolve o detalhe (perfil validado); null fora da agência", async () => {
    const id = randomUUID();
    await handle.db.insert(schema.candidate).values({
      id,
      agencyId: AG,
      name: "Maria Detalhe",
      nameNormalized: `maria-${id}`,
      profile: {
        skillsDeclaradas: ["React", "SQL"],
        experienciaAnos: 7,
        gapsCv: ["sem liderança"],
        resumo: "Senior frontend",
      },
    });
    const c = await getCandidato(handle.db, AG, id);
    expect(c?.name).toBe("Maria Detalhe");
    expect(c?.profile.skillsDeclaradas).toEqual(["React", "SQL"]);
    expect(c?.profile.experienciaAnos).toBe(7);
    expect(c?.profile.gapsCv).toEqual(["sem liderança"]);
    expect(await getCandidato(handle.db, randomUUID(), id)).toBeNull();
  });
});
