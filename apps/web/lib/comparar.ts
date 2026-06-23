import type { RequisitoStatus } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, eq, inArray } from "drizzle-orm";
import { MAX_COMPARE, type SelectableCandidate } from "./comparar-select";
import { triageVaga } from "./triagem";
import { getVaga } from "./vagas";

type Db = DbHandle["db"];

export interface ComparisonCell {
  requisito: string;
  status: RequisitoStatus;
  /** Linha curta de prova (de onde vem o estado). */
  evidencia: string;
}

export interface ComparisonRow {
  /** Texto do critério (display). */
  requisito: string;
  /** `true` = requisito obrigatório (linha a bold). */
  must: boolean;
}

export interface ComparisonColumn {
  candidateId: string;
  name: string;
  matchScore: number;
  /** `false` = ainda só temos o CV (sem entrevista) → a prova é fraca. */
  temEntrevista: boolean;
  cells: ComparisonCell[];
}

export interface ComparisonMatrix {
  /** Linhas da matriz (must primeiro, depois nice), com a flag de obrigatório. */
  rows: ComparisonRow[];
  /** Retro-compat: só os textos dos must (consumido por testes/integrações antigas). */
  requisitos: string[];
  columns: ComparisonColumn[];
  /** `true` se algum candidato ainda não tem entrevista (mostra a nota de funil). */
  algumSoCv: boolean;
  /**
   * Universo de candidatos escolhíveis (TODOS os triados, antes do filtro/limite) — alimenta o
   * selector. As `columns` são o subconjunto efetivamente mostrado (até `MAX_COMPARE`).
   */
  available: SelectableCandidate[];
}

/** Linha de prova curta, em PT-PT, coerente com o estado (sem em-dash). */
function evidenciaFor(status: RequisitoStatus, temEntrevista: boolean): string {
  switch (status) {
    case "coberto-com-prova":
      return temEntrevista ? "Confirmado na entrevista." : "Declarado no CV.";
    case "raso":
      return "Tocado, sem prova.";
    case "contradito":
      return "Resposta contradiz o CV.";
    default:
      return "Não mencionado.";
  }
}

/**
 * Candidatos (deste lote) que já têm entrevista com substância (status 'done'). Lê a tabela
 * `interview` direto (best-effort, scoped a esta lib): é o sinal real do funil "CV vs entrevista".
 */
async function candidatosComEntrevista(
  db: Db,
  agencyId: string,
  candidateIds: readonly string[],
): Promise<Set<string>> {
  if (candidateIds.length === 0) {
    return new Set();
  }
  const rows = await db
    .select({ candidateId: schema.interview.candidateId })
    .from(schema.interview)
    .where(
      and(
        eq(schema.interview.agencyId, agencyId),
        eq(schema.interview.status, "done"),
        inArray(schema.interview.candidateId, [...candidateIds]),
      ),
    );
  const set = new Set<string>();
  for (const r of rows) {
    if (r.candidateId) {
      set.add(r.candidateId);
    }
  }
  return set;
}

/**
 * Matriz de comparação (Tela 10): critérios (linhas, must a bold) × candidatos (colunas) → estado +
 * prova curta por célula. Reusa a triagem (cobertos/faltantes) e cruza com o funil (tem entrevista?)
 * para distinguir "só CV" de "já entrevistado". v1 determinístico (sem chave): coberto→"coberto-com-prova",
 * senão "não-tocado"; os estados "raso"/"contradito" exigem prova real da entrevista → FASE Ω (com chave).
 */
export async function buildComparisonMatrix(
  db: Db,
  agencyId: string,
  jobId: string,
  candidateIds: readonly string[] = [],
): Promise<ComparisonMatrix> {
  const vaga = await getVaga(db, agencyId, jobId);
  if (!vaga) {
    return { rows: [], requisitos: [], columns: [], algumSoCv: false, available: [] };
  }
  const { must, nice } = vaga.requirements.skills;
  const rows: ComparisonRow[] = [
    ...must.map((requisito): ComparisonRow => ({ requisito, must: true })),
    ...nice.map((requisito): ComparisonRow => ({ requisito, must: false })),
  ];

  const triados = await triageVaga(db, agencyId, jobId);
  // Universo escolhível: todos os triados (nome + match) → o selector mostra-os, as colunas são o subconjunto.
  const available = triados.map(
    (r): SelectableCandidate => ({
      candidateId: r.candidateId,
      name: r.name,
      matchScore: r.matchScore,
    }),
  );
  const filtrados =
    candidateIds.length > 0 ? triados.filter((r) => candidateIds.includes(r.candidateId)) : triados;
  const selecionados = filtrados.slice(0, MAX_COMPARE);

  const comEntrevista = await candidatosComEntrevista(
    db,
    agencyId,
    selecionados.map((r) => r.candidateId),
  );

  const lower = (s: string): string => s.toLowerCase().trim();
  const columns = selecionados.map((r): ComparisonColumn => {
    const cobertos = new Set(r.cobertos.map(lower));
    const temEntrevista = comEntrevista.has(r.candidateId);
    return {
      candidateId: r.candidateId,
      name: r.name,
      matchScore: r.matchScore,
      temEntrevista,
      cells: rows.map((row): ComparisonCell => {
        // Os `nice` não entram na cobertura da triagem → tratam-se como não declarados (v1).
        const coberto = row.must && cobertos.has(lower(row.requisito));
        const status: RequisitoStatus = coberto ? "coberto-com-prova" : "não-tocado";
        return {
          requisito: row.requisito,
          status,
          evidencia: evidenciaFor(status, temEntrevista),
        };
      }),
    };
  });

  const algumSoCv = columns.some((c) => !c.temEntrevista);
  return { rows, requisitos: must, columns, algumSoCv, available };
}
