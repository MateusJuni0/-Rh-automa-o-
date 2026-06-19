import { type MatchResult, matchResult, type Parecer, parecer, type RoleProfile } from "@rh/core";
import { generate } from "../generate";
import type { RunSlotOptions } from "../runner";

/**
 * Features de JUÍZO do cérebro (slot ARCHITECT). Cada uma = prompt + `generate()` contra o schema
 * de `@rh/core`. Testáveis com transporte mock (sem chaves). Os prompts encodam as regras da spec.
 */

export interface MatchInput {
  candidate: { name: string; profile: Record<string, unknown> };
  roleProfile: RoleProfile;
  requirements: Record<string, unknown>;
}

const MATCH_SYSTEM = [
  "És um analista de recrutamento. Compara o candidato com o Role Profile e os requisitos do cliente.",
  "Regras anti-achismo: baseia-te em evidência do perfil; o que não está provado vai para gaps_a_investigar, não para pontos_fortes.",
  'Devolve APENAS JSON: { "matchScore": number (0-100), "gapsAInvestigar": string[], "pontosFortes": string[] }.',
].join("\n");

/** Match candidato × vaga (PLANO P1.4) — antes da entrevista. */
export function matchCandidate(input: MatchInput, opts: RunSlotOptions): Promise<MatchResult> {
  return generate(
    "ARCHITECT",
    { system: MATCH_SYSTEM, user: JSON.stringify(input) },
    matchResult,
    opts,
  );
}

export interface ParecerInput {
  candidate: { name: string };
  clientCriteria: Array<{ criterio: string; peso: string }>;
  factos: Array<{
    competencia: string;
    factText: string;
    evidenceQuote?: string;
    evidenceTs?: string;
    rubricLevel?: string;
    naoSustentado?: boolean;
  }>;
  contradicoes?: Array<{ detalhe: string; tsA?: string; tsB?: string }>;
  credenciais?: Array<{ credencial: string; estado: string }>;
  naoCapturado?: Array<{ inicio: string; fim: string | null; causa: string }>;
}

const PARECER_SYSTEM = [
  "Gera o parecer para o CLIENTE (RELATORIO-CLIENTE §3), em linguagem simples, sem jargão.",
  "Regras DURAS:",
  "- Critério não coberto assinala-se sozinho (resposta 'não-confirmado'), nunca se inventa nem esconde.",
  "- Inconsistências mostram-se com os DOIS lados + timestamps; PROIBIDO vocabulário de intenção ('mentiu', 'desonesto').",
  "- Credenciais reguladas verificam-se por DOCUMENTO (secção própria), nunca pela profundidade da resposta.",
  "- Intervalos sem captura assinalam-se na fiabilidade ('não-capturado HH:MM–HH:MM').",
  "Devolve APENAS JSON conforme o schema do parecer (veredito, criterios[], forcas, riscos, logistica, anguloVenda, credenciaisAVerificar, naoCapturado, fontes).",
].join("\n");

/** Parecer final (PLANO P3.1) — depois da entrevista. */
export function buildParecer(input: ParecerInput, opts: RunSlotOptions): Promise<Parecer> {
  return generate(
    "ARCHITECT",
    { system: PARECER_SYSTEM, user: JSON.stringify(input) },
    parecer,
    opts,
  );
}
