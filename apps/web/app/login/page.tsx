"use client";

import { Button, Card, Field, Input } from "@rh/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type State = "idle" | "busy" | "error";

/** Login da Vera — email + palavra-passe (Supabase Auth real quando ligado; shim de sessão em dev). */
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
        <div className="flex flex-col items-center gap-1 pb-5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-semibold text-ink text-lg">Vera</span>
          </div>
          <p className="text-ink-3 text-sm">Copiloto de recrutamento · IRIS</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
        </form>
      </Card>
    </main>
  );
}
