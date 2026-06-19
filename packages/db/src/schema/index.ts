// Barrel do schema canónico (MODELO-DADOS forma FINAL — 35 tabelas).
// Ordem de export irrelevante para o Drizzle (FKs são thunks); agrupado por domínio.

export { EMBEDDING_DIM } from "./_shared";
export * from "./agency";
export * from "./assistant";
export * from "./candidate";
export * from "./client";
export * from "./intake";
export * from "./interview";
export * from "./job";
export * from "./knowledge";
export * from "./proactive";
export * from "./process";
export * from "./report";
export * from "./transcript";
