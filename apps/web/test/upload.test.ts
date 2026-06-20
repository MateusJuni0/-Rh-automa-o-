import { describe, expect, it } from "vitest";
import { createMockStorage, DEFAULT_TTL_SECONDS } from "../lib/storage";
import { MAX_UPLOAD_BYTES, validateUpload } from "../lib/upload";

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

describe("validateUpload (segurança de ficheiros)", () => {
  it("PDF válido passa → storageKey UUID.pdf + displayName", () => {
    const r = validateUpload({
      filename: "cv.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
      header: PDF_MAGIC,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.storageKey).toMatch(/^[0-9a-f-]{36}\.pdf$/);
      expect(r.storageKey).not.toContain("cv");
      expect(r.displayName).toBe("cv.pdf");
    }
  });

  it("extensão maiúscula (.PDF) → passa", () => {
    const r = validateUpload({
      filename: "CV.PDF",
      mime: "application/pdf",
      sizeBytes: 100,
      header: PDF_MAGIC,
    });
    expect(r.ok).toBe(true);
  });

  it("sem magic-bytes (header) → rejeita (conteúdo não verificado)", () => {
    const r = validateUpload({ filename: "cv.pdf", mime: "application/pdf", sizeBytes: 100 });
    expect(r.ok).toBe(false);
  });

  it("sizeBytes NaN/decimal → rejeita (inteiro finito)", () => {
    expect(
      validateUpload({ filename: "cv.pdf", mime: "application/pdf", sizeBytes: Number.NaN }).ok,
    ).toBe(false);
    expect(validateUpload({ filename: "cv.pdf", mime: "application/pdf", sizeBytes: 1.5 }).ok).toBe(
      false,
    );
  });

  it("tipo não permitido (.exe/octet-stream) → rejeita", () => {
    const r = validateUpload({
      filename: "x.exe",
      mime: "application/x-msdownload",
      sizeBytes: 100,
    });
    expect(r.ok).toBe(false);
  });

  it("extensão ≠ mime (exe disfarçado de pdf) → rejeita", () => {
    const r = validateUpload({ filename: "cv.exe", mime: "application/pdf", sizeBytes: 100 });
    expect(r).toEqual({ ok: false, reason: "extensão não corresponde ao tipo" });
  });

  it("magic-bytes ≠ tipo declarado → rejeita", () => {
    const r = validateUpload({
      filename: "cv.pdf",
      mime: "application/pdf",
      sizeBytes: 100,
      header: ZIP_MAGIC,
    });
    expect(r).toEqual({ ok: false, reason: "conteúdo não corresponde ao tipo declarado" });
  });

  it("acima do tamanho máximo → rejeita; vazio → rejeita", () => {
    expect(
      validateUpload({
        filename: "cv.pdf",
        mime: "application/pdf",
        sizeBytes: MAX_UPLOAD_BYTES + 1,
      }).ok,
    ).toBe(false);
    expect(validateUpload({ filename: "cv.pdf", mime: "application/pdf", sizeBytes: 0 }).ok).toBe(
      false,
    );
  });

  it("path traversal no nome → storageKey UUID (sem ../) + displayName saneado", () => {
    const r = validateUpload({
      filename: "../../etc/passwd.pdf",
      mime: "application/pdf",
      sizeBytes: 100,
      header: PDF_MAGIC,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.storageKey).not.toContain("..");
      expect(r.storageKey).not.toContain("/");
      expect(r.displayName).toBe("passwd.pdf");
    }
  });
});

describe("createMockStorage (signed URLs)", () => {
  it("upload URL respeita o ttl e expira no futuro", async () => {
    const s = createMockStorage(() => 1000);
    const u = await s.signedUploadUrl("ag/cv.pdf", { ttlSeconds: 60 });
    expect(u.expiresAt).toBe(1000 + 60 * 1000);
    expect(u.url).toContain("kind=put");
    expect(u.url).toContain("exp=61000");
    expect(u.url).toContain("sig=");
  });

  it("download URL usa o ttl por defeito", async () => {
    const s = createMockStorage(() => 0);
    const d = await s.signedDownloadUrl("ag/cv.pdf");
    expect(d.expiresAt).toBe(DEFAULT_TTL_SECONDS * 1000);
    expect(d.url).toContain("kind=get");
  });

  it("chaves diferentes → assinaturas diferentes", async () => {
    const s = createMockStorage(() => 0);
    expect((await s.signedDownloadUrl("a")).url).not.toBe((await s.signedDownloadUrl("b")).url);
  });
});
