// Ponto de entrada do @rh/db. Fonte única do schema (MODELO-DADOS.md) + contrato de tenant (GUC).
import * as schema from "./schema";

export * from "./client";
export * from "./schema";
export { schema };
