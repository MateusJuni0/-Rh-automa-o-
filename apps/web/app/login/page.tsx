"use client";

import { Button, Card, Field, Input } from "@rh/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { averageColor, rgbCss } from "@/lib/face-capture";

type State = "idle" | "busy" | "error";
type RGB = [number, number, number];

/** Espera `ms` (entre o pisca da cor e a captura do frame). */
function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Captura REAL de flash liveness: pede a câmara (getUserMedia), pisca cada cor do challenge num
 * overlay full-screen, captura um frame por cor (via <canvas>) e mede a cor dominante. Devolve os
 * frames (base64 + cor medida) prontos para `/api/auth/face`. Sem câmara/permissão → lança (a UI
 * cai no fallback de senha). Requer HTTPS ou localhost (getUserMedia) + uma webcam.
 */
async function captureFlashFrames(
  sequence: RGB[],
  paintFlash: (color: RGB | null) => void,
): Promise<{ imageB64: string; measuredColor: RGB }[]> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  await video.play();
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas indisponível");
  }
  try {
    const frames: { imageB64: string; measuredColor: RGB }[] = [];
    for (const color of sequence) {
      paintFlash(color);
      await wait(280); // deixa o flash refletir na pele antes de capturar
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const measuredColor = averageColor(data);
      const imageB64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1] ?? "";
      frames.push({ imageB64, measuredColor });
    }
    return frames;
  } finally {
    paintFlash(null);
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
}

/** "Câmara" desenhada + liveness "flash". Captura real quando há webcam; senão fallback de senha. */
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
      <p className="text-ink-3 text-xs">📷 Reconhecimento facial (flash liveness)</p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("filipa@iris.tech");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>("idle");
  const [faceState, setFaceState] = useState<State>("idle");
  const [flash, setFlash] = useState<RGB | null>(null);
  const flashRef = useRef<RGB | null>(null);

  function paintFlash(color: RGB | null): void {
    flashRef.current = color;
    setFlash(color);
  }

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

  /** Login por rosto: pede challenge → captura flash → verifica no serviço. Falha → fallback senha. */
  async function onFaceLogin(): Promise<void> {
    setFaceState("busy");
    try {
      const chRes = await fetch("/api/auth/face/challenge", { method: "POST" });
      if (!chRes.ok) {
        setFaceState("error");
        return;
      }
      const challenge = (await chRes.json()) as { data?: { sequence: RGB[]; token: string } };
      const data = challenge.data;
      if (!data) {
        setFaceState("error");
        return;
      }
      const frames = await captureFlashFrames(data.sequence, paintFlash);
      const res = await fetch("/api/auth/face", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token: data.token, frames }),
      });
      if (!res.ok) {
        setFaceState("error");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      // Sem câmara/permissão/serviço → fallback gracioso (a Filipa usa a senha).
      setFaceState("error");
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      {flash ? (
        <div
          className="fixed inset-0 z-50 transition-colors"
          style={{ backgroundColor: rgbCss(flash) }}
          aria-hidden="true"
        />
      ) : null}
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-semibold text-ink text-lg">Vera</span>
          </div>
          <p className="text-ink-3 text-sm">Copiloto de recrutamento · IRIS</p>
        </div>

        <FacePanel scanning={state === "busy" || faceState === "busy"} />
        <Button
          type="button"
          onClick={onFaceLogin}
          disabled={faceState === "busy"}
          className="mt-3 w-full"
        >
          {faceState === "busy" ? "A reconhecer…" : "Entrar com rosto"}
        </Button>
        {faceState === "error" ? (
          <p className="mt-1 text-center text-ink-3 text-xs">
            Biometria indisponível — usa a palavra-passe.
          </p>
        ) : null}

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
