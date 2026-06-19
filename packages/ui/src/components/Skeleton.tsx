import { cx } from "../cx";

export interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

/** Bloco "a carregar" — estado UX de loading. Decorativo (aria-hidden). */
export function Skeleton({ width = "100%", height = "16px", className }: SkeletonProps) {
  return (
    <span className={cx("vera-skeleton", className)} style={{ width, height }} aria-hidden="true" />
  );
}
