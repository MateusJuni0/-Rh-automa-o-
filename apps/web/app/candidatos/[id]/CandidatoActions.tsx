"use client";

import { Button } from "@rh/ui";
import { useState } from "react";

/**
 * Ações do dossier do candidato. "Baixar CV" funciona já (descarrega o texto guardado). "Enviar ao
 * cliente" passa pela porta de confirmação (mock até ligar o email Resend) — nunca envia em silêncio.
 */
export function CandidatoActions({ name, cvText }: { name: string; cvText: string | null }) {
  const [enviado, setEnviado] = useState(false);

  function baixarCv(): void {
    if (!cvText) {
      return;
    }
    const url = URL.createObjectURL(new Blob([cvText], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `CV - ${name}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={baixarCv} disabled={!cvText}>
        ⬇ Baixar CV
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEnviado(true)} disabled={enviado}>
        {enviado ? "✓ Na fila para envio" : "✉ Enviar ao cliente"}
      </Button>
      {enviado ? (
        <span className="self-center text-ink-3 text-xs">
          Envio real liga quando deres a chave de email.
        </span>
      ) : null}
    </div>
  );
}
