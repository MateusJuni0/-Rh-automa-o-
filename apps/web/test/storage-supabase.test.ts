import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseStorage,
  type SupabaseStorageApi,
  type SupabaseStorageBucketApi,
} from "../lib/storage";

/** Mock do bucket Supabase (sem rede): respostas canned. */
function mockBucket(over: Partial<SupabaseStorageBucketApi> = {}): SupabaseStorageBucketApi {
  return {
    createSignedUploadUrl: vi.fn(async () => ({
      data: { signedUrl: "https://sb/storage/v1/upload/signed/abc" },
      error: null,
    })),
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: "https://sb/storage/v1/object/signed/abc" },
      error: null,
    })),
    ...over,
  };
}

function mockApi(bucket: SupabaseStorageBucketApi): {
  api: SupabaseStorageApi;
  from: ReturnType<typeof vi.fn>;
} {
  const from = vi.fn(() => bucket);
  return { api: { from }, from };
}

describe("createSupabaseStorage (client mockado, sem rede)", () => {
  it("upload → signed URL real do serviço + expiresAt calculado pelo ttl", async () => {
    const bucket = mockBucket();
    const { api, from } = mockApi(bucket);
    const s = createSupabaseStorage({ storage: api, bucket: "vera-private", now: () => 1000 });

    const u = await s.signedUploadUrl("ag/uuid.pdf", { ttlSeconds: 60 });
    expect(from).toHaveBeenCalledWith("vera-private");
    expect(u.url).toBe("https://sb/storage/v1/upload/signed/abc");
    expect(u.expiresAt).toBe(1000 + 60 * 1000);
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith("ag/uuid.pdf");
  });

  it("download → createSignedUrl com o ttl em segundos", async () => {
    const bucket = mockBucket();
    const { api } = mockApi(bucket);
    const s = createSupabaseStorage({ storage: api, bucket: "vera-private", now: () => 0 });

    const d = await s.signedDownloadUrl("ag/uuid.pdf", { ttlSeconds: 120 });
    expect(d.url).toBe("https://sb/storage/v1/object/signed/abc");
    expect(bucket.createSignedUrl).toHaveBeenCalledWith("ag/uuid.pdf", 120);
  });

  it("erro do serviço → lança (sem falha silenciosa)", async () => {
    const bucket = mockBucket({
      createSignedUploadUrl: vi.fn(async () => ({ data: null, error: { message: "boom" } })),
    });
    const { api } = mockApi(bucket);
    const s = createSupabaseStorage({ storage: api, bucket: "vera-private" });

    await expect(s.signedUploadUrl("k")).rejects.toThrow(/boom/);
  });

  it("TTL por defeito quando não dado (300s)", async () => {
    const bucket = mockBucket();
    const { api } = mockApi(bucket);
    const s = createSupabaseStorage({ storage: api, bucket: "vera-private", now: () => 0 });
    const u = await s.signedUploadUrl("k");
    expect(u.expiresAt).toBe(300 * 1000);
  });
});
