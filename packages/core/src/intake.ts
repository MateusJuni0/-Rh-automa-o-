import { z } from "zod";
import { intakeAlvo, intakeIntencao } from "./enums";

/**
 * Envelope tipado de uma entrada da Filipa (INTAKE-E-JULGAMENTO §) — web/Telegram/WhatsApp.
 * O bot NUNCA adivinha o alvo: resolve-se por contexto de sessão ou seleção. Nada durável
 * (`setup`/`add_requisito`/`nova_vaga`/`novo_candidato`/`corrigir_facto`) sem alvo confirmado;
 * `pergunta` responde sem gravar.
 */
export const intakeEnvelope = z.object({
  alvo: intakeAlvo,
  alvoId: z.uuid().nullable(), // resolvido por contexto/seleção; null até confirmado
  intencao: intakeIntencao,
  conteudo: z.string(), // texto | doc | audio_transcrito
});
export type IntakeEnvelope = z.infer<typeof intakeEnvelope>;
