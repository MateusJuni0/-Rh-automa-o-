/** Storage de ficheiros PII (CVs, áudios, pareceres). Bucket PRIVADO por agência; acesso SÓ por
 * signed URL de curta duração (SEGURANCA §4). Provider real (Supabase Storage/S3) = FASE Ω atrás
 * desta interface; o stub é determinístico e inerte (sem chave). NUNCA expor caminho cru. */

export interface SignedUrl {
  url: string;
  expiresAt: number; // epoch ms
}

export interface StorageProvider {
  signedUploadUrl(key: string, opts?: { ttlSeconds?: number }): SignedUrl;
  signedDownloadUrl(key: string, opts?: { ttlSeconds?: number }): SignedUrl;
}

export const DEFAULT_TTL_SECONDS = 300; // 5 min (curta duração)

/** Assinatura FAKE (não-secreta) só p/ o stub — a assinatura real usa o segredo do Storage (Ω). */
function fakeSig(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Stub determinístico do StorageProvider (v1). `now` é injetado (sem Date.now() escondido). Devolve
 * `mock://…?exp=…&sig=…` — demonstra o contrato (signed URL com expiração) sem storage real.
 */
export function createMockStorage(now: () => number): StorageProvider {
  function sign(kind: "put" | "get", key: string, ttlSeconds: number): SignedUrl {
    const expiresAt = now() + ttlSeconds * 1000;
    const sig = fakeSig(`${kind}:${key}:${expiresAt}`);
    const url = `mock://vera-private/${encodeURIComponent(key)}?kind=${kind}&exp=${expiresAt}&sig=${sig}`;
    return { url, expiresAt };
  }
  return {
    signedUploadUrl: (key, opts) => sign("put", key, opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    signedDownloadUrl: (key, opts) => sign("get", key, opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };
}
