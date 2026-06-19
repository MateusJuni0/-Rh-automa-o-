// Ponto de entrada do @rh/db. Fonte única do schema (MODELO-DADOS.md).
// O cliente Drizzle + o wrapper agent_db_session(GUC) entram numa fatia seguinte (P0.1 contratos).
import * as schema from "./schema";

export * from "./schema";
export { schema };
