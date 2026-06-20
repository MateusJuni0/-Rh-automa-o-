"use client";

import { Button } from "@rh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

type State = "idle" | "busy" | "done" | "error";

interface Props {
  candidateId: string;
  jobId: string;
  /** Se o candidato já está no funil, inicia como "done". */
  alreadyIn?: boolean;
}

export function AddToFunilButton({ candidateId, jobId, alreadyIn = false }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>(alreadyIn ? "done" : "idle");

  async function add(): Promise<void> {
    setState("busy");
    try {
      const res = await fetch("/api/processos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId, jobId }),
      });
      const json: { ok: boolean } = await res.json();
      if (!res.ok || !json.ok) {
        setState("error");
        return;
      }
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <span className="shrink-0 text-accent-ink text-xs">✓ no funil</span>;
  }
  return (
    <Button size="sm" onClick={add} disabled={state === "busy"}>
      {state === "busy" ? "…" : state === "error" ? "Erro — repetir" : "+ Funil"}
    </Button>
  );
}
