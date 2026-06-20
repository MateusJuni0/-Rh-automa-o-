import { randomUUID } from "node:crypto";

/** Validador ÚNICO de upload (SEGURANCA §3). v1: tamanho + MIME/extensão + magic-bytes + path-safe.
 * AV real (ClamAV), re-render de PDF e XXE-off no parser docx = FASE Ω. */

// 10 MB sobre o tamanho DECLARADO/comprimido. NOTA(Ω): não cobre zip-bomb (ratio de descompressão
// do docx) — isso fica para o parser + ClamAV na FASE Ω.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Allowlist ESTRITA p/ CV (PDF/DOC/DOCX). SVG/HTML/exe NÃO estão aqui → bloqueados por defeito.
const ALLOWED: Record<string, { ext: string; magic: readonly number[] }> = {
  "application/pdf": { ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    magic: [0x50, 0x4b, 0x03, 0x04], // PK.. (zip)
  },
  "application/msword": { ext: "doc", magic: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE
};

export interface UploadInput {
  filename: string;
  mime: string;
  sizeBytes: number;
  /** Primeiros bytes do ficheiro — OBRIGATÓRIO em runtime (magic-check). A rota TEM de ler o início
   * do ficheiro; sem isto o upload é rejeitado. */
  header?: Uint8Array;
  /**
   * ID da agência da SESSÃO (do servidor, NUNCA do cliente). A `storageKey` é prefixada por
   * `${agencyId}/` → todos os ficheiros de PII ficam particionados por agência no bucket privado
   * (anti-IDOR cross-agency). Tem de ser um UUID válido (defesa contra prefixo forjado/injeção de
   * caminho via agencyId).
   */
  agencyId: string;
}

/** UUID v4-ish (mesmo formato que o `randomUUID`/IDs da DB). Usado para validar o `agencyId`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UploadResult =
  | { ok: true; storageKey: string; displayName: string }
  | { ok: false; reason: string };

/** Nome só p/ MOSTRAR — basename saneado (o caminho real é o storageKey UUID). ⚠️ Quem o usar num
 * header `Content-Disposition` TEM de o codificar (RFC 5987 / encodeURIComponent). */
function sanitizeDisplayName(filename: string): string {
  const base = filename
    .replace(/^.*[\\/]/, "") // tira qualquer caminho (../, \, /)
    .replace(/[^\w.\- ]+/g, "_")
    .trim();
  return base.length > 0 ? base.slice(0, 120) : "ficheiro";
}

function magicMatches(header: Uint8Array, magic: readonly number[]): boolean {
  if (header.length < magic.length) {
    return false;
  }
  return magic.every((b, i) => header[i] === b);
}

export function validateUpload(input: UploadInput): UploadResult {
  // O agencyId vem da SESSÃO (servidor). Tem de ser UUID — recusa prefixo forjado/injeção de caminho.
  if (!UUID_RE.test(input.agencyId)) {
    return { ok: false, reason: "agência inválida" };
  }
  // sizeBytes vem de JSON não-tipado → exige inteiro finito (NaN/Infinity/decimal não passam).
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "tamanho inválido" };
  }
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "ficheiro grande demais (máx. 10MB)" };
  }
  const allowed = ALLOWED[input.mime];
  if (!allowed) {
    return { ok: false, reason: "tipo não permitido (só PDF/DOC/DOCX)" };
  }
  // extensão declarada TEM de bater com o MIME (anti .exe disfarçado de .pdf)
  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== allowed.ext) {
    return { ok: false, reason: "extensão não corresponde ao tipo" };
  }
  // magic-bytes OBRIGATÓRIOS: o conteúdo manda (apanha "cv.exe.pdf" com bytes de .exe, etc.).
  if (!input.header) {
    return { ok: false, reason: "magic-bytes obrigatórios (conteúdo não verificado)" };
  }
  if (!magicMatches(input.header, allowed.magic)) {
    return { ok: false, reason: "conteúdo não corresponde ao tipo declarado" };
  }
  // storage_path gerado pelo SERVIDOR: `${agencyId}/${uuid}.ext` — prefixo da agência da SESSÃO
  // (anti-IDOR cross-agency) + UUID (nunca o nome do utilizador → anti path traversal).
  return {
    ok: true,
    storageKey: `${input.agencyId}/${randomUUID()}.${allowed.ext}`,
    displayName: sanitizeDisplayName(input.filename),
  };
}
