import type { RequisitoStatus } from "@rh/core";
import type { ReactNode } from "react";
import { cx } from "../cx";

/** Semáforo do frame de avaliação (§9). Os 4 estados canónicos vivem em @rh/core. */
type Tone = "strong" | "shallow" | "alert" | "untouched";

interface StatusMeta {
  tone: Tone;
  icon: string;
  /** Descrição para leitores de ecrã. */
  aria: string;
}

const STATUS_META: Record<RequisitoStatus, StatusMeta> = {
  "coberto-com-prova": { tone: "strong", icon: "✅", aria: "coberto com prova" },
  raso: { tone: "shallow", icon: "🟡", aria: "raso" },
  contradito: { tone: "alert", icon: "⚠", aria: "contradito" },
  "não-tocado": { tone: "untouched", icon: "⬜", aria: "não tocado" },
};

export interface StateLightProps {
  status: RequisitoStatus;
  /** Texto visível (ex.: "React"). O estado canónico é SEMPRE exposto a leitores de ecrã via sr-only. */
  label?: ReactNode;
  /** Mostra o emoji do estado antes do ponto. Default: false (só ponto colorido). */
  showIcon?: boolean;
  className?: string;
}

export function StateLight({ status, label, showIcon = false, className }: StateLightProps) {
  const meta = STATUS_META[status];
  return (
    <span className={cx("vera-state", `vera-state--${meta.tone}`, className)}>
      {showIcon ? <span aria-hidden="true">{meta.icon}</span> : null}
      <span className="vera-state__dot" aria-hidden="true" />
      {label !== undefined ? <span>{label}</span> : null}
      <span className="sr-only">{meta.aria}</span>
    </span>
  );
}
