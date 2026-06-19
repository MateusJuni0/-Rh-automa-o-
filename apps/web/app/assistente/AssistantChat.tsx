"use client";

import { Button, Card, Chip, EmptyState, Input } from "@rh/ui";
import { type FormEvent, useState } from "react";
import { ConfirmationCard } from "./ConfirmationCard";

interface ActionView {
  actionId: string;
  tool: string;
  efeito: string;
  status: string;
  summary?: string;
  resultRef?: string;
}

interface Msg {
  id: string;
  role: "filipa" | "vera";
  text: string;
  actions: ActionView[];
}

type Status = "idle" | "sending" | "error";

const SUGESTOES = [
  "Compara o João e a Maria",
  "Exporta uma planilha do pipeline",
  "Envia o email ao cliente",
  "Como está a agenda hoje?",
] as const;

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  function patchAction(actionId: string, patch: Partial<ActionView>): void {
    setMessages((msgs) =>
      msgs.map((msg) => ({
        ...msg,
        actions: msg.actions.map((a) => (a.actionId === actionId ? { ...a, ...patch } : a)),
      })),
    );
  }

  async function send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || status === "sending") {
      return;
    }
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "filipa", text: trimmed, actions: [] },
    ]);
    setInput("");
    setStatus("sending");
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(threadId ? { message: trimmed, threadId } : { message: trimmed }),
      });
      const json: {
        ok: boolean;
        data?: { threadId: string; reply: string; actions: ActionView[] };
      } = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setStatus("error");
        return;
      }
      const data = json.data;
      setThreadId(data.threadId);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "vera", text: data.reply, actions: data.actions },
      ]);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function confirm(actionId: string): Promise<void> {
    setBusyAction(actionId);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmActionId: actionId }),
      });
      const json: { ok: boolean; data?: { action: ActionView } } = await res.json();
      patchAction(actionId, json.ok && json.data ? json.data.action : { status: "failed" });
    } catch {
      patchAction(actionId, { status: "failed" });
    } finally {
      setBusyAction(null);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void send(input);
  }

  const artefactos = messages
    .flatMap((m) => m.actions)
    .filter((a) => a.status === "done" && a.resultRef);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <Card title="Assistente" className="min-h-[28rem]">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <EmptyState
              title="Pergunta-me o que precisares."
              description="Comparo candidatos, redijo emails, exporto planilhas. Ações que gravam ou enviam pedem a tua confirmação."
              action={
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((s) => (
                    <Button key={s} variant="ghost" size="sm" onClick={() => void send(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              }
            />
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-2">
                <div className={m.role === "filipa" ? "self-end text-right" : "self-start"}>
                  <p className="text-ink-3 text-xs">{m.role === "filipa" ? "Tu" : "Vera"}</p>
                  <p className="text-sm text-strong">{m.text}</p>
                </div>
                {m.actions.map((a) => (
                  <ActionRow
                    key={a.actionId}
                    action={a}
                    busy={busyAction === a.actionId}
                    onConfirm={() => void confirm(a.actionId)}
                    onCancel={() => patchAction(a.actionId, { status: "cancelled" })}
                  />
                ))}
              </div>
            ))
          )}
          {status === "sending" ? (
            <p className="text-ink-3 text-sm">A Vera está a pensar…</p>
          ) : null}
          {status === "error" ? (
            <p className="text-alert text-sm">Falha ao falar com a Vera. Tenta de novo.</p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreve uma mensagem…"
            aria-label="Mensagem para a Vera"
            disabled={status === "sending"}
          />
          <Button type="submit" disabled={status === "sending" || input.trim().length === 0}>
            Enviar
          </Button>
        </form>
      </Card>

      <aside className="flex flex-col gap-4">
        <Card title="Contexto ativo">
          <p className="text-ink-3 text-sm">
            Sem entidade selecionada. Abre o assistente a partir de uma vaga ou candidato para dar
            contexto.
          </p>
        </Card>
        <Card title="Artefactos">
          {artefactos.length === 0 ? (
            <p className="text-ink-3 text-sm">Ainda sem artefactos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {artefactos.map((a) => (
                <li key={a.actionId} className="text-sm text-strong">
                  📄 {a.summary ?? a.tool}
                  <span className="text-ink-3"> · {a.resultRef}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}

interface ActionRowProps {
  action: ActionView;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Render de uma ação consoante o estado da porta (pending → cartão; done/failed/cancelled → chip). */
function ActionRow({ action, busy, onConfirm, onCancel }: ActionRowProps) {
  if (action.status === "pending_confirm") {
    return (
      <ConfirmationCard
        tool={action.tool}
        efeito={action.efeito}
        busy={busy}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }
  if (action.status === "done") {
    return (
      <Chip tone="accent">
        ✓ {action.summary ?? action.tool}
        {action.resultRef ? ` · ${action.resultRef}` : ""}
      </Chip>
    );
  }
  if (action.status === "cancelled") {
    return <Chip tone="muted">Ação cancelada</Chip>;
  }
  return <Chip tone="alert">✗ {action.tool} falhou</Chip>;
}
