import type { CandidateProfile, JobRequirements } from "@rh/core";

/**
 * Extração DETERMINÍSTICA (baseline) de CV/requisitos por palavra-chave — o fallback quando NÃO há
 * chave de IA. NÃO é a IA real (que extrai com nuance/contexto); é uma deteção honesta por dicionário
 * para a app ser útil a €0 e ficar pronta para o LLM. Com `OPENROUTER_API_KEY`, o `@rh/ai` substitui.
 */

/** Dicionário de skills técnicas (rótulo canónico). Match = substring (case-insensitive) no texto. */
const SKILL_DICT = [
  "TypeScript",
  "JavaScript",
  "React",
  "Next.js",
  "Node.js",
  "Vue",
  "Svelte",
  "Angular",
  "Tailwind",
  "Framer Motion",
  "Python",
  "Django",
  "FastAPI",
  "Flask",
  "Java",
  "Spring",
  "Kotlin",
  "Go",
  "Rust",
  "PHP",
  "Laravel",
  "Ruby",
  "Rails",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Supabase",
  "Firebase",
  "Drizzle",
  "Prisma",
  "GraphQL",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "Terraform",
  "CI/CD",
  "Linux",
  "Electron",
  "LLM",
  "Machine Learning",
  "TensorFlow",
  "PyTorch",
  "Kafka",
] as const;

/** Detecta as skills do dicionário presentes no texto (preserva o rótulo canónico, sem duplicados). */
function detectSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found = SKILL_DICT.filter((s) => lower.includes(s.toLowerCase()));
  return [...new Set(found)];
}

/** Maior nº de "anos"/"years" referido no texto (ex.: "6 anos", "5+ years") — senão `null`. */
function detectYears(text: string): number | null {
  const matches = [...text.matchAll(/(\d{1,2})\s*\+?\s*(anos|years|yrs)\b/gi)];
  const years = matches.map((m) => Number(m[1])).filter((n) => Number.isFinite(n) && n <= 50);
  return years.length > 0 ? Math.max(...years) : null;
}

/** Nível inferido por palavras-chave (sénior/pleno/júnior); default "pleno". */
function detectNivel(text: string): string {
  const t = text.toLowerCase();
  if (/\b(s[eé]nior|senior|lead|principal|staff)\b/.test(t)) {
    return "senior";
  }
  if (/\b(j[uú]nior|junior|est[aá]gi|trainee|graduate)\b/.test(t)) {
    return "junior";
  }
  return "pleno";
}

function squish(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Perfil do candidato a partir do texto do CV (skills detetadas + anos + resumo). */
export function heuristicProfile(cvText: string): CandidateProfile {
  const skills = detectSkills(cvText);
  return {
    skillsDeclaradas: skills,
    experienciaAnos: detectYears(cvText),
    gapsCv: skills.length === 0 ? ["Sem skills técnicas reconhecidas no texto"] : [],
    resumo: squish(cvText, 400),
  };
}

/** Requisitos da vaga a partir do texto do cliente (must = skills detetadas; nível inferido). */
export function heuristicRequirements(text: string, roleTypeSlug?: string): JobRequirements {
  const must = detectSkills(text);
  return {
    roleType: roleTypeSlug ?? "demo_role",
    nivel: detectNivel(text),
    skills: { must, nice: [] },
    contexto: squish(text, 500),
  };
}
