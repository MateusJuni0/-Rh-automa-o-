export type VeraState = "idle" | "thinking" | "writing";

/**
 * Vera — a "secretária" robô da Filipa. SVG + CSS (sem libs). 3 estados animados:
 * idle (pisca + respira), thinking (pontinhos + antena rápida), writing (mãos a teclar).
 * As animações vivem em globals.css (.vera-*); aqui é só a forma + o `data-state`.
 */
export function VeraAvatar({ state = "idle", size = 184 }: { state?: VeraState; size?: number }) {
  const ink = "#1b2128";
  const inkLine = "#2c333e";
  const screen = "#0e1217";
  const teal = "#5dcaa5";
  const head = "#222a33";
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className="vera-bot"
      data-state={state}
      role="img"
      aria-label="Vera, a tua assistente"
    >
      <title>Vera</title>
      {/* pontinhos "a pensar" */}
      <g>
        <circle className="vera-think-dot" cx="120" cy="26" r="3" fill={teal} />
        <circle className="vera-think-dot" cx="131" cy="22" r="3.5" fill={teal} />
        <circle className="vera-think-dot" cx="144" cy="17" r="4" fill={teal} />
      </g>

      {/* antena */}
      <line
        x1="100"
        y1="42"
        x2="100"
        y2="30"
        stroke={inkLine}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle className="vera-antenna" cx="100" cy="27" r="4.5" fill={teal} />

      {/* auscultadores (ear cups) */}
      <rect x="58" y="62" width="11" height="22" rx="5" fill={head} stroke={inkLine} />
      <rect x="131" y="62" width="11" height="22" rx="5" fill={head} stroke={inkLine} />
      {/* arco do headset */}
      <path
        d="M63 64 Q100 34 137 64"
        fill="none"
        stroke={inkLine}
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* cabeça */}
      <rect
        x="66"
        y="44"
        width="68"
        height="58"
        rx="19"
        fill={head}
        stroke={inkLine}
        strokeWidth="1.5"
      />
      {/* "ecrã" do rosto */}
      <rect x="74" y="54" width="52" height="38" rx="13" fill={screen} />
      {/* olhos */}
      <rect className="vera-eye" x="85" y="66" width="8" height="13" rx="4" fill={teal} />
      <rect className="vera-eye" x="107" y="66" width="8" height="13" rx="4" fill={teal} />
      {/* sorriso */}
      <path
        d="M92 85 Q100 90 108 85"
        fill="none"
        stroke={teal}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* braço do micro */}
      <path
        d="M64 78 Q70 96 88 92"
        fill="none"
        stroke={inkLine}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="89" cy="92" r="3" fill={teal} opacity="0.85" />

      {/* corpo / ombros */}
      <path
        d="M60 150 Q60 108 100 108 Q140 108 140 150 Z"
        fill={ink}
        stroke={inkLine}
        strokeWidth="1.5"
      />
      {/* gola/acento */}
      <path
        d="M88 110 L100 122 L112 110"
        fill="none"
        stroke={teal}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* secretária / mesa */}
      <rect x="34" y="150" width="132" height="9" rx="4" fill={inkLine} />
      {/* portátil */}
      <rect x="80" y="140" width="40" height="11" rx="2" fill={head} stroke={inkLine} />
      <rect x="83" y="142" width="34" height="7" rx="1.5" fill={teal} opacity="0.18" />

      {/* mãos a teclar */}
      <rect
        className="vera-hand"
        x="78"
        y="146"
        width="14"
        height="7"
        rx="3.5"
        fill={head}
        stroke={inkLine}
      />
      <rect
        className="vera-hand"
        x="108"
        y="146"
        width="14"
        height="7"
        rx="3.5"
        fill={head}
        stroke={inkLine}
      />
    </svg>
  );
}
