import { pathToFileURL } from "node:url";
import { createWsAuthenticate } from "./auth";
import { WsServer } from "./server";

export interface WsConfig {
  port: number;
  secret: string;
}

/** Config do servidor WS a partir do ambiente. SEM segredo hardcoded — `WS_JWT_SECRET` é obrigatório. */
export function resolveConfig(env: NodeJS.ProcessEnv): WsConfig {
  const parsed = Number.parseInt(env.WS_PORT ?? "", 10);
  return {
    port: Number.isInteger(parsed) && parsed >= 0 ? parsed : 18792,
    secret: env.WS_JWT_SECRET ?? "",
  };
}

/**
 * Posse MOCK da entrevista (v1): aceita qualquer par não-vazio. O real é injetado pela app
 * (`SELECT 1 FROM interview WHERE id=$1 AND recruiter_id=$2`) — o @rh/ws fica SEM @rh/db.
 */
export function mockVerifyOwnership(interviewId: string, recruiterId: string): boolean {
  return interviewId.length > 0 && recruiterId.length > 0;
}

/** Arranca o servidor WS com a config + verificação de posse. Testável (sem process.exit/sinais). */
export async function startFromConfig(
  cfg: WsConfig,
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
  const server = await startFromConfig(cfg, mockVerifyOwnership);
  process.stdout.write(`[ws] a ouvir em ws://127.0.0.1:${server.port}\n`);
  const shutdown = (): void => {
    process.stdout.write("[ws] a encerrar…\n");
    void server.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Corre SÓ quando executado diretamente (não quando importado pelos testes).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
