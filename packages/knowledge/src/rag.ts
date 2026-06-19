import { candidateMemoryEmbedding, type schema } from "@rh/db";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Embedder } from "./embedder";

type Db = NodePgDatabase<typeof schema>;

/** Formata um vetor para literal pgvector ('[a,b,...]'). */
function toVectorLiteral(vec: readonly number[]): string {
  return `[${vec.join(",")}]`;
}

export interface IndexFactParams {
  factId: string;
  agencyId: string;
  text: string;
}

/** Indexa um facto do candidato (RAG): embed do texto + insert em `candidate_memory_embedding`. */
export async function indexCandidateFact(
  db: Db,
  params: IndexFactParams,
  embedder: Embedder,
): Promise<void> {
  const [embedding] = await embedder.embed([params.text]);
  if (!embedding) {
    throw new Error("embedder devolveu vazio");
  }
  await db
    .insert(candidateMemoryEmbedding)
    .values({ factId: params.factId, agencyId: params.agencyId, embedding });
}

export interface SimilarFact {
  id: string;
  competencia: string;
  factText: string;
  dist: number;
}

export interface SearchParams {
  agencyId: string;
  candidateId: string;
  query: string;
  k?: number;
}

/**
 * Busca os `k` factos do candidato mais próximos da query (distância cosine `<=>`), sempre
 * filtrado por `agency_id` + `candidate_id` (defesa-em-profundidade §15.1). pgvector na DB.
 */
export async function searchCandidateFacts(
  db: Db,
  params: SearchParams,
  embedder: Embedder,
): Promise<SimilarFact[]> {
  const [qv] = await embedder.embed([params.query]);
  if (!qv) {
    throw new Error("embedder devolveu vazio");
  }
  const lit = toVectorLiteral(qv);
  const k = params.k ?? 5;
  const res = await db.execute(sql`
    select f.id, f.competencia, f.fact_text as "factText",
           (e.embedding <=> ${lit}::vector) as dist
    from candidate_memory_fact f
    join candidate_memory_embedding e on e.fact_id = f.id
    where f.agency_id = ${params.agencyId} and f.candidate_id = ${params.candidateId}
    order by dist asc
    limit ${k}
  `);
  // raw query → cast através de unknown (a forma das colunas é controlada pelo SELECT acima).
  return res.rows as unknown as SimilarFact[];
}
