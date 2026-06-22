"use client";

import { Button, Field, Input, Select, Textarea } from "@rh/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

interface ClienteOption {
  id: string;
  name: string;
}
type Modo = "escrever" | "link" | "pdf";

/**
 * Criar vaga: "Escrever" (cola/escreve os requisitos) OU "Importar de link" (a Vera vai buscar o
 * texto da página — LinkedIn/site — e pré-preenche para a Filipa rever). A extração estruturada
 * acontece ao gravar (stub sem chave). Human-in-loop: ela vê e ajusta antes de criar.
 */
export function VagaForm({ clientes }: { clientes: ClienteOption[] }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("escrever");
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  const [url, setUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fetching, setFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function buscarLink(): Promise<void> {
    const u = url.trim();
    if (!u) {
      return;
    }
    setFetching(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/vagas/from-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const json: {
        ok: boolean;
        data?: { text: string; title: string | null };
        error?: { message?: string };
      } = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error?.message ?? "Não consegui ler esse link.");
        return;
      }
      setRequirementsText(json.data.text);
      if (json.data.title && !title) {
        setTitle(json.data.title);
      }
      setInfo("Importado. Revê e ajusta antes de criar.");
    } catch {
      setError("Erro de rede a buscar o link.");
    } finally {
      setFetching(false);
    }
  }

  async function importarPdf(): Promise<void> {
    if (!pdfFile || fetching) {
      return;
    }
    setFetching(true);
    setError(null);
    setInfo(null);
    try {
      const fd = new FormData();
      fd.append("file", pdfFile);
      const res = await fetch("/api/vagas/from-pdf", { method: "POST", body: fd });
      const json: {
        ok: boolean;
        data?: { text: string; title: string | null };
        error?: { message?: string };
      } = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error?.message ?? "Não consegui ler esse PDF.");
        return;
      }
      setRequirementsText(json.data.text);
      if (json.data.title && !title) {
        setTitle(json.data.title);
      }
      setInfo("Importado do PDF. Revê e ajusta antes de criar.");
    } catch {
      setError("Erro de rede a ler o PDF.");
    } finally {
      setFetching(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vagas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, title, requirementsText }),
      });
      if (!res.ok) {
        setError("Falha ao criar (verifica os campos).");
        return;
      }
      setTitle("");
      setRequirementsText("");
      setUrl("");
      setInfo(null);
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
        <h2 className="font-medium text-ink text-sm">Nova vaga</h2>
        <p className="mt-0.5 text-ink-3 text-xs">Cola o pedido do cliente ou importa de um link.</p>
      </header>
      <div className="flex flex-col gap-3.5 p-4">
        <Field label="Cliente">
          <Select
            name="clientId"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">—</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="inline-flex gap-1 rounded-md border border-line bg-raised p-0.5 text-sm">
          {(["escrever", "link", "pdf"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded px-3 py-1 transition-colors ${
                modo === m ? "bg-card text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              {m === "escrever"
                ? "Escrever"
                : m === "link"
                  ? "Importar de link"
                  : "Importar de PDF"}
            </button>
          ))}
        </div>

        {modo === "link" ? (
          <Field
            label="Link da vaga"
            hint="LinkedIn, site da empresa, Google… A Vera vai buscar o texto."
          >
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => void buscarLink()}
                disabled={fetching}
              >
                {fetching ? "A buscar…" : "Buscar"}
              </Button>
            </div>
          </Field>
        ) : null}

        {modo === "pdf" ? (
          <Field label="PDF da vaga" hint="O descritivo/pedido em PDF. A Vera lê e pré-preenche.">
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-line border-dashed bg-surface px-3 py-5 text-center text-ink-3 text-sm transition-colors hover:border-accent hover:text-ink">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
                {pdfFile ? (
                  <span className="text-ink">📄 {pdfFile.name}</span>
                ) : (
                  <>
                    <span className="text-lg" aria-hidden="true">
                      📎
                    </span>
                    <span>Escolhe um PDF</span>
                  </>
                )}
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void importarPdf()}
                disabled={fetching || !pdfFile}
                className="self-start"
              >
                {fetching ? "A ler…" : "Importar do PDF"}
              </Button>
            </div>
          </Field>
        ) : null}

        <Field label="Título da vaga">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="Requisitos (texto do cliente)">
          <Textarea
            rows={5}
            value={requirementsText}
            onChange={(e) => setRequirementsText(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" disabled={busy} className="mt-1 self-start">
          {busy ? "A criar…" : "Criar vaga"}
        </Button>
        {info ? <p className="text-accent-ink text-xs">{info}</p> : null}
        {error ? <p className="text-alert text-sm">{error}</p> : null}
      </div>
    </form>
  );
}
