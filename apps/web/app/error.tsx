"use client";

import { ErrorRetry } from "@rh/ui";

/** Estado UX de erro (route-level error boundary) — nunca deixa ecrã branco. */
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRetry message="Não foi possível carregar esta página." onRetry={reset} />;
}
