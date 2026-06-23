"use client";

import { Button, Input } from "@rh/ui";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { QaEvidence } from "@/lib/qa/qa";

/** Mostra a blockquote de prova só quando há conteúdo (evita caixa vazia no fallback por intenção). */
function hasProof(ev: QaEvidence): boolean {
  return Boolean(ev.quote || ev.competencia || ev.source);
}

interface EntityQAProps {
  entityType: "candidate" | "client";
  entityId: string;
  entityName: string;
  /** Sugestões específicas da entidade (senão usa as default por tipo). */
  suggestions?: string[];
}

interface Msg {
  id: string;
  role: "filipa" | "vera";
  text: string;
  evidence?: QaEvidence[];
}

type Status = "idle" | "sending" | "error";

const DEFAULT_SUGGESTIONS: Record<EntityQAProps["entityType"], string[]> = {
  candidate: ["É forte em quê?", "Que lacunas tem?", "Já liderou equipa?"],
  client: ["O que valoriza?", "O que já rejeitou?", "Que critérios pede sempre?"],
};

/**
 * Q&A por entidade (Tela 8): chat factual sobre UM candidato/cliente. Reusa o estilo do assistente
 * (bolhas, typing-dots, 3 estados UX) mas é leitura pura — sem porta de confirmação nem artefactos.
 * A IRIS responde a partir dos factos da entidade, SEMPRE com a prova (citação+minuto / excerto+fonte).
 */
export function EntityQA({ entityType, entityId, entityName, suggestions }: EntityQAProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const chips = suggestions ?? DEFAULT_SUGGESTIONS[entityType];
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rolar para o fim a cada nova mensagem/estado
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, status]);

  async function send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || status === "sending") {
      return;
    }
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "filipa", text: trimmed }]);
    setInput("");
    setStatus("sending");
    try {
      const res = await fetch("/api/assistant/qa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entityType, entityId, question: trimmed }),
      });
      const json: {
        ok: boolean;
        data?: { answer: string; grounded: boolean; evidence: QaEvidence[] };
      } = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setStatus("error");
        return;
      }
      const d = json.data;
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "vera", text: d.answer, evidence: d.evidence },
      ]);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="py-1">
            <p className="text-ink-2 text-sm">
              Pergunta-me sobre {entityName} — respondo com a prova das entrevistas/reuniões.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((s) => (
                <Button key={s} variant="ghost" size="sm" onClick={() => void send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-1.5 ${m.role === "filipa" ? "items-end" : "items-start"}`}
            >
              {m.role === "vera" ? <span className="px-1 text-ink-3 text-xs">IRIS</span> : null}
              <div className={`bubble ${m.role === "filipa" ? "bubble-filipa" : "bubble-vera"}`}>
                {m.text}
              </div>
              {m.evidence?.filter(hasProof).map((ev, idx) => (
                <blockquote
                  key={`${m.id}-${ev.quote ?? ev.competencia ?? ev.source ?? idx}`}
                  className="rounded-md bg-raised p-2.5 text-ink-3 text-xs italic"
                >
                  {ev.competencia ? (
                    <span className="font-medium text-ink-2 not-italic">{ev.competencia} · </span>
                  ) : null}
                  {ev.quote ? `“${ev.quote}”` : null}
                  {ev.ts ? ` — @${ev.ts}` : ev.source ? ` — ${ev.source}` : ""}
                </blockquote>
              ))}
            </div>
          ))
        )}
        {status === "sending" ? (
          <div className="flex items-center gap-1.5 self-start rounded-full bg-raised px-3 py-2">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        ) : null}
        {status === "error" ? (
          <p className="text-alert text-sm">Falha ao perguntar à IRIS. Tenta de novo.</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Pergunta sobre ${entityName}…`}
          aria-label={`Pergunta sobre ${entityName}`}
          disabled={status === "sending"}
        />
        <Button type="submit" disabled={status === "sending" || input.trim().length === 0}>
          Perguntar
        </Button>
      </form>
    </div>
  );
}
