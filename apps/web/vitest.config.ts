import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Espelha o `paths` do tsconfig (`@/* → ./*`) para os testes de route/lib que usam o alias `@`.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Imports cold (@rh/db, @supabase/ssr) + integração DB são lentos no Windows → margem generosa.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
