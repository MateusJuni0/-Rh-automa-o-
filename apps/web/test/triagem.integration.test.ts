import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { triageVaga } from "../lib/triagem";

const url = process.env.TEST_DATABASE_URL;
// IDs aleatórios por execução → zero colisão com dados de outros testes/seed.
const AG = randomUUID();
const CLIENT = randomUUID();
const REC = randomUUID();
const JOB = randomUUID();
const CAND1 = randomUUID();
const CAND2 = randomUUID();

describe.skipIf(!url)("integração — triagem (Tela 3)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    const db = handle.db;
    await db.insert(schema.client).values({ id: CLIENT, agencyId: AG, name: "C" });
    await db
      .insert(schema.recruiter)
      .values({ id: REC, agencyId: AG, userId: randomUUID(), name: "Filipa T" });
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
    await db.insert(schema.candidate).values({
      id: CAND1,
      agencyId: AG,
      name: "Ana React",
      nameNormalized: `ana-${CAND1}`,
      profile: {
        skillsDeclaradas: ["React"],
        experienciaAnos: 5,
        gapsCv: [],
        resumo: "5 anos React",
      },
    });
    await db.insert(schema.candidate).values({
      id: CAND2,
      agencyId: AG,
      name: "Bruno Sem",
      nameNormalized: `bruno-${CAND2}`,
      profile: { skillsDeclaradas: [], experienciaAnos: null, gapsCv: [], resumo: "" },
    });
  });
  afterAll(() => handle?.close());

  it("ranqueia os candidatos com cobertura dos must declarados", async () => {
    const rows = await triageVaga(handle.db, AG, JOB);
    expect(rows).toHaveLength(2);
    const [first, second] = rows;
    expect((first?.matchScore ?? 0) >= (second?.matchScore ?? 0)).toBe(true);
    for (const r of rows) {
      expect(r.matchScore).toBeGreaterThanOrEqual(40);
      expect(r.matchScore).toBeLessThanOrEqual(95);
    }
    const ana = rows.find((r) => r.candidateId === CAND1);
    const bruno = rows.find((r) => r.candidateId === CAND2);
    expect(ana?.cobertos).toEqual(["React"]);
    expect(ana?.faltantes).toEqual(["SQL"]);
    expect(bruno?.cobertos).toEqual([]);
    expect(bruno?.faltantes).toEqual(["React", "SQL"]);
  });

  it("vaga inexistente → lista vazia", async () => {
    expect(await triageVaga(handle.db, AG, randomUUID())).toEqual([]);
  });
});
