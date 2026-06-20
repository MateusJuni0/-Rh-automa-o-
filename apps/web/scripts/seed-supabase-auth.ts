/**
 * Seed IDEMPOTENTE dos utilizadores IRIS (Filipa + Inês) no Supabase Auth (GoTrue) e ligação ao
 * recruiter na DB (`recruiter.userId = auth user id`). Corre-se UMA vez ao subir o profile supabase:
 *
 *   SUPABASE_URL=http://localhost:8000 SUPABASE_SERVICE_ROLE_KEY=... \
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev \
 *     pnpm --filter web exec tsx scripts/seed-supabase-auth.ts
 *
 * Idempotente: se o user já existe, reaproveita-o; nunca duplica. Password de dev via env
 * (`SEED_PASSWORD`, default `vera-dev-2026`). NUNCA correr contra produção.
 */
import { createDb, schema } from "@rh/db";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

const DEV_AGENCY_ID = "11111111-0000-4000-8000-000000000001";
const DEV_RECRUITER_ID = "11111111-0000-4000-8000-000000000002";
const INES_RECRUITER_ID = "22222222-0000-4000-8000-000000000002";

const SEED = [
  { email: "filipa@iris.tech", name: "Filipa", recruiterId: DEV_RECRUITER_ID },
  { email: "ines@iris.tech", name: "Inês", recruiterId: INES_RECRUITER_ID },
];

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!url || !serviceKey || !databaseUrl) {
    throw new Error("faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL");
  }
  const password = process.env.SEED_PASSWORD || "vera-dev-2026";
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { db, close } = createDb(databaseUrl);

  try {
    for (const u of SEED) {
      // 1) procura o user existente (idempotência) — a admin API lista por página.
      const { data: list, error: listErr } = await admin.auth.admin.listUsers();
      if (listErr) {
        throw new Error(`listUsers falhou: ${listErr.message}`);
      }
      let userId = list.users.find((x) => x.email === u.email)?.id;

      // 2) cria se não existir (email já confirmado — dev).
      if (!userId) {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) {
          throw new Error(`createUser(${u.email}) falhou: ${error?.message ?? "sem user"}`);
        }
        userId = data.user.id;
        process.stdout.write(`[seed-auth] criado ${u.email} (${userId})\n`);
      } else {
        process.stdout.write(`[seed-auth] já existe ${u.email} (${userId})\n`);
      }

      // 3) liga o user ao recruiter (upsert idempotente; agência IRIS).
      await db
        .insert(schema.recruiter)
        .values({ id: u.recruiterId, agencyId: DEV_AGENCY_ID, userId, name: u.name })
        .onConflictDoUpdate({ target: schema.recruiter.id, set: { userId } });
      // garante também o vínculo se o recruiter já existia com outro userId
      await db
        .update(schema.recruiter)
        .set({ userId })
        .where(eq(schema.recruiter.id, u.recruiterId));
    }
    process.stdout.write("[seed-auth] concluído.\n");
  } finally {
    await close();
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`[seed-auth] ERRO: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
