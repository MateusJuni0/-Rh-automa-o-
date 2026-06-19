import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema } from "@rh/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createVaga, DEV_RECRUITER_ID, getVaga, listVagas } from "../lib/vagas";

// Gated: Postgres real. Sem OPENROUTER_API_KEY → createVaga usa o stub de requisitos (demo).
const url = process.env.TEST_DATABASE_URL;
const AG = "a1000000-0000-4000-8000-000000000001";
const CLIENT = "a1000000-0000-4000-8000-0000000000c1";

describe.skipIf(!url)("integração — vagas lib (apps/web)", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb(url as string);
    // FKs: job.client_id → client, job.recruiter_id → recruiter.
    await handle.db
      .insert(schema.client)
      .values({ id: CLIENT, agencyId: AG, name: "Cliente Vagas" })
      .onConflictDoNothing();
    await handle.db
      .insert(schema.recruiter)
      .values({ id: DEV_RECRUITER_ID, agencyId: AG, userId: randomUUID(), name: "Filipa" })
      .onConflictDoNothing();
  });
  afterAll(() => handle?.close());

  it("cria vaga (extração stub) e lista", async () => {
    const { id, requirements } = await createVaga(handle.db, AG, {
      clientId: CLIENT,
      title: "Dev Frontend",
      roleTypeSlug: "dev_frontend_react_pleno",
      requirementsText: "Precisamos de um dev React pleno, 3 anos, com TypeScript.",
    });
    expect(requirements.roleType).toBe("dev_frontend_react_pleno");
    const rows = await listVagas(handle.db, AG);
    expect(rows.some((r) => r.id === id && r.title === "Dev Frontend")).toBe(true);
  });

  it("getVaga devolve detalhe (requisitos validados + cliente); null fora da agência", async () => {
    const { id } = await createVaga(handle.db, AG, {
      clientId: CLIENT,
      title: "Dev Detalhe",
      roleTypeSlug: "dev_x",
      requirementsText: "React, TypeScript.",
    });
    const v = await getVaga(handle.db, AG, id);
    expect(v?.title).toBe("Dev Detalhe");
    expect(v?.clientName).toBe("Cliente Vagas");
    expect(Array.isArray(v?.requirements.skills.must)).toBe(true);
    expect(await getVaga(handle.db, "a1000000-0000-4000-8000-0000000000ff", id)).toBeNull();
  });
});
