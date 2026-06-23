import type { ReactNode } from "react";
import { cx } from "../cx";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** CTA opcional (ex.: botão "Criar primeiro cliente"). */
  action?: ReactNode;
  className?: string;
}

/** Estado UX vazio (zero dados) com CTA opcional. */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx("vera-empty", className)}>
      <p className="vera-empty__title">{title}</p>
      {description !== undefined ? <p className="vera-empty__desc">{description}</p> : null}
      {action !== undefined ? <div>{action}</div> : null}
    </div>
  );
}
