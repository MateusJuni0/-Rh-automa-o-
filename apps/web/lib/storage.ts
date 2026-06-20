/** Storage de ficheiros PII (CVs, áudios, pareceres). Bucket PRIVADO por agência; acesso SÓ por
 * signed URL de curta duração (SEGURANCA §4). Provider real = Supabase Storage (Ω-3b) atrás desta
 * interface; sem env → stub determinístico e inerte. NUNCA expor caminho cru. */

export interface SignedUrl {
  url: string;
  expiresAt: number; // epoch ms
}

/**
 * Provider de storage. Assíncrono: o provider real (Supabase) faz I/O de rede para assinar.
 * O mock resolve de imediato (mantém a mesma assinatura → o consumidor é igual com/sem chave).
 */
export interface StorageProvider {
  signedUploadUrl(key: string, opts?: { ttlSeconds?: number }): Promise<SignedUrl>;
  signedDownloadUrl(key: string, opts?: { ttlSeconds?: number }): Promise<SignedUrl>;
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
    signedUploadUrl: (key, opts) =>
      Promise.resolve(sign("put", key, opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS)),
    signedDownloadUrl: (key, opts) =>
      Promise.resolve(sign("get", key, opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS)),
  };
}

// ───────────────────────────── Supabase Storage (Ω-3b) ─────────────────────────────

/**
 * Cliente mínimo do Supabase Storage de que precisamos (signed upload/download URLs num bucket).
 * Estruturalmente compatível com `supabaseClient.storage.from(bucket)` — injetável para testes
 * (sem rede). A app passa o cliente real `@supabase/supabase-js`; os testes passam um mock.
 */
export interface SupabaseStorageBucketApi {
  createSignedUploadUrl(key: string): Promise<{
    data: { signedUrl: string } | null;
    error: { message: string } | null;
  }>;
  createSignedUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
}

export interface SupabaseStorageApi {
  from(bucket: string): SupabaseStorageBucketApi;
}

export interface SupabaseStorageOptions {
  storage: SupabaseStorageApi;
  bucket: string;
  /** Relógio injetável p/ `expiresAt` (o Supabase não devolve a expiração → calculamo-la). */
  now?: () => number;
}

/**
 * StorageProvider REAL sobre o Supabase Storage (bucket PRIVADO por agência). As signed URLs são
 * geradas pelo serviço (segredo no servidor, nunca exposto). Erro do serviço → lança (sem falha
 * silenciosa). Ativado por env via `getStorage` (config-not-code); sem env → stub mock.
 */
export function createSupabaseStorage(opts: SupabaseStorageOptions): StorageProvider {
  const now = opts.now ?? Date.now;
  const bucket = opts.storage.from(opts.bucket);
  return {
    async signedUploadUrl(key, urlOpts) {
      const ttl = urlOpts?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
      const { data, error } = await bucket.createSignedUploadUrl(key);
      if (error || !data) {
        throw new Error(
          `supabase storage: falha a assinar upload (${error?.message ?? "sem dados"})`,
        );
      }
      return { url: data.signedUrl, expiresAt: now() + ttl * 1000 };
    },
    async signedDownloadUrl(key, urlOpts) {
      const ttl = urlOpts?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
      const { data, error } = await bucket.createSignedUrl(key, ttl);
      if (error || !data) {
        throw new Error(
          `supabase storage: falha a assinar download (${error?.message ?? "sem dados"})`,
        );
      }
      return { url: data.signedUrl, expiresAt: now() + ttl * 1000 };
    },
  };
}
