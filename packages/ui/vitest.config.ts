import { defineConfig } from "vitest/config";

export default defineConfig({
  // `renderToStaticMarkup` corre em node — sem jsdom; testes de render puros (SSR).
  // O transform oxc do Vitest 4 trata o JSX automaticamente.
  test: {
    include: ["test/**/*.test.tsx", "test/**/*.test.ts"],
    environment: "node",
  },
});
