"use client";

import { useState } from "react";
import { initials } from "./EntityList";

/**
 * Foto do candidato — avatar determinístico (pravatar, pela id) com fallback para monograma se a
 * imagem falhar. Para a demo parecer real; com fotos verdadeiras um dia, troca-se a fonte.
 */
export function CandidatoAvatar({
  id,
  name,
  size = 40,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      // biome-ignore lint/performance/noImgElement: avatar externo (demo), sem otimização Next.
      <img
        src={`https://i.pravatar.cc/${size * 2}?u=${encodeURIComponent(id)}`}
        alt=""
        aria-hidden="true"
        onError={() => setFailed(true)}
        className="flex-none rounded-full border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-full bg-accent-bg font-display font-semibold text-accent-ink uppercase"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}
