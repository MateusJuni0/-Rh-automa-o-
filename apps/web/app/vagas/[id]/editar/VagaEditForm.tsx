"use client";

import { Button, Field, Input, Textarea } from "@rh/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useState } from "react";
import type { JobDetails } from "@/lib/vaga-details";

const lines = (s: string): string[] =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const csv = (s: string): string[] =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const numOrNull = (s: string): number | null => {
  const n = Number(s.replace(/[^\d]/g, ""));
  return s.trim() !== "" && !Number.isNaN(n) ? n : null;
};

/** A Filipa completa a ficha da vaga. Guarda via PATCH /api/vagas/:id e volta ao detalhe. */
export function VagaEditForm({ vagaId, details }: { vagaId: string; details: JobDetails }) {
  const router = useRouter();
  const [f, setF] = useState({
    modeloTrabalho: details.modeloTrabalho ?? "",
    localizacao: details.localizacao ?? "",
    horario: details.horario ?? "",
    salarioMin: details.salarioMin?.toString() ?? "",
    salarioMax: details.salarioMax?.toString() ?? "",
    moeda: details.moeda ?? "EUR",
    contrato: details.contrato ?? "",
    dataInicio: details.dataInicio ?? "",
    idiomas: details.idiomas.join(", "),
    visaRelocation: details.visaRelocation ?? "",
    equipa: details.equipa ?? "",
    beneficios: details.beneficios.join("\n"),
    processoEntrevista: details.processoEntrevista.join("\n"),
    responsabilidades: details.responsabilidades.join("\n"),
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
    const details_: JobDetails = {
      modeloTrabalho: f.modeloTrabalho.trim() || null,
      localizacao: f.localizacao.trim() || null,
      horario: f.horario.trim() || null,
      salarioMin: numOrNull(f.salarioMin),
      salarioMax: numOrNull(f.salarioMax),
      moeda: f.moeda.trim() || null,
      contrato: f.contrato.trim() || null,
      idiomas: csv(f.idiomas),
      visaRelocation: f.visaRelocation.trim() || null,
      dataInicio: f.dataInicio.trim() || null,
      beneficios: lines(f.beneficios),
      processoEntrevista: lines(f.processoEntrevista),
      responsabilidades: lines(f.responsabilidades),
      equipa: f.equipa.trim() || null,
    };
    try {
      const res = await fetch(`/api/vagas/${vagaId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ details: details_ }),
      });
      if (!res.ok) {
        setError("Não consegui guardar (verifica os campos).");
        return;
      }
      router.push(`/vagas/${vagaId}`);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Modelo de trabalho">
          <Input
            value={f.modeloTrabalho}
            onChange={set("modeloTrabalho")}
            placeholder="Remoto / Híbrido / Presencial"
          />
        </Field>
        <Field label="Local">
          <Input
            value={f.localizacao}
            onChange={set("localizacao")}
            placeholder="Lisboa, Portugal"
          />
        </Field>
        <Field label="Salário mín. (bruto/ano)">
          <Input value={f.salarioMin} onChange={set("salarioMin")} placeholder="48000" />
        </Field>
        <Field label="Salário máx.">
          <Input value={f.salarioMax} onChange={set("salarioMax")} placeholder="72000" />
        </Field>
        <Field label="Moeda">
          <Input value={f.moeda} onChange={set("moeda")} />
        </Field>
        <Field label="Horário">
          <Input value={f.horario} onChange={set("horario")} placeholder="Flexível, core 10h-16h" />
        </Field>
        <Field label="Contrato">
          <Input value={f.contrato} onChange={set("contrato")} placeholder="Efetivo (sem termo)" />
        </Field>
        <Field label="Início">
          <Input value={f.dataInicio} onChange={set("dataInicio")} placeholder="ASAP" />
        </Field>
        <Field label="Idiomas" hint="Separados por vírgulas.">
          <Input value={f.idiomas} onChange={set("idiomas")} placeholder="Inglês, Português" />
        </Field>
        <Field label="Visto / relocation">
          <Input value={f.visaRelocation} onChange={set("visaRelocation")} />
        </Field>
      </div>
      <Field label="Equipa">
        <Input
          value={f.equipa}
          onChange={set("equipa")}
          placeholder="Squad de 6; reporta ao Eng. Manager"
        />
      </Field>
      <Field label="Responsabilidades" hint="Uma por linha.">
        <Textarea rows={4} value={f.responsabilidades} onChange={set("responsabilidades")} />
      </Field>
      <Field label="Processo de entrevista" hint="Uma etapa por linha.">
        <Textarea rows={4} value={f.processoEntrevista} onChange={set("processoEntrevista")} />
      </Field>
      <Field label="Benefícios" hint="Um por linha.">
        <Textarea rows={4} value={f.beneficios} onChange={set("beneficios")} />
      </Field>
      <div className="mt-1 flex items-center gap-4">
        <Button type="submit" disabled={busy}>
          {busy ? "A guardar…" : "Guardar ficha"}
        </Button>
        <Link
          href={`/vagas/${vagaId}`}
          className="text-ink-2 text-sm transition-colors hover:text-ink"
        >
          Cancelar
        </Link>
      </div>
      {error ? <p className="text-alert text-sm">{error}</p> : null}
    </form>
  );
}
