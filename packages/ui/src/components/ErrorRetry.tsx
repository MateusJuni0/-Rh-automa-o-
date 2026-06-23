import type { ReactNode } from "react";
import { cx } from "../cx";
import { Button } from "./Button";

export interface ErrorRetryProps {
  message?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

/** Estado UX de erro com retry. Nunca deixa ecrã branco. */
export function ErrorRetry({
  message = "Algo correu mal.",
  retryLabel = "Tentar de novo",
  onRetry,
  className,
}: ErrorRetryProps) {
  return (
    <div className={cx("vera-error", className)} role="alert">
      <p className="vera-error__msg">{message}</p>
      {onRetry ? (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
