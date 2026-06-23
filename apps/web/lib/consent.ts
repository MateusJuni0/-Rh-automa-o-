/**
 * Gate de consentimento (SEGURANCA §5, LEGAL-E-RGPD §6, AUTH-CONTRACT §5): a captura ao vivo só
 * arranca com consentimento DADO. Determinístico, server-side, sem chaves. `capture_type='none'`
 * (v1, sem áudio) nunca precisa de consentimento — não há captura a proteger.
 *
 * Critério de aceitação (TESTES-ACEITACAO §275/§308): `consent_status != 'dado'` → a captura é
 * recusada no servidor (não basta esconder o botão no cliente).
 */

/** Tipos de captura — espelha o CHECK de `interview.capture_type`. */
export type CaptureType = "bot_online" | "local_mic" | "none";

/** `'dado'` = consentimento explícito. Qualquer outro valor (pendente/recusado/ausente) bloqueia. */
export const CONSENT_GRANTED = "dado";

/** Captura REAL grava o candidato (áudio/bot). `none` não captura → dispensa consentimento. */
export function isRealCapture(captureType: CaptureType): boolean {
  return captureType === "bot_online" || captureType === "local_mic";
}

/** Lançada quando se tenta arrancar captura real sem consentimento dado. */
export class ConsentNotGrantedError extends Error {
  constructor(readonly consentStatus: string | null) {
    super(
      `captura recusada: consentimento '${consentStatus ?? "ausente"}' (exige '${CONSENT_GRANTED}')`,
    );
    this.name = "ConsentNotGrantedError";
  }
}

/**
 * Recusa (lança `ConsentNotGrantedError`) se uma captura REAL for pedida sem consentimento dado.
 * Chamar SEMPRE no servidor antes de arrancar qualquer captura (entrevista/overlay). `none` passa.
 */
export function assertCaptureAllowed(captureType: CaptureType, consentStatus: string | null): void {
  if (isRealCapture(captureType) && consentStatus !== CONSENT_GRANTED) {
    throw new ConsentNotGrantedError(consentStatus);
  }
}
