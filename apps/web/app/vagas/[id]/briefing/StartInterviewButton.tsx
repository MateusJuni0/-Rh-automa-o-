"use client";

import { Button } from "@rh/ui";
import Link from "next/link";
import { useState } from "react";

type State = "idle" | "busy" | "done" | "error";

interface Props {
  processId?: string;
}

interface InterviewResult {
  interviewId: string;
  room: string;
  token: string;
}

/** URL do servidor WS — pode ser overrideada por NEXT_PUBLIC_WS_URL em produção. */
const WS_URL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_WS_URL
    ? process.env.NEXT_PUBLIC_WS_URL
    : "ws://localhost:18792";

/** ▶ Iniciar entrevista: cria a entrevista (POST /api/interviews) — liga o "antes" ao "durante". */
export function StartInterviewButton({ processId }: Props) {
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<InterviewResult | null>(null);

  async function start(): Promise<void> {
    setState("busy");
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(processId ? { processId } : {}),
      });
      const json: { ok: boolean; data?: InterviewResult } = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setState("error");
        return;
      }
      setResult(json.data);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done" && result) {
    const deepLink = `vera://interview/${result.interviewId}?token=${encodeURIComponent(result.token)}&wsUrl=${encodeURIComponent(WS_URL)}`;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-strong">
          ✅ Entrevista criada! Clica em "Abrir copiloto" para iniciar a IRIS.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href={deepLink}
          className="self-start rounded bg-accent-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Abrir copiloto IRIS →
        </a>
        <Link
          href={`/interviews/${result.interviewId}/parecer`}
          className="text-accent-ink text-sm hover:underline"
        >
          Ver parecer (após a entrevista) →
        </Link>
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
