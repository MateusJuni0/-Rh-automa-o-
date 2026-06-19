import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deploy = container na VPS (playbook Vercel->VPS): standalone + tracing à raiz do monorepo.
  // Gated por env: o `standalone` cria symlinks que o Windows-dev não permite (EPERM); ativa-se
  // só no build Linux/CI (NEXT_OUTPUT=standalone). Em dev local fica desligado → build verde.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(dirname, "../../"),
  // @rh/core é TS-source (sem build) → Next transpila.
  transpilePackages: ["@rh/core"],
};

export default nextConfig;
