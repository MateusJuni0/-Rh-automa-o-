import { pathToFileURL } from "node:url";
import { createDb } from "@rh/db";
import { createWsAuthenticate } from "./auth";
import { dbVerifyOwnership } from "./ownership";
import { WsServer } from "./server";

export interface WsConfig {
  port: number;
  secret: string;
  /** `DATABASE_URL` (opcional). Presente → posse REAL via @rh/db; ausente → mock (dev/testes). */
  databaseUrl: string | undefined;
}

/** Config do servidor WS a partir do ambiente. SEM segredo hardcoded — `WS_JWT_SECRET` é obrigatório. */
export function resolveConfig(env: NodeJS.ProcessEnv): WsConfig {
  const parsed = Number.parseInt(env.WS_PORT ?? "", 10);
  const databaseUrl = env.DATABASE_URL?.trim();
  return {
    port: Number.isInteger(parsed) && parsed >= 0 ? parsed : 18792,
    secret: env.WS_JWT_SECRET ?? "",
    databaseUrl: databaseUrl ? databaseUrl : undefined,
  };
}

/**
 * Posse MOCK da entrevista (v1): aceita qualquer par não-vazio. O real é injetado pela app
 * (`SELECT 1 FROM interview WHERE id=$1 AND recruiter_id=$2`) — o @rh/ws fica SEM @rh/db.
 */
export function mockVerifyOwnership(interviewId: string, recruiterId: string): boolean {
  return interviewId.length > 0 && recruiterId.length > 0;
}

/**
 * Arranca o servidor WS com a config + verificação de posse. Testável (sem process.exit/sinais).
 * Só precisa de `port`+`secret` — a posse (mock OU @rh/db) é injetada por quem chama (config-not-code).
 */
export async function startFromConfig(
  cfg: Pick<WsConfig, "port" | "secret">,
  verifyOwnership: (interviewId: string, recruiterId: string) => Promise<boolean> | boolean,
): Promise<WsServer> {
  const authenticate = createWsAuthenticate({ secret: cfg.secret, verifyOwnership });
  return WsServer.start({ port: cfg.port, hooks: { authenticate } });
}

async function main(): Promise<void> {
  const cfg = resolveConfig(process.env);
  if (!cfg.secret) {
    process.stderr.write(
      "[ws] WS_JWT_SECRET em falta — aborta (ligações seriam todas recusadas).\n",
    );
    process.exitCode = 1;
    return;
  }
  // config-not-code: com DATABASE_URL → posse REAL (@rh/db); sem URL → mock (dev/testes a €0).
  const handle = cfg.databaseUrl ? createDb(cfg.databaseUrl) : undefined;
  const verifyOwnership = handle ? dbVerifyOwnership(handle.db) : mockVerifyOwnership;
  process.stdout.write(`[ws] posse: ${handle ? "REAL (@rh/db)" : "MOCK (sem DATABASE_URL)"}\n`);
  const server = await startFromConfig(cfg, verifyOwnership);
  process.stdout.write(`[ws] a ouvir em ws://127.0.0.1:${server.port}\n`);
  let closing = false;
  const shutdown = (): void => {
    if (closing) {
      return;
    }
    closing = true;
    process.stdout.write("[ws] a encerrar…\n");
    void server
      .close()
      .then(() => handle?.close())
      .then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Corre SÓ quando executado diretamente (não quando importado pelos testes).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
