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
import { createDb, SEED_IDS, schema } from "@rh/db";
import { createClient } from "@supabase/supabase-js";

// Usa os MESMOS ids canónicos do seed do @rh/db (`SEED_IDS`) — senão criava recruiters Filipa/Inês
// DUPLICADOS na agência IRIS (o seed canónico usa 2222…001/002).
const DEV_AGENCY_ID = SEED_IDS.agency;

const SEED = [
  { email: "filipa@iris.tech", name: "Filipa", recruiterId: SEED_IDS.recruiterFilipa },
  { email: "ines@iris.tech", name: "Inês", recruiterId: SEED_IDS.recruiterInes },
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

      // 3) liga o user ao recruiter (upsert idempotente; agência IRIS). O `onConflictDoUpdate` no
      // `recruiter.id` cobre ambos os casos: novo recruiter OU recruiter já existente com outro
      // userId (o `set:{userId}` re-liga). Sem UPDATE extra (seria escrita redundante na mesma linha).
      await db
        .insert(schema.recruiter)
        .values({ id: u.recruiterId, agencyId: DEV_AGENCY_ID, userId, name: u.name })
        .onConflictDoUpdate({ target: schema.recruiter.id, set: { userId } });
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
