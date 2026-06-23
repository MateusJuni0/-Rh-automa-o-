"use client";

import { type ReactNode, useState } from "react";

/** Imagem de logo do cliente com fallback: se a imagem externa falhar, mostra o monograma. */
export function ClientLogoImg({
  src,
  size,
  children,
}: {
  src: string;
  size: number;
  children: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <>{children}</>;
  }
  return (
    // biome-ignore lint/performance/noImgElement: logo externo do cliente (sem otimização Next).
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="flex-none rounded-[10px] border border-line bg-raised object-cover"
      style={{ width: size, height: size }}
    />
  );
}
