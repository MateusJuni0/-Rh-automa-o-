import type { ReactNode } from "react";
import { cx } from "../cx";

export type ChipTone = "default" | "accent" | "muted" | "strong" | "shallow" | "alert";

export interface ChipProps {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}

/** Etiqueta compacta (ex.: skill coberta/faltante na triagem). */
export function Chip({ tone = "default", className, children }: ChipProps) {
  return (
    <span className={cx("vera-chip", tone !== "default" && `vera-chip--${tone}`, className)}>
      {children}
    </span>
  );
}
