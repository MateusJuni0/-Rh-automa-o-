import { extractPdfText } from "./pdf-text";

/**
 * Import de vaga por PDF: a Filipa anexa o PDF do pedido/descritivo da vaga e a Vera extrai o texto.
 * €0, sem chaves — espelha o "vaga por LINK" (mesmo shape `{text, title}` p/ o form). A extração
 * estruturada (requisitos/detalhes) continua a acontecer ao gravar (stub). Human-in-loop: ela revê.
 */
export type VagaPdfImport =
  | { ok: true; text: string; title: string | null }
  | { ok: false; reason: string };

/**
 * Título-palpite do PDF: a 1ª linha "de jeito" (curta — tipicamente o cargo no topo do descritivo).
 * Ignora linhas vazias, fragmentos (<3), parágrafos longos (>120) e linhas sem letras (separadores
 * decorativos `---`, números de página, bullets). Puro → testável.
 */
export function titleFromPdfText(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length >= 3 && line.length <= 120 && /\p{L}/u.test(line)) {
      return line;
    }
  }
  return null;
}

export async function importVagaFromPdf(params: {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  agencyId: string;
}): Promise<VagaPdfImport> {
  const r = await extractPdfText(params);
  if (!r.ok) {
    return r;
  }
  return { ok: true, text: r.text, title: titleFromPdfText(r.text) };
}
