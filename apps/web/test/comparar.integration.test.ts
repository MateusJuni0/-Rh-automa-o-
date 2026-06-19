import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildComparisonMatrix } from "../lib/comparar";

const url = process.env.TEST_DATABASE_URL;
const AG = randomUUID();
const CLIENT = randomUUID();
const REC = randomUUID();
const JOB = randomUUID();
const CAND1 = randomUUID();
const CAND2 = randomUUID();

describe.skipIf(!url)("integração — comparar (Tela 10)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    const db = handle.db;
    await db.insert(schema.client).values({ id: CLIENT, agencyId: AG, name: "C" });
    await db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa Cmp" });
    await db.insert(schema.job).values({
      id: JOB,
      agencyId: AG,
      clientId: CLIENT,
      recruiterId: REC,
      title: "Dev",
      roleTypeSlug: "dev_react",
      requirements: {
        roleType: "dev_react",
        nivel: "pleno",
        skills: { must: ["React", "SQL"], nice: [] },
        contexto: "",
      },
    });
    await db.insert(schema.candidate).values([
      {
        id: CAND1,
        agencyId: AG,
        name: "Ana React",
        nameNormalized: `ana-${CAND1}`,
        profile: { skillsDeclaradas: ["React"], experienciaAnos: 5, gapsCv: [], resumo: "" },
      },
      {
        id: CAND2,
        agencyId: AG,
        name: "Bruno Sem",
        nameNormalized: `bruno-${CAND2}`,
        profile: { skillsDeclaradas: [], experienciaAnos: null, gapsCv: [], resumo: "" },
      },
    ]);
  });
  afterAll(() => handle?.close());

  it("matriz requisitos×candidatos com status por célula", async () => {
    const matrix = await buildComparisonMatrix(handle.db, AG, JOB, [CAND1, CAND2]);
    expect(matrix.requisitos).toEqual(["React", "SQL"]);
    expect(matrix.columns).toHaveLength(2);

    const ana = matrix.columns.find((c) => c.candidateId === CAND1);
    const cellReact = ana?.cells.find((c) => c.requisito === "React");
    const cellSql = ana?.cells.find((c) => c.requisito === "SQL");
    expect(cellReact?.status).toBe("coberto-com-prova");
    expect(cellSql?.status).toBe("não-tocado");

    const bruno = matrix.columns.find((c) => c.candidateId === CAND2);
    expect(bruno?.cells.every((c) => c.status === "não-tocado")).toBe(true);
  });

  it("vaga inexistente → matriz vazia", async () => {
    const matrix = await buildComparisonMatrix(handle.db, AG, randomUUID());
    expect(matrix.requisitos).toHaveLength(0);
    expect(matrix.columns).toHaveLength(0);
  });
});
