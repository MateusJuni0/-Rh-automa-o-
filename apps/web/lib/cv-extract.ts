import { extractPdfText } from "./pdf-text";

/**
 * Extrai o texto de um CV em PDF (server-side, €0, sem chaves). Fino wrapper do funil partilhado
 * `extractPdfText` — só renomeia `text`→`cvText` para o contrato existente da rota de candidatos.
 */
export type CvExtract =
  | { ok: true; cvText: string; displayName: string }
  | { ok: false; reason: string };

export async function extractCvFromFile(params: {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  agencyId: string;
}): Promise<CvExtract> {
  const r = await extractPdfText(params);
  if (!r.ok) {
    return r;
  }
  return { ok: true, cvText: r.text, displayName: r.displayName };
}
