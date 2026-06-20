import { initials } from "./EntityList";

/**
 * Logo do cliente — identidade visual. Hoje: monograma com cor determinística do nome (fictício).
 * FUTURO: quando `logoUrl` vier do site do cliente, mostra a imagem real. O mesmo cliente → sempre a
 * mesma cor (reconhecimento rápido pela recrutadora). Cores SÓLIDAS (flat — sem gradiente/sombra).
 */
const DEFAULT_COLOR = { bg: "#495057", fg: "#ffffff" };
const PALETTE: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: "#3b5bdb", fg: "#ffffff" },
  { bg: "#2f9e44", fg: "#ffffff" },
  { bg: "#e8590c", fg: "#ffffff" },
  { bg: "#1098ad", fg: "#ffffff" },
  { bg: "#9c36b5", fg: "#ffffff" },
  { bg: "#c2255c", fg: "#ffffff" },
  { bg: "#f08c00", fg: "#19140c" },
  { bg: "#0c8599", fg: "#ffffff" },
];

function colorFor(name: string): { bg: string; fg: string } {
  let h = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PALETTE[Math.abs(h) % PALETTE.length] ?? DEFAULT_COLOR;
}

interface ClientLogoProps {
  name: string;
  logoUrl?: string | null;
  /** Lado do quadrado em px (default 36). */
  size?: number;
}

export function ClientLogo({ name, logoUrl, size = 36 }: ClientLogoProps) {
  if (logoUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: logo externo do cliente (futuro), sem otimização Next.
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className="flex-none rounded-[10px] border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const c = colorFor(name);
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-[10px] font-display font-semibold uppercase"
      style={{
        width: size,
        height: size,
        backgroundColor: c.bg,
        color: c.fg,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials(name)}
    </span>
  );
}
