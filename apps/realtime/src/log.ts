/**
 * Log de falha de transporte (stderr) — fail-loud POR DEFEITO: um erro/close do WS ou uma
 * desconexão da sala NUNCA fica silencioso. A app/orquestrador pode passar o seu próprio `onError`
 * (ex.: cair para o mock feed) — isto é só o fallback quando ninguém o trata.
 */
export function logTransportError(scope: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[${scope}] falha de transporte: ${msg}\n`);
}
