"use client";

import { Button, Chip, Input } from "@rh/ui";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { ConfirmationCard } from "./ConfirmationCard";
import { VeraAvatar, type VeraState } from "./VeraAvatar";

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
  files?: string[];
  actions: ActionView[];
}

type Status = "idle" | "sending" | "error";

const SUGESTOES = [
  "Compara o João e a Maria",
  "Exporta uma planilha do pipeline",
  "Envia o email ao cliente",
  "Como está a agenda hoje?",
] as const;

// Glifos do "wallpaper" temático (recrutamento) a flutuar atrás da IRIS.
const GLYPHS = ["📄", "✓", "★", "🗓", "✦", "📎"];

function downloadArtefact(a: ActionView): void {
  const body = `Artefacto gerado pela IRIS (demo)\n\nFerramenta: ${a.tool}\nResumo: ${a.summary ?? "—"}\nReferência: ${a.resultRef ?? "—"}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${a.resultRef ?? "artefacto"}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const veraState: VeraState = status === "sending" ? "thinking" : "idle";

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
    if ((!trimmed && files.length === 0) || status === "sending") {
      return;
    }
    const names = files.map((f) => f.name);
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "filipa",
        text: trimmed,
        files: names.length > 0 ? names : undefined,
        actions: [],
      },
    ]);
    setInput("");
    setFiles([]);
    setStatus("sending");
    try {
      const message =
        names.length > 0 ? `${trimmed} (anexei: ${names.join(", ")})`.trim() : trimmed;
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(threadId ? { message, threadId } : { message }),
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

  function onPickFiles(e: ChangeEvent<HTMLInputElement>): void {
    const picked = Array.from(e.target.files ?? []).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
    }));
    if (picked.length > 0) {
      setFiles((f) => [...f, ...picked]);
    }
    e.target.value = "";
  }

  function onSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void send(input);
  }

  const artefactos = messages
    .flatMap((m) => m.actions)
    .filter((a) => a.status === "done" && a.resultRef);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[19rem_1fr]">
      {/* ───────── IRIS (persona) + contexto + artefactos ───────── */}
      <aside className="flex flex-col gap-4">
        <div className="vera-stage flex flex-col items-center px-4 pt-5 pb-4">
          <div className="vera-wallpaper" aria-hidden="true">
            {GLYPHS.map((g, i) => (
              <span
                key={g}
                style={{
                  left: `${10 + i * 15}%`,
                  bottom: "-10px",
                  animationDuration: `${9 + i * 1.6}s`,
                  animationDelay: `${i * 1.3}s`,
                }}
              >
                {g}
              </span>
            ))}
          </div>
          <div className="relative">
            <VeraAvatar state={veraState} />
          </div>
          <p className="relative mt-1 font-display font-semibold text-ink text-lg tracking-tight">
            IRIS
          </p>
          <p className="relative text-ink-3 text-xs">
            {status === "sending" ? "a tratar do teu pedido…" : "a tua assistente · a postos"}
          </p>
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-card">
          <header className="border-line-subtle border-b px-4 py-2.5">
            <h2 className="font-medium text-ink text-sm">Contexto ativo</h2>
          </header>
          <p className="px-4 py-3 text-ink-3 text-xs leading-relaxed">
            Sem entidade selecionada. Abre o assistente a partir de uma vaga ou candidato para a
            IRIS já saber de quem falas.
          </p>
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-card">
          <header className="flex items-center justify-between border-line-subtle border-b px-4 py-2.5">
            <h2 className="font-medium text-ink text-sm">Artefactos</h2>
            <span className="text-ink-3 text-xs tabular-nums">{artefactos.length}</span>
          </header>
          {artefactos.length === 0 ? (
            <p className="px-4 py-3 text-ink-3 text-xs">
              O que a IRIS gerar (planilhas, emails) aparece aqui para baixares.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 p-2">
              {artefactos.map((a) => (
                <li
                  key={a.actionId}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-raised"
                >
                  <span aria-hidden="true">📄</span>
                  <span className="min-w-0 flex-1 truncate text-ink text-sm">
                    {a.summary ?? a.tool}
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadArtefact(a)}
                    className="rounded border border-line px-2 py-0.5 text-ink-2 text-xs transition-colors hover:border-accent hover:text-ink"
                  >
                    Baixar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ───────── Conversa ───────── */}
      <section className="elev-top elev relative flex min-h-[34rem] flex-col overflow-hidden rounded-card border border-line bg-card">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="m-auto max-w-sm text-center">
              <p className="font-display font-semibold text-ink text-lg tracking-tight">
                Olá, sou a IRIS.
              </p>
              <p className="mt-1 text-ink-2 text-sm">
                Comparo candidatos, redijo emails, exporto planilhas. O que grava ou envia para fora
                pede sempre a tua confirmação.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGESTOES.map((s) => (
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
                {m.text ? (
                  <div
                    className={`bubble ${m.role === "filipa" ? "bubble-filipa" : "bubble-vera"}`}
                  >
                    {m.text}
                  </div>
                ) : null}
                {m.files ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.files.map((f) => (
                      <Chip key={f} tone="muted">
                        📎 {f}
                      </Chip>
                    ))}
                  </div>
                ) : null}
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
            <div className="flex items-center gap-1.5 self-start rounded-full bg-raised px-3 py-2">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : null}
          {status === "error" ? (
            <p className="text-alert text-sm">Falha ao falar com a IRIS. Tenta de novo.</p>
          ) : null}
        </div>

        <div className="border-line-subtle border-t p-3">
          {files.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiles((arr) => arr.filter((x) => x.id !== f.id))}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2.5 py-1 text-ink-2 text-xs hover:border-alert hover:text-ink"
                >
                  📎 {f.name} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              tabIndex={-1}
              className="sr-only"
              onChange={onPickFiles}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Anexar ficheiro"
              className="flex size-9 flex-none items-center justify-center rounded-md border border-line text-ink-2 transition-colors hover:border-accent hover:text-ink"
            >
              📎
            </button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreve à IRIS…"
              aria-label="Mensagem para a IRIS"
              disabled={status === "sending"}
            />
            <Button
              type="submit"
              disabled={status === "sending" || (input.trim().length === 0 && files.length === 0)}
            >
              Enviar
            </Button>
          </form>
        </div>
      </section>
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
