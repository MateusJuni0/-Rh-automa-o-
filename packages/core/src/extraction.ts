import { z } from "zod";

/**
 * Shapes de EXTRAÇÃO (o que o EXTRACTOR produz a partir de texto). A spec descreve os campos em
 * prosa (PLANO P1.1/P1.3); aqui fixa-se a forma Zod. Vão para os JSONB `job.requirements` / `candidate.profile`.
 */

/** Requisitos extraídos do texto da vaga do cliente (PLANO P1.1: role, nível, skills, contexto). */
export const jobRequirements = z.object({
  roleType: z.string(), // slug, ex.: "dev_frontend_react_pleno"
  nivel: z.string(), // junior|pleno|senior|…
  skills: z.object({ must: z.array(z.string()), nice: z.array(z.string()) }),
  contexto: z.string(),
});
export type JobRequirements = z.infer<typeof jobRequirements>;

/** Perfil extraído do CV (PLANO P1.3: skills_declaradas, experiencia_anos, gaps_cv). */
export const candidateProfile = z.object({
  skillsDeclaradas: z.array(z.string()),
  experienciaAnos: z.number().nullable(),
  gapsCv: z.array(z.string()),
  resumo: z.string().optional(),
});
export type CandidateProfile = z.infer<typeof candidateProfile>;
