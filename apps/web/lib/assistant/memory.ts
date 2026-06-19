import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";

type Db = DbHandle["db"];

export const MEMORY_FACT_KINDS = ["style", "preference", "pattern", "template"] as const;
export type MemoryFactKind = (typeof MEMORY_FACT_KINDS)[number];

/** Limite do texto de um facto (a coluna é `text` sem bound → guardamos na fronteira). */
export const MAX_FACT_TEXT = 2000;

export interface SaveMemoryFactInput {
  text: string;
  kind?: MemoryFactKind;
  sourceType?: "learned" | "explicit";
  sourceRef?: string;
}

export interface MemoryFact {
  id: string;
  kind: string;
  factText: string;
  sourceType: string;
  sourceRef: string | null;
}

const FACT_COLUMNS = {
  id: schema.recruiterMemoryFact.id,
  kind: schema.recruiterMemoryFact.kind,
  factText: schema.recruiterMemoryFact.factText,
  sourceType: schema.recruiterMemoryFact.sourceType,
  sourceRef: schema.recruiterMemoryFact.sourceRef,
};

/** Persiste um facto durável do recrutador (memória de longo prazo). Isolado por agency+recruiter. */
export async function saveMemoryFact(
  db: Db,
  agencyId: string,
  recruiterId: string,
  input: SaveMemoryFactInput,
): Promise<string> {
  const text = input.text.trim();
  if (text.length === 0 || text.length > MAX_FACT_TEXT) {
    throw new Error(`factText deve ter 1–${MAX_FACT_TEXT} caracteres`);
  }
  const kind = input.kind && MEMORY_FACT_KINDS.includes(input.kind) ? input.kind : "preference";
  const id = randomUUID();
  await db.insert(schema.recruiterMemoryFact).values({
    id,
    agencyId,
    recruiterId,
    kind,
    factText: text,
    sourceType: input.sourceType ?? "explicit",
    sourceRef: input.sourceRef ?? null,
  });
  return id;
}

/** Lista os factos do recrutador (mais recentes primeiro). */
export async function listMemoryFacts(
  db: Db,
  agencyId: string,
  recruiterId: string,
  opts: { limit?: number } = {},
): Promise<MemoryFact[]> {
  return db
    .select(FACT_COLUMNS)
    .from(schema.recruiterMemoryFact)
    .where(
      and(
        eq(schema.recruiterMemoryFact.agencyId, agencyId),
        eq(schema.recruiterMemoryFact.recruiterId, recruiterId),
        isNull(schema.recruiterMemoryFact.deletedAt),
      ),
    )
    .orderBy(desc(schema.recruiterMemoryFact.createdAt))
    .limit(opts.limit ?? 50);
}

/**
 * Recall simples por correspondência de texto (ILIKE). v1 SEM vetorial/RAG (isso é FASE Ω).
 * O `query` é parametrizado (drizzle bind) → sem injeção; os `%` são wildcards do LIKE.
 */
export async function searchMemoryFacts(
  db: Db,
  agencyId: string,
  recruiterId: string,
  query: string,
  opts: { limit?: number } = {},
): Promise<MemoryFact[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  return db
    .select(FACT_COLUMNS)
    .from(schema.recruiterMemoryFact)
    .where(
      and(
        eq(schema.recruiterMemoryFact.agencyId, agencyId),
        eq(schema.recruiterMemoryFact.recruiterId, recruiterId),
        isNull(schema.recruiterMemoryFact.deletedAt),
        ilike(schema.recruiterMemoryFact.factText, `%${q}%`),
      ),
    )
    .orderBy(desc(schema.recruiterMemoryFact.createdAt))
    .limit(opts.limit ?? 10);
}
