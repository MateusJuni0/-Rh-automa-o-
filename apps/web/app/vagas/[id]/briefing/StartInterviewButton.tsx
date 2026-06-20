"use client";

import { Button } from "@rh/ui";
import Link from "next/link";
import { useState } from "react";

type State = "idle" | "busy" | "done" | "error";

interface Props {
  processId?: string;
}

/** ▶ Iniciar entrevista: cria a entrevista (POST /api/interviews) — liga o "antes" ao "durante". */
export function StartInterviewButton({ processId }: Props) {
  const [state, setState] = useState<State>("idle");
  const [room, setRoom] = useState<string | null>(null);
  const [interviewId, setInterviewId] = useState<string | null>(null);

  async function start(): Promise<void> {
    setState("busy");
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(processId ? { processId } : {}),
      });
      const json: { ok: boolean; data?: { interviewId: string; room: string } } = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setState("error");
        return;
      }
      setRoom(json.data.room);
      setInterviewId(json.data.interviewId);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-strong">
          ✅ Entrevista iniciada (sala mock: {room}). Abre o copiloto no app desktop.
        </p>
        {interviewId ? (
          <Link
            href={`/interviews/${interviewId}/parecer`}
            className="text-accent-ink text-sm hover:underline"
          >
            Ver parecer (no fim) →
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={start} disabled={state === "busy"} className="self-start">
        {state === "busy" ? "A iniciar…" : "▶ Iniciar entrevista"}
      </Button>
      {state === "error" ? (
        <p className="text-alert text-sm">Falha ao iniciar a entrevista. Tenta de novo.</p>
      ) : null}
    </div>
  );
}
