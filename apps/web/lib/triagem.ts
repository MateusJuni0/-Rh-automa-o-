import { type CandidateProfile, candidateProfile } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getVaga } from "./vagas";

type Db = DbHandle["db"];

const EMPTY_PROFILE: CandidateProfile = {
  skillsDeclaradas: [],
  experienciaAnos: null,
  gapsCv: [],
  resumo: "",
};

/** Score MOCK determinístico (40..95) — varia por candidato p/ um ranking demo-able sem chave. */
function mockScore(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 40 + (Math.abs(h) % 56);
}

const lower = (s: string): string => s.toLowerCase().trim();

export interface TriageRow {
  candidateId: string;
  name: string;
  matchScore: number;
  cobertos: string[];
  faltantes: string[];
  resumo: string;
}

/**
 * Triagem (Tela 3): ranking de candidatos por match% para uma vaga. v1 = **mock determinístico**
 * (score do hash + cobertura dos must declarados) — demo-able sem chave. O match real por candidato
 * (`matchCandidate` com chave) + cache fica para a FASE Ω (N chamadas IA por triagem = perf/custo).
 */
export async function triageVaga(db: Db, agencyId: string, jobId: string): Promise<TriageRow[]> {
  const vaga = await getVaga(db, agencyId, jobId);
  if (!vaga) {
    return [];
  }
  const candidates = await db
    .select({
      id: schema.candidate.id,
      name: schema.candidate.name,
      profile: schema.candidate.profile,
    })
    .from(schema.candidate)
    .where(and(eq(schema.candidate.agencyId, agencyId), isNull(schema.candidate.deletedAt)))
    .orderBy(desc(schema.candidate.createdAt));

  const must = vaga.requirements.skills.must;
  const rows = candidates.map((c): TriageRow => {
    const parsed = candidateProfile.safeParse(c.profile);
    const profile = parsed.success ? parsed.data : EMPTY_PROFILE;
    const declared = new Set(profile.skillsDeclaradas.map(lower));
    return {
      candidateId: c.id,
      name: c.name,
      matchScore: mockScore(c.id + vaga.requirements.roleType),
      cobertos: must.filter((s) => declared.has(lower(s))),
      faltantes: must.filter((s) => !declared.has(lower(s))),
      resumo: profile.resumo ?? "",
    };
  });
  rows.sort((a, b) => b.matchScore - a.matchScore);
  return rows;
}
