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
    expect(matrix.available).toHaveLength(0);
  });

  it("`available` expõe TODOS os triados mesmo com seleção parcial (alimenta o selector)", async () => {
    const matrix = await buildComparisonMatrix(handle.db, AG, JOB, [CAND1]);
    // só 1 coluna mostrada…
    expect(matrix.columns).toHaveLength(1);
    expect(matrix.columns[0]?.candidateId).toBe(CAND1);
    // …mas o universo escolhível tem os dois candidatos
    const ids = matrix.available.map((a) => a.candidateId).sort();
    expect(ids).toEqual([CAND1, CAND2].sort());
    const ana = matrix.available.find((a) => a.candidateId === CAND1);
    expect(ana?.name).toBe("Ana React");
    expect(typeof ana?.matchScore).toBe("number");
  });

  it("isolamento: id de candidato de OUTRA agência no `c` → ignorado (0 colunas, available intacto)", async () => {
    // candidato real, mas noutra agência → nunca entra na triagem desta agência
    const OTHER_AG = randomUUID();
    const OTHER_CAND = randomUUID();
    await handle.db.insert(schema.candidate).values({
      id: OTHER_CAND,
      agencyId: OTHER_AG,
      name: "Intruso Outra Agência",
      nameNormalized: `intruso-${OTHER_CAND}`,
      profile: { skillsDeclaradas: ["React"], experienciaAnos: 9, gapsCv: [], resumo: "" },
    });
    const matrix = await buildComparisonMatrix(handle.db, AG, JOB, [OTHER_CAND]);
    expect(matrix.columns).toHaveLength(0); // o intruso não vira coluna
    // available continua a ser só os triados desta agência (sem o intruso)
    const ids = matrix.available.map((a) => a.candidateId);
    expect(ids).not.toContain(OTHER_CAND);
    expect(ids.sort()).toEqual([CAND1, CAND2].sort());
  });
});
