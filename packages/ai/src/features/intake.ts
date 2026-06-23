import { type IntakeEnvelope, intakeEnvelope } from "@rh/core";
import { generate } from "../generate";
import type { RunSlotOptions } from "../runner";

/** Feature de INTAKE do cérebro (slot EXTRACTOR): classifica a entrada num envelope tipado. */

const INTAKE_SYSTEM = [
  "Classifica a entrada da Filipa num envelope de intake tipado (INTAKE-E-JULGAMENTO).",
  "alvo: cliente|vaga|candidato. intencao: setup|add_requisito|corrigir_facto|pergunta|nova_vaga|novo_candidato.",
  "NUNCA adivinhes o alvoId — devolve null (resolve-se por contexto de sessão/seleção).",
  "'pergunta' responde sem gravar nada durável.",
  'Devolve APENAS JSON: { "alvo": ..., "alvoId": null, "intencao": ..., "conteudo": string }.',
].join("\n");

/** Classifica uma mensagem de intake (web/Telegram/WhatsApp) → envelope validado. */
export function classifyIntake(text: string, opts: RunSlotOptions): Promise<IntakeEnvelope> {
  return generate("EXTRACTOR", { system: INTAKE_SYSTEM, user: text }, intakeEnvelope, opts);
}
