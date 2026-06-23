"use client";

import { Button, Card, Chip, Input } from "@rh/ui";
import { useState } from "react";
import type { PendingIntake } from "@/lib/intake";

const SOURCE_LABEL: Record<string, string> = {
  telegram: "Telegram",
  web_upload: "Upload",
  email: "Email",
};
const INTENCAO_LABEL: Record<string, string> = {
  novo_candidato: "Novo candidato",
  nova_vaga: "Nova vaga",
  feedback_cliente: "Feedback do cliente",
  pergunta: "Pergunta",
};

interface ResultLine {
  key: string;
  text: string;
  ok: boolean;
}

/**
 * Caixa de entrada do Intake (porta de segurança, INTAKE Parte A): a IRIS classifica cada mensagem;
 * a Filipa REVÊ o que ela entendeu (alvo + intenção + excerto) e CONFIRMA antes de gravar. Sem confirmar,
 * nada durável é criado. 3 estados UX (vazio / a-processar / erro).
 */
export function IntakeInbox({ initialPending }: { initialPending: PendingIntake[] }) {
  const [pending, setPending] = useState<PendingIntake[]>(initialPending);
  const [text, setText] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultLine[]>([]);

  async function receber(): Promise<void> {
    const t = text.trim();
    if (!t || status === "busy") {
      return;
    }
    setStatus("busy");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "web_upload", text: t }),
      });
      const json: {
        ok: boolean;
        data?: { messageId: string; envelope: { alvo: string; intencao: string } };
      } = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setStatus("error");
        return;
      }
      const d = json.data;
      setPending((p) => [
        {
          id: d.messageId,
          source: "web_upload",
          alvo: d.envelope.alvo,
          intencao: d.envelope.intencao,
          preview: t.slice(0, 280),
        },
        ...p,
      ]);
      setText("");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function confirmar(m: PendingIntake): Promise<void> {
    setBusyId(m.id);
    try {
      const res = await fetch("/api/intake/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: m.id, name: names[m.id]?.trim() || undefined }),
      });
      const json: {
        ok: boolean;
        data?: { created: boolean; entityType?: string; reason?: string };
      } = await res.json();
      const success = json.ok && Boolean(json.data);
      let line: string;
      if (success && json.data) {
        line = json.data.created
          ? `✓ ${json.data.entityType ?? "entidade"} criado`
          : `Confirmado — ${json.data.reason ?? "sem criar entidade"}`;
      } else {
        line = "Falhou ao confirmar";
      }
      setResults((x) => [{ key: `${m.id}-${x.length}`, text: line, ok: success }, ...x]);
      if (success) {
        setPending((p) => p.filter((x) => x.id !== m.id));
      }
    } catch {
      setResults((x) => [
        { key: `${m.id}-${x.length}`, text: "Falhou ao confirmar", ok: false },
        ...x,
      ]);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        {pending.length === 0 ? (
          <Card title="Sem mensagens por confirmar">
            <p className="text-ink-3 text-sm">
              Tudo tratado. Encaminha uma mensagem ao lado para a IRIS classificar.
            </p>
          </Card>
        ) : (
          pending.map((m) => (
            <Card
              key={m.id}
              title={`A IRIS entendeu: ${INTENCAO_LABEL[m.intencao ?? ""] ?? m.intencao ?? "—"}`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Chip tone="muted">{SOURCE_LABEL[m.source] ?? m.source}</Chip>
                  {m.alvo ? <Chip tone="accent">{m.alvo}</Chip> : null}
                </div>
                <blockquote className="rounded-md bg-raised p-3 text-ink-2 text-sm italic">
                  {m.preview}
                </blockquote>
                {m.alvo === "candidato" ? (
                  <Input
                    value={names[m.id] ?? ""}
                    onChange={(e) => setNames((n) => ({ ...n, [m.id]: e.target.value }))}
                    placeholder="Nome do candidato (corrige se a IRIS não apanhou)"
                    aria-label="Nome do candidato"
                  />
                ) : null}
                <div>
                  <Button onClick={() => void confirmar(m)} disabled={busyId === m.id}>
                    Confirmar e gravar
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card title="Encaminhar uma mensagem">
          <div className="flex flex-col gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Cola o que recebeste (CV, pedido de vaga, feedback do cliente)…"
              aria-label="Mensagem a encaminhar"
              className="w-full rounded-md border border-line bg-raised p-2.5 text-ink text-sm"
            />
            <Button
              onClick={() => void receber()}
              disabled={status === "busy" || text.trim().length === 0}
            >
              Receber
            </Button>
            {status === "error" ? (
              <p className="text-alert text-sm">Falhou a classificar. Tenta de novo.</p>
            ) : null}
          </div>
        </Card>
        {results.length > 0 ? (
          <Card title="Resultado">
            <ul className="flex flex-col gap-1.5">
              {results.map((r) => (
                <li key={r.key} className={`text-sm ${r.ok ? "text-ink-2" : "text-alert"}`}>
                  {r.text}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
