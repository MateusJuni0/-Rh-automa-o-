export interface RetentionRow {
  label: string;
  valor: string;
}

/**
 * Defaults SUGERIDOS de retenção (LEGAL-E-RGPD §3). O produto só oferece as alavancas — a IRIS
 * ajusta os prazos. Mostrados como leitura no ecrã de Definições.
 */
export const RETENTION_DEFAULTS: ReadonlyArray<RetentionRow> = [
  { label: "Áudio / transcrição crua", valor: "30 dias" },
  { label: "Factos pessoais", valor: "90 dias" },
  { label: "Janela soft → hard delete (purga)", valor: "30 dias" },
];

/** Ambiente da app (secção "Sobre"). Determinístico a partir de `NODE_ENV`. */
export function appEnvironment(env: string | undefined): "produção" | "desenvolvimento" {
  return env === "production" ? "produção" : "desenvolvimento";
}
