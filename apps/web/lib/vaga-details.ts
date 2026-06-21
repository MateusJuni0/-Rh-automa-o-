import { z } from "zod";

/**
 * Ficha COMPLETA da vaga (recrutador) — tudo o que a Filipa precisa para responder ao candidato:
 * condições, modelo, horário, contrato, benefícios, processo de entrevista, responsabilidades.
 * Guardada em `job.details` (JSONB). Preenchida pela Vera (do pedido do cliente) e editável pela Filipa.
 */
export const jobDetails = z.object({
  modeloTrabalho: z.string().nullable(), // "Remoto" | "Híbrido (2 dias)" | "Presencial"
  localizacao: z.string().nullable(), // local da vaga (pode diferir da sede)
  horario: z.string().nullable(), // "Flexível, core 10h-16h (CET)"
  salarioMin: z.number().nullable(),
  salarioMax: z.number().nullable(),
  moeda: z.string().nullable(), // "EUR"
  contrato: z.string().nullable(), // "Efetivo (sem termo)"
  idiomas: z.array(z.string()),
  visaRelocation: z.string().nullable(), // "Apoio a relocation; sem patrocínio de visto"
  dataInicio: z.string().nullable(), // "ASAP" | "Set 2026"
  beneficios: z.array(z.string()),
  processoEntrevista: z.array(z.string()), // etapas
  responsabilidades: z.array(z.string()),
  equipa: z.string().nullable(), // "Equipa de 8; reporta ao Eng. Manager"
});

export type JobDetails = z.infer<typeof jobDetails>;

export const EMPTY_DETAILS: JobDetails = {
  modeloTrabalho: null,
  localizacao: null,
  horario: null,
  salarioMin: null,
  salarioMax: null,
  moeda: null,
  contrato: null,
  idiomas: [],
  visaRelocation: null,
  dataInicio: null,
  beneficios: [],
  processoEntrevista: [],
  responsabilidades: [],
  equipa: null,
};

/** Valida `job.details` (JSONB) na fronteira; cai para vazio se o shape não bater. */
export function parseJobDetails(raw: unknown): JobDetails {
  const parsed = jobDetails.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_DETAILS;
}

/** Salário formatado (range) para mostrar. Null se não houver. */
export function formatSalario(d: JobDetails): string | null {
  const moeda = d.moeda ?? "EUR";
  if (d.salarioMin != null && d.salarioMax != null) {
    return `${d.salarioMin.toLocaleString("pt-PT")} – ${d.salarioMax.toLocaleString("pt-PT")} ${moeda}`;
  }
  if (d.salarioMin != null) {
    return `desde ${d.salarioMin.toLocaleString("pt-PT")} ${moeda}`;
  }
  return null;
}

/**
 * Auto-preenchimento HEURÍSTICO (sem chave de IA): deteta o que dá do texto do pedido do cliente
 * (modelo de trabalho, idioma). O resto fica por preencher → a Filipa completa na edição. Com a
 * chave de IA, a Vera extrai a ficha completa; este stub mantém o fluxo a funcionar sem custo.
 */
export function heuristicVagaDetails(text: string): JobDetails {
  const t = text.toLowerCase();
  const remoto = /\b(remote|remoto|fully remote|100% remoto|remote-first)\b/.test(t);
  const hibrido = /\b(hybrid|híbrido|hibrido)\b/.test(t);
  const presencial = /\b(on-?site|presencial|escritório)\b/.test(t);
  const modelo = remoto ? "Remoto" : hibrido ? "Híbrido" : presencial ? "Presencial" : null;
  const idiomas: string[] = [];
  if (/\b(english|inglês|ingles)\b/.test(t)) idiomas.push("Inglês");
  if (/\b(portuguese|português|portugues)\b/.test(t)) idiomas.push("Português");
  return { ...EMPTY_DETAILS, modeloTrabalho: modelo, idiomas };
}
