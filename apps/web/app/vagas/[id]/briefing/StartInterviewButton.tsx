"use client";

import { Button } from "@rh/ui";
import { useState } from "react";

type State = "idle" | "busy" | "done" | "error";

/** ▶ Iniciar entrevista: cria a entrevista (POST /api/interviews) — liga o "antes" ao "durante". */
export function StartInterviewButton() {
  const [state, setState] = useState<State>("idle");
  const [room, setRoom] = useState<string | null>(null);

  async function start(): Promise<void> {
    setState("busy");
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json: { ok: boolean; data?: { room: string } } = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setState("error");
        return;
      }
      setRoom(json.data.room);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="text-sm text-strong">
        ✅ Entrevista iniciada (sala mock: {room}). Abre o copiloto no app desktop.
      </p>
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
