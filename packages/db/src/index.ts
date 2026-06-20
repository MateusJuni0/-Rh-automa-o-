// Ponto de entrada do @rh/db. Fonte única do schema (MODELO-DADOS.md) + contrato de tenant (GUC).
import * as schema from "./schema";

export * from "./client";
export * from "./schema";
export { schema };
// `SEED_IDS`/`seed` na API pública → scripts (ex.: seed-supabase-auth) usam os MESMOS ids canónicos
// (evita recruiters duplicados na agência IRIS).
export { SEED_IDS, seed } from "./seed";
