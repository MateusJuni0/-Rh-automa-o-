import type { ReactNode } from "react";
import { cx } from "../cx";

export interface CardProps {
  title?: ReactNode;
  /** Ações no canto superior direito (ex.: botões). Requer `title`. */
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Cartão de superfície elevada. Cabeçalho opcional (title + actions). */
export function Card({ title, actions, className, bodyClassName, children }: CardProps) {
  return (
    <section className={cx("vera-card", className)}>
      {title !== undefined ? (
        <header className="vera-card__header">
          <h2 className="vera-card__title">{title}</h2>
          {actions !== undefined ? <div>{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx("vera-card__body", bodyClassName)}>{children}</div>
    </section>
  );
}
