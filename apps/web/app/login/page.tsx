"use client";

import { Button, Card, Field, Input } from "@rh/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type State = "idle" | "busy" | "error";

/** "Câmara" desenhada + liveness "flash" (animação CSS). MOCK — sem webcam/getUserMedia real. */
function FacePanel({ scanning }: { scanning: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative grid size-40 place-items-center rounded-card border border-line bg-raised">
        <svg viewBox="0 0 64 64" className="size-20 text-ink-3" aria-hidden="true">
          <circle cx="32" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M14 54c2-10 9-15 18-15s16 5 18 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span
          className={`pointer-events-none absolute inset-2 rounded-card border-2 ${
            scanning ? "animate-pulse border-accent" : "border-transparent"
          }`}
          aria-hidden="true"
        />
      </div>
      <p className="text-ink-3 text-xs">📷 Reconhecimento facial (demo)</p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("filipa@iris.tech");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-semibold text-ink text-lg">Vera</span>
          </div>
          <p className="text-ink-3 text-sm">Copiloto de recrutamento · IRIS</p>
        </div>

        <FacePanel scanning={state === "busy"} />

        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Palavra-passe">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {state === "error" ? (
            <p className="text-alert text-sm">Credenciais inválidas. Tenta de novo.</p>
          ) : null}
          <Button type="submit" disabled={state === "busy"} className="mt-1">
            {state === "busy" ? "A entrar…" : "Entrar"}
          </Button>
          <p className="text-center text-ink-3 text-xs">
            Demo: filipa@iris.tech (qualquer palavra-passe)
          </p>
        </form>
      </Card>
    </main>
  );
}
