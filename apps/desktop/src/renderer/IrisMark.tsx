import { useId } from "react";

/** Marca da IRIS (globo navy + fita dourada) — o asset oficial, em SVG. É a "cara" da Vera. */
export function IrisMark({ size = 52 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const s = `irs-${uid}`;
  const r = `irr-${uid}`;
  const c = `irc-${uid}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="IRIS">
      <defs>
        <radialGradient id={s} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#1f3a63" />
          <stop offset="55%" stopColor="#102a4d" />
          <stop offset="100%" stopColor="#081a33" />
        </radialGradient>
        <linearGradient id={r} x1="6" y1="50" x2="56" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b07d34" />
          <stop offset="45%" stopColor="#d9a64b" />
          <stop offset="100%" stopColor="#f3d488" />
        </linearGradient>
        <clipPath id={c}>
          <circle cx="32" cy="32" r="25.5" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="25.5" fill={`url(#${s})`} />
      <g clipPath={`url(#${c})`} fill="none" stroke="#6fb3bb" strokeWidth="0.8" opacity="0.4">
        <ellipse cx="32" cy="32" rx="25.5" ry="9.5" />
        <ellipse cx="32" cy="32" rx="9.5" ry="25.5" />
        <ellipse cx="32" cy="32" rx="25.5" ry="18" />
        <ellipse cx="32" cy="32" rx="18" ry="25.5" />
        <line x1="6.5" y1="32" x2="57.5" y2="32" />
        <line x1="32" y1="6.5" x2="32" y2="57.5" />
      </g>
      <g clipPath={`url(#${c})`} fill="#9fd0d6" opacity="0.5">
        <circle cx="22" cy="24" r="0.9" />
        <circle cx="40" cy="22" r="0.9" />
        <circle cx="44" cy="36" r="0.9" />
        <circle cx="26" cy="42" r="0.9" />
        <circle cx="34" cy="34" r="0.9" />
      </g>
      <circle cx="32" cy="32" r="25.5" fill="none" stroke="#0b2344" strokeWidth="1.4" />
      <path
        d="M5 47 C 16 58, 41 53, 51 30 C 55 21, 50 14.5, 43.5 15.5"
        fill="none"
        stroke={`url(#${r})`}
        strokeWidth="5.4"
        strokeLinecap="round"
      />
      <path
        d="M5 47 C 16 58, 41 53, 51 30 C 55 21, 50 14.5, 43.5 15.5"
        fill="none"
        stroke="#f7e2ad"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
