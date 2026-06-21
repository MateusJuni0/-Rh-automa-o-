import type { ReactNode } from "react";

interface PageStat {
  /** Valor curto (ex.: contagem). */
  value: ReactNode;
  label: string;
}

interface PageHeaderProps {
  /** Eyebrow curto (ex.: a secção) — contexto sem pesar no título. */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Ação à direita (ex.: botão primário). */
  action?: ReactNode;
  /** Faixa de contexto à direita: números discretos (não é o template hero-metric). */
  stats?: PageStat[];
}

/** Cabeçalho de página: eyebrow + título display + descrição, com faixa de contexto e regra inferior. */
export function PageHeader({ eyebrow, title, description, action, stats }: PageHeaderProps) {
  const hasAside = Boolean(action) || (stats?.length ?? 0) > 0;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-line-subtle border-b pb-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2.5 font-medium text-accent-ink text-xs uppercase tracking-[0.18em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display font-semibold text-3xl text-ink tracking-tight md:text-[2.5rem] md:leading-[1.04]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-prose text-ink-2 text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {hasAside ? (
        <div className="flex shrink-0 flex-col items-end gap-4">
          {action ? <div>{action}</div> : null}
          {stats && stats.length > 0 ? (
            <div className="flex items-center gap-x-6 gap-y-2">
              {stats.map((s) => (
                <p key={s.label} className="flex items-baseline gap-1.5">
                  <span className="font-display font-semibold text-ink text-lg tabular-nums">
                    {s.value}
                  </span>
                  <span className="text-ink-3 text-xs uppercase tracking-wide">{s.label}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
