import {
  type CandidateProfile,
  candidateProfile,
  type JobRequirements,
  jobRequirements,
} from "@rh/core";
import { generate } from "../generate";
import type { RunSlotOptions } from "../runner";

/** Features de EXTRAÇÃO do cérebro (slot EXTRACTOR — barato, output estruturado). */

const JOB_SYSTEM = [
  "Extrai os requisitos estruturados do texto da vaga do cliente.",
  "Não inventes; o que não estiver no texto deixa vazio.",
  'Devolve APENAS JSON: { "roleType": string (slug), "nivel": string, "skills": { "must": string[], "nice": string[] }, "contexto": string }.',
].join("\n");

/** Extrai `job.requirements` do texto/documento da vaga (PLANO P1.1). */
export function extractJobRequirements(
  text: string,
  opts: RunSlotOptions,
): Promise<JobRequirements> {
  return generate("EXTRACTOR", { system: JOB_SYSTEM, user: text }, jobRequirements, opts);
}

const CV_SYSTEM = [
  "Extrai o perfil estruturado do CV do candidato.",
  "Não inventes — o que não está no CV vai para gapsCv.",
  'Devolve APENAS JSON: { "skillsDeclaradas": string[], "experienciaAnos": number|null, "gapsCv": string[], "resumo"?: string }.',
].join("\n");

/** Extrai `candidate.profile` do CV (PLANO P1.3). */
export function extractCandidateProfile(
  cvText: string,
  opts: RunSlotOptions,
): Promise<CandidateProfile> {
  return generate("EXTRACTOR", { system: CV_SYSTEM, user: cvText }, candidateProfile, opts);
}
