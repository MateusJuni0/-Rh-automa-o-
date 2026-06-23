"use client";

import { Button, Card, Chip, Input } from "@rh/ui";
import Link from "next/link";
import { type KeyboardEvent, useState } from "react";
import type { MemoryFact } from "@/lib/assistant/memory";
import { ONBOARDING_QUESTIONS } from "@/lib/onboarding";

const KIND_LABEL: Record<string, string> = {
  style: "Estilo",
  preference: "Preferência",
  pattern: "Padrão",
  template: "Modelo",
};

type Status = "idle" | "saving" | "error";

/**
 * Fluxo conversacional de onboarding: uma pergunta de cada vez (saltável), cada resposta vira um
 * facto durável (`recruiter_memory_fact`) com eco "Anotei que…", e um painel mostra o que já guardou
 * (com remover = a forma simples de editar). Não é formulário rígido (ASSISTENTE-PESSOAL §4.1).
 */
export function OnboardingFlow({ initialFacts }: { initialFacts: MemoryFact[] }) {
  const [facts, setFacts] = useState<MemoryFact[]>(initialFacts);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const total = ONBOARDING_QUESTIONS.length;
  const question = ONBOARDING_QUESTIONS[step];
  const done = step >= total;

  async function save(): Promise<void> {
    const text = answer.trim();
    if (!text || !question || status === "saving") {
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, kind: question.kind, sourceRef: question.id }),
      });
      const json: { ok: boolean; data?: { fact: MemoryFact } } = await res.json();
      if (!res.ok || !json.ok || !json.data) {
        setStatus("error");
        return;
      }
      const fact = json.data.fact;
      setFacts((f) => [fact, ...f]);
      setAnswer("");
      setStep((s) => s + 1);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function skip(): void {
    setAnswer("");
    setStep((s) => s + 1);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  }

  async function remove(id: string): Promise<void> {
    const res = await fetch("/api/onboarding", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setFacts((f) => f.filter((x) => x.id !== id));
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <Card title={done ? "Já te conheço melhor" : `Vamos conhecer-te · ${step + 1} de ${total}`}>
        {done ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-ink-2 text-sm leading-relaxed">
              Obrigada. Vou usar isto em tudo o que faço por ti — no tom dos pareceres, no que
              sugiro, no que te poupo. Podes voltar aqui sempre que quiseres afinar.
            </p>
            <Link
              href="/"
              className="rounded-md bg-accent px-4 py-2 font-medium text-on-accent text-sm transition-opacity hover:opacity-90"
            >
              Ir para o painel →
            </Link>
          </div>
        ) : question ? (
          <div className="flex flex-col gap-3">
            <p className="text-base text-ink">{question.prompt}</p>
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={onKey}
              placeholder={question.placeholder}
              aria-label={question.prompt}
              disabled={status === "saving"}
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={() => void save()}
                disabled={status === "saving" || answer.trim().length === 0}
              >
                Guardar
              </Button>
              <Button variant="ghost" onClick={skip} disabled={status === "saving"}>
                Saltar
              </Button>
            </div>
            {status === "error" ? (
              <p className="text-alert text-sm">Não consegui guardar. Tenta de novo.</p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card title="O que a IRIS já sabe de ti">
        {facts.length === 0 ? (
          <p className="text-ink-3 text-sm">
            Ainda nada. Responde às perguntas e vai aparecendo aqui.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {facts.map((f) => (
              <li
                key={f.id}
                className="flex items-start justify-between gap-2 border-line-subtle border-t pt-2.5 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0">
                  <Chip tone="muted">{KIND_LABEL[f.kind] ?? f.kind}</Chip>
                  <p className="mt-1 text-ink-2 text-sm leading-relaxed">Anotei que {f.factText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(f.id)}
                  className="flex-none text-ink-3 text-xs transition-colors hover:text-alert"
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
