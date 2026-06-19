import type { RequisitoStatus } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { triageVaga } from "./triagem";
import { getVaga } from "./vagas";

type Db = DbHandle["db"];

export interface ComparisonCell {
  requisito: string;
  status: RequisitoStatus;
}

export interface ComparisonColumn {
  candidateId: string;
  name: string;
  matchScore: number;
  cells: ComparisonCell[];
}

export interface ComparisonMatrix {
  requisitos: string[];
  columns: ComparisonColumn[];
}

/**
 * Matriz de comparação (Tela 10): requisitos (linhas) × candidatos (colunas); célula = status.
 * Reusa a triagem (cobertos/faltantes). v1 mock: coberto→"coberto-com-prova", senão "não-tocado"
 * (os estados "raso"/"contradito" pedem prova real da entrevista → FASE Ω).
 */
export async function buildComparisonMatrix(
  db: Db,
  agencyId: string,
  jobId: string,
  candidateIds: readonly string[] = [],
): Promise<ComparisonMatrix> {
  const vaga = await getVaga(db, agencyId, jobId);
  if (!vaga) {
    return { requisitos: [], columns: [] };
  }
  const requisitos = vaga.requirements.skills.must;
  const rows = await triageVaga(db, agencyId, jobId);
  const wanted =
    candidateIds.length > 0 ? rows.filter((r) => candidateIds.includes(r.candidateId)) : rows;
  const columns = wanted.map((r): ComparisonColumn => {
    const covered = new Set(r.cobertos);
    return {
      candidateId: r.candidateId,
      name: r.name,
      matchScore: r.matchScore,
      cells: requisitos.map((req) => ({
        requisito: req,
        status: covered.has(req) ? "coberto-com-prova" : "não-tocado",
      })),
    };
  });
  return { requisitos, columns };
}
