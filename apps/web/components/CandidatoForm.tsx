"use client";

import { Button, Field, Input, Textarea } from "@rh/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * Form de candidato: anexa o CV em PDF (a Vera lê) OU cola o texto. Posta `multipart/form-data`
 * para `/api/candidatos` (que extrai o PDF server-side). 3 estados (idle/a-criar/erro).
 */
export function CandidatoForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const formEl = e.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/candidatos", { method: "POST", body: new FormData(formEl) });
      const json: { ok?: boolean; error?: { message?: string } } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "Falha ao criar o candidato.");
        return;
      }
      formEl.reset();
      setFileName(null);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col rounded-card border border-line bg-card">
      <header className="border-line-subtle border-b px-4 py-3">
        <h2 className="font-medium text-ink text-sm">Novo candidato</h2>
        <p className="mt-0.5 text-ink-3 text-xs">
          Anexa o CV em PDF — a Vera lê — ou cola o texto.
        </p>
      </header>
      <div className="flex flex-col gap-3.5 p-4">
        <Field label="Nome do candidato">
          <Input name="name" required />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-[13px] text-ink-2">CV em PDF</span>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-line border-dashed bg-surface px-3 py-5 text-center text-ink-3 text-sm transition-colors hover:border-accent hover:text-ink">
            <input
              type="file"
              name="cvFile"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            {fileName ? (
              <span className="text-ink">📄 {fileName}</span>
            ) : (
              <>
                <span className="text-lg" aria-hidden="true">
                  📎
                </span>
                <span>Escolhe um PDF</span>
              </>
            )}
          </label>
        </div>

        <Field
          label="… ou cola o texto do CV"
          hint="Usa isto se não tiveres o PDF (ou para DOC/DOCX)."
        >
          <Textarea name="cvText" />
        </Field>

        <Button type="submit" disabled={busy} className="mt-1 self-start">
          {busy ? "A criar…" : "Criar candidato"}
        </Button>
        {error ? <p className="text-alert text-sm">{error}</p> : null}
      </div>
    </form>
  );
}
