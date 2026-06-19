import { createDb } from "./client";
import { seed } from "./seed";

// CLI: `DATABASE_URL=... pnpm --filter @rh/db db:seed`. NUNCA hardcodar a connection string.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL em falta para o seed");
}

const handle = createDb(url);

async function main(): Promise<void> {
  try {
    const ids = await seed(handle.db);
    process.stdout.write(`seed ok: ${JSON.stringify(ids)}\n`);
  } finally {
    await handle.close();
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`seed falhou: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
