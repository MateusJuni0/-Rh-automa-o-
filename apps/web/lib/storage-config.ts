import { createClient } from "@supabase/supabase-js";
import {
  createAgencyScopedStorage,
  createMockStorage,
  createSupabaseStorage,
  type StorageProvider,
  type SupabaseStorageApi,
} from "./storage";

/** Bucket privado por defeito (env `SUPABASE_STORAGE_BUCKET`). */
const DEFAULT_BUCKET = "vera-private";

/** O storage REAL está ligado quando há URL + service-role key do Supabase. */
export const STORAGE_ENABLED = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Factory config-not-code do StorageProvider. Com `SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY` →
 * Supabase Storage real (signed URLs verdadeiras, bucket privado); sem env → stub mock determinístico
 * (dev/testes a €0). A service-role key NUNCA vai ao cliente (este módulo é server-only). Sem segredos
 * hardcoded.
 */
export function getStorage(): StorageProvider {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return createMockStorage(Date.now);
  }
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  // O `client.storage` satisfaz estruturalmente `SupabaseStorageApi` (from→createSignedUrl/Upload).
  return createSupabaseStorage({
    storage: client.storage as unknown as SupabaseStorageApi,
    bucket,
  });
}

/**
 * Storage JÁ com âmbito de agência (anti-IDOR) — é o que as ROTAS devem usar. `agencyId` vem da
 * SESSÃO (servidor, via `getSession`), NUNCA do cliente. Qualquer key sem o prefixo `${agencyId}/`
 * (ou com traversal) é recusada antes de tocar no storage. Combina com a `storageKey` gerada por
 * `validateUpload` (que já prefixa a agência).
 */
export function getAgencyStorage(agencyId: string): StorageProvider {
  return createAgencyScopedStorage(getStorage(), agencyId);
}
