import { Skeleton } from "@rh/ui";

/** Estado UX de loading (route-level) — esqueleto enquanto a página resolve. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton width="160px" height="28px" />
      <Skeleton height="120px" />
      <Skeleton height="48px" />
    </div>
  );
}
