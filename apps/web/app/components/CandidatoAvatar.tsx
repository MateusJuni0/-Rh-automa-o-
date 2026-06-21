"use client";

import { useState } from "react";
import { initials } from "./EntityList";

/**
 * Retrato determinístico do candidato (randomuser.me — CDN rápido, fotos reais) com fallback para
 * monograma se a imagem falhar. Carrega lazy/async para nunca bloquear a interação. Demo: fotos
 * geradas; com fotos reais um dia, troca-se a fonte.
 */
function portraitFor(id: string, name: string): string {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const gender = /a$|ês$/.test(first) ? "women" : "men";
  let h = 0;
  for (const ch of id) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return `https://randomuser.me/api/portraits/${gender}/${h % 100}.jpg`;
}

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
      // biome-ignore lint/performance/noImgElement: retrato externo (demo), sem otimização Next.
      <img
        src={portraitFor(id, name)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
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
