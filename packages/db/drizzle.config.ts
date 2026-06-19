import { defineConfig } from "drizzle-kit";

// Fonte única do schema = src/schema. drizzle-kit `generate` lê o schema TS e
// emite SQL em ./migrations (não precisa de DB). `migrate` usa o DATABASE_URL.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54322/postgres",
  },
  verbose: true,
  strict: true,
});
