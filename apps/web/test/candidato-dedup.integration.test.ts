import { randomUUID } from "node:crypto";
import { createDb, type DbHandle, schema as s } from "@rh/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCandidato } from "../lib/candidatos";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("integração — dedup de candidatos (§12 resolução de entidade)", () => {
  let handle: DbHandle;
  const AG = randomUUID();
  const AG2 = randomUUID();
  beforeAll(() => {
    handle = createDb(url as string);
  });
  afterAll(() => handle?.close());

  it("dedup por EMAIL: dois CVs com o mesmo email → um único candidato", async () => {
    const email = `dedup-${randomUUID()}@exemplo.pt`;
    const a = await createCandidato(handle.db, AG, {
      name: "Ana Original",
      cvText: `Dev React. Contacto: ${email}`,
    });
    expect(a.deduped).toBe(false);

    const b = await createCandidato(handle.db, AG, {
      name: "Ana Reenviada",
      cvText: `Outro CV, mesma pessoa. ${email}`,
    });
    expect(b.deduped).toBe(true);
    expect(b.id).toBe(a.id); // resolveu para o existente, não criou um 2º
  });

  it("dedup por LINKEDIN: mesmo linkedinUrl → um único candidato", async () => {
    const linkedinUrl = `https://linkedin.com/in/dedup-${randomUUID()}`;
    const a = await createCandidato(handle.db, AG, {
      name: "Bruno",
      linkedinUrl,
      cvText: "Dev backend.",
    });
    expect(a.deduped).toBe(false);

    const b = await createCandidato(handle.db, AG, {
      name: "Bruno (outra fonte)",
      linkedinUrl,
      cvText: "Perfil sourced.",
    });
    expect(b.deduped).toBe(true);
    expect(b.id).toBe(a.id);
  });

  it("NÃO dedupa quando as chaves fortes diferem (nomes iguais não fundem)", async () => {
    const a = await createCandidato(handle.db, AG, {
      name: "João Silva",
      cvText: `Dev. joao-${randomUUID()}@exemplo.pt`,
    });
    const b = await createCandidato(handle.db, AG, {
      name: "João Silva", // homónimo — NÃO deve fundir
      cvText: `Dev. outro-${randomUUID()}@exemplo.pt`,
    });
    expect(b.deduped).toBe(false);
    expect(b.id).not.toBe(a.id);
  });

  it("persiste email/phone extraídos do CV nas colunas (chaves de dedup)", async () => {
    const email = `persist-${randomUUID()}@exemplo.pt`;
    const { id } = await createCandidato(handle.db, AG, {
      name: "Eva",
      cvText: `Dev. ${email} tel +351912345678`,
    });
    const [row] = await handle.db
      .select({ email: s.candidate.email, phone: s.candidate.phone })
      .from(s.candidate)
      .where(eq(s.candidate.id, id));
    expect(row?.email).toBe(email);
    expect(row?.phone).toBeTruthy();
  });

  it("o dedup é POR AGÊNCIA (mesmo email noutra agência = candidato distinto)", async () => {
    const email = `cross-${randomUUID()}@exemplo.pt`;
    const a = await createCandidato(handle.db, AG, { name: "Filipa", cvText: `Dev. ${email}` });
    const b = await createCandidato(handle.db, AG2, { name: "Filipa", cvText: `Dev. ${email}` });
    expect(b.deduped).toBe(false);
    expect(b.id).not.toBe(a.id);
  });
});
