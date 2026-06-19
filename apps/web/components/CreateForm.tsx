"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

interface CreateFormProps {
  endpoint: string;
  fields: FormField[];
  submitLabel?: string;
}

/** Form genérico: POST JSON ao `endpoint`, limpa e revalida (router.refresh) em sucesso. */
export function CreateForm({ endpoint, fields, submitLabel = "Criar" }: CreateFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const formEl = e.currentTarget;
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(new FormData(formEl).entries());
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError("Falha ao criar (verifica os campos).");
        return;
      }
      formEl.reset();
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
    >
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{f.label}</span>
          {f.type === "textarea" ? (
            <textarea
              name={f.name}
              required={f.required ?? true}
              rows={3}
              className="rounded border border-neutral-300 px-2 py-1"
            />
          ) : f.type === "select" ? (
            <select
              name={f.name}
              required={f.required ?? true}
              className="rounded border border-neutral-300 px-2 py-1"
            >
              <option value="">—</option>
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.name}
              required={f.required ?? true}
              className="rounded border border-neutral-300 px-2 py-1"
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded bg-violet-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "A criar…" : submitLabel}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
