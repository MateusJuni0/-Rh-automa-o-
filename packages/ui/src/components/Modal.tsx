import { type ReactNode, useId } from "react";

export interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
}

/** Modal presentational: nada renderiza quando fechado. O pai detém `open`. */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const titleId = useId();
  if (!open) {
    return null;
  }
  return (
    <div className="vera-modal__overlay">
      <div
        className="vera-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title !== undefined ? titleId : undefined}
      >
        {title !== undefined || onClose ? (
          <header className="vera-modal__header">
            <h2 id={titleId} className="vera-modal__title">
              {title}
            </h2>
            {onClose ? (
              <button
                type="button"
                className="vera-modal__close"
                aria-label="Fechar"
                onClick={onClose}
              >
                ×
              </button>
            ) : null}
          </header>
        ) : null}
        <div className="vera-modal__body">{children}</div>
      </div>
    </div>
  );
}
