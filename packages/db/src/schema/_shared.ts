import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Dimensão do embedding = a do EMBEDDER escolhido (default 1536 — MODELOS-E-API §3).
 * As 4 tabelas de embedding (candidate/transcript/source/recruiter) usam este valor.
 */
export const EMBEDDING_DIM = 1536;

/** PK UUID com gen_random_uuid(). */
export const pk = () => uuid("id").primaryKey().defaultRandom();

/**
 * agency_id denormalizado — predicado obrigatório nas queries desde a v1
 * (defesa-em-profundidade, MODELO §15.1). v1 é single-tenant: SEM RLS, mas o filtro
 * nunca se adia. Sem FK (costura desnormalizada para a v2 multi-agência).
 */
export const agencyId = () => uuid("agency_id").notNull();

export const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow();
export const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow();
export const deletedAt = () => timestamp("deleted_at", { withTimezone: true });
