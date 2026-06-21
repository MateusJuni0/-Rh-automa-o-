"use client";

import { Button, Field, Input, Textarea } from "@rh/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useState } from "react";

interface ClienteEditData {
  id: string;
  name: string;
  sector: string | null;
  website: string | null;
  description: string | null;
  location: string | null;
  founded: string | null;
  headcount: string | null;
  linkedinUrl: string | null;
  techStack: string[] | null;
}

/** A Filipa edita a ficha do cliente. Guarda via PATCH /api/clientes/:id e volta ao detalhe. */
export function ClienteEditForm({ cliente }: { cliente: ClienteEditData }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: cliente.name,
    sector: cliente.sector ?? "",
    website: cliente.website ?? "",
    description: cliente.description ?? "",
    location: cliente.location ?? "",
    founded: cliente.founded ?? "",
    headcount: cliente.headcount ?? "",
    linkedinUrl: cliente.linkedinUrl ?? "",
    techStack: (cliente.techStack ?? []).join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...f,
          techStack: f.techStack
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        setError("Não consegui guardar (verifica os campos).");
        return;
      }
      router.push(`/clientes/${cliente.id}`);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Nome">
        <Input value={f.name} onChange={set("name")} required />
      </Field>
      <Field label="Setor">
        <Input value={f.sector} onChange={set("sector")} placeholder="ex.: Fintech · Pagamentos" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sede / mercado">
          <Input value={f.location} onChange={set("location")} placeholder="Lisboa, Portugal" />
        </Field>
        <Field label="Fundada em">
          <Input value={f.founded} onChange={set("founded")} placeholder="2015" />
        </Field>
        <Field label="Dimensão da equipa">
          <Input value={f.headcount} onChange={set("headcount")} placeholder="200+" />
        </Field>
        <Field label="Website">
          <Input value={f.website} onChange={set("website")} placeholder="https://…" />
        </Field>
      </div>
      <Field label="LinkedIn">
        <Input
          value={f.linkedinUrl}
          onChange={set("linkedinUrl")}
          placeholder="https://linkedin.com/company/…"
        />
      </Field>
      <Field label="Stack" hint="Separado por vírgulas (ex.: React, Node.js, AWS).">
        <Input value={f.techStack} onChange={set("techStack")} />
      </Field>
      <Field label="Descrição">
        <Textarea rows={4} value={f.description} onChange={set("description")} />
      </Field>
      <div className="mt-1 flex items-center gap-4">
        <Button type="submit" disabled={busy}>
          {busy ? "A guardar…" : "Guardar alterações"}
        </Button>
        <Link
          href={`/clientes/${cliente.id}`}
          className="text-ink-2 text-sm transition-colors hover:text-ink"
        >
          Cancelar
        </Link>
      </div>
      {error ? <p className="text-alert text-sm">{error}</p> : null}
    </form>
  );
}
