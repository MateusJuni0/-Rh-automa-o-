import { extractText, getDocumentProxy } from "unpdf";
import { validateUpload } from "./upload";

/**
 * Extrai o texto de um CV em PDF (server-side, €0, sem chaves). Passa SEMPRE pelo `validateUpload`
 * (magic-bytes + tamanho + agency-scope) antes de tocar no conteúdo — um ficheiro disfarçado é
 * rejeitado. Só PDF é lido aqui (DOC/DOCX = colar texto, v1); PDF digitalizado (imagem) → sem texto.
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
  const v = validateUpload({
    filename: params.filename,
    mime: params.mime,
    sizeBytes: params.bytes.length,
    header: params.bytes.subarray(0, 8),
    agencyId: params.agencyId,
  });
  if (!v.ok) {
    return { ok: false, reason: v.reason };
  }
  if (params.mime !== "application/pdf") {
    return { ok: false, reason: "para já só lemos PDF — cola o texto para DOC/DOCX" };
  }
  try {
    const doc = await getDocumentProxy(params.bytes);
    const { text } = await extractText(doc, { mergePages: true });
    const clean = (Array.isArray(text) ? text.join("\n") : text).trim();
    if (clean.length < 10) {
      return {
        ok: false,
        reason: "não consegui ler texto deste PDF (pode ser digitalizado/imagem)",
      };
    }
    return { ok: true, cvText: clean, displayName: v.displayName };
  } catch {
    return { ok: false, reason: "PDF inválido ou ilegível" };
  }
}
