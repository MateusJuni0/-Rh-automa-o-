"use client";

import { Button, Field, Input, Select, Textarea } from "@rh/ui";
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
  /** Cabeçalho opcional do painel (título + descrição) — torna o form um "aside" coerente. */
  title?: string;
  description?: string;
}

/** Form genérico: POST JSON ao `endpoint`, limpa e revalida (router.refresh) em sucesso. */
export function CreateForm({
  endpoint,
  fields,
  submitLabel = "Criar",
  title,
  description,
}: CreateFormProps) {
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
    <form onSubmit={onSubmit} className="flex flex-col rounded-card border border-line bg-card">
      {title ? (
        <header className="border-line-subtle border-b px-4 py-3">
          <h2 className="font-medium text-ink text-sm">{title}</h2>
          {description ? <p className="mt-0.5 text-ink-3 text-xs">{description}</p> : null}
        </header>
      ) : null}
      <div className="flex flex-col gap-3.5 p-4">
        {fields.map((f) => {
          const required = f.required ?? true;
          return (
            <Field key={f.name} label={f.label}>
              {f.type === "textarea" ? (
                <Textarea name={f.name} required={required} />
              ) : f.type === "select" ? (
                <Select name={f.name} required={required} defaultValue="">
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input name={f.name} required={required} />
              )}
            </Field>
          );
        })}
        <Button type="submit" disabled={busy} className="mt-1 self-start">
          {busy ? "A criar…" : submitLabel}
        </Button>
        {error ? <p className="text-alert text-sm">{error}</p> : null}
      </div>
    </form>
  );
}
