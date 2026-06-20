import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Eyebrow curto (ex.: a secção) — contexto sem pesar no título. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Ação à direita (ex.: botão primário). */
  action?: ReactNode;
}

/** Cabeçalho de página: eyebrow + título display + descrição, com regra inferior. Ritmo consistente. */
export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-line-subtle border-b pb-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 font-medium text-accent-ink text-xs uppercase tracking-[0.18em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display font-semibold text-3xl text-ink tracking-tight">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-ink-2 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
