"use client";

import { Button } from "@rh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Botão de logout reutilizável (Definições). POST /api/auth/logout → /login. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout(): Promise<void> {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <Button variant="ghost" onClick={logout} disabled={busy} className="self-start">
      {busy ? "A sair…" : "Sair da conta"}
    </Button>
  );
}
