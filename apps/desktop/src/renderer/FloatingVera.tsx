import type { RequisitoStatus } from "@rh/core";
import {
  type FormEvent,
  type PointerEvent as RPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { HudState } from "../overlay/types";
import type { VeraBridge } from "../preload/preload";
import type { ChatTurn, HudCallbacks } from "./hud/types";
import { IrisMark } from "./IrisMark";

declare global {
  interface Window {
    vera?: VeraBridge;
  }
}

const ICON = 52;

/* ── ícones (SVG traço, sem emojis) ── */
const PATHS: Record<string, string> = {
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  minus: "M5 12h14",
  left: "M15 18l-6-6 6-6",
  right: "M9 18l6-6-6-6",
  min: "M6 9l6 6 6-6",
  alert:
    "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};
function Ico({ n, s = 16 }: { n: keyof typeof PATHS | string; s?: number }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[n] ?? ""} />
    </svg>
  );
}

/* ── animações (Web Animations API) ── */
type El = HTMLElement;
const A = (el: El, kf: Keyframe[], opt: KeyframeAnimationOptions) =>
  el.animate(kf, { fill: "forwards", ...opt }).finished;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reset = (el: El) => {
  for (const a of el.getAnimations()) a.cancel();
  el.style.transform = "";
};

async function idleAnim(el: El): Promise<void> {
  const p = Math.floor(Math.random() * 4);
  if (p === 0) {
    await A(
      el,
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-13px)" },
        { transform: "translateY(0) scaleY(.9) scaleX(1.1)" },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 760, easing: "cubic-bezier(.3,.8,.4,1)" },
    );
  } else if (p === 1) {
    await A(
      el,
      [
        { transform: "rotate(0)" },
        { transform: "rotate(8deg)" },
        { transform: "rotate(-8deg)" },
        { transform: "rotate(4deg)" },
        { transform: "rotate(0)" },
      ],
      { duration: 920, easing: "ease-in-out" },
    );
  } else if (p === 2) {
    await A(el, [{ transform: "rotate(0)" }, { transform: "rotate(26deg) translateY(2px)" }], {
      duration: 560,
      easing: "cubic-bezier(.6,0,.85,.35)",
    });
    await wait(220);
    await A(
      el,
      [
        { transform: "rotate(26deg) translateY(2px)" },
        { transform: "rotate(-9deg) translateY(-7px)" },
        { transform: "rotate(4deg)" },
        { transform: "rotate(0)" },
      ],
      { duration: 680, easing: "cubic-bezier(.3,.9,.4,1)" },
    );
  } else {
    await A(
      el,
      [{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
      {
        duration: 1100,
        easing: "ease-in-out",
      },
    );
  }
  reset(el);
}

function burst(host: El): void {
  const cols = ["#7cf5c0", "#5dcaa5", "#9fe1cb", "#b8ffe0"];
  for (let i = 0; i < 32; i++) {
    const s = document.createElement("span");
    s.className = "vera-spark";
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const dist = 30 + Math.random() * 100;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;
    const sz = 3 + Math.random() * 5;
    s.style.width = `${sz}px`;
    s.style.height = `${sz}px`;
    s.style.background = cols[i % 4] ?? "#5dcaa5";
    host.appendChild(s);
    s.animate(
      [
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(0)`, opacity: 0 },
      ],
      { duration: 680 + Math.random() * 360, easing: "cubic-bezier(.2,.7,.3,1)" },
    ).finished.then(() => s.remove());
  }
  for (const delay of [0, 140]) {
    const ring = document.createElement("span");
    ring.className = "vera-spark";
    ring.style.cssText =
      "left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;border:2px solid #5dcaa5;background:transparent";
    host.appendChild(ring);
    ring
      .animate(
        [
          { transform: "scale(.3)", opacity: 0.9 },
          { transform: "scale(5)", opacity: 0 },
        ],
        { duration: 620, delay, easing: "ease-out" },
      )
      .finished.then(() => ring.remove());
  }
}

async function reactionAnim(el: El, sparks: El, peakUp: number): Promise<void> {
  await A(
    el,
    [
      { transform: "translate(0,0) rotate(0)" },
      { transform: "translate(-4px,0) rotate(-6deg)" },
      { transform: "translate(4px,1px) rotate(6deg)" },
      { transform: "translate(-4px,0) rotate(-6deg)" },
      { transform: "translate(3px,1px) rotate(5deg)" },
      { transform: "translate(-3px,0) rotate(-4deg)" },
      { transform: "translate(2px,0) rotate(3deg)" },
      { transform: "translate(0,0) rotate(0) scaleY(.76) scaleX(1.18)" },
    ],
    { duration: 920, easing: "ease-in-out" },
  );
  await A(
    el,
    [
      { transform: "translateY(0) scaleY(.76) scaleX(1.18)" },
      { transform: `translateY(${-peakUp}px) scaleY(1.3) scaleX(.8)` },
    ],
    { duration: 440, easing: "cubic-bezier(.15,.85,.3,1)" },
  );
  burst(sparks);
  await A(
    el,
    [
      { transform: `translateY(${-peakUp}px) scaleY(1.3) scaleX(.8)` },
      { transform: `translateY(${-peakUp + 10}px) scaleY(.55) scaleX(1.45)` },
    ],
    { duration: 170, easing: "ease-out" },
  );
  await A(
    el,
    [
      { transform: `translateY(${-peakUp + 10}px) scaleY(.55) scaleX(1.45)` },
      { transform: "translateY(-8px) scaleY(1.06) scaleX(.96)" },
      { transform: "translateY(0) scaleY(1) scaleX(1)" },
    ],
    { duration: 660, easing: "cubic-bezier(.45,0,.55,1)" },
  );
  await A(
    el,
    [
      { transform: "translateY(0)" },
      { transform: "translateY(-11px)" },
      { transform: "translateY(0)" },
    ],
    {
      duration: 420,
      easing: "ease-out",
    },
  );
  reset(el);
}

/* ── verdito (Opção A) ── */
const STATUS_MAP: Record<
  RequisitoStatus,
  { tone: "green" | "red" | "gray"; ico: string; bar: string }
> = {
  "coberto-com-prova": { tone: "green", ico: "check", bar: "#5dcaa5" },
  contradito: { tone: "red", ico: "x", bar: "#e24b4a" },
  raso: { tone: "gray", ico: "minus", bar: "#26313f" },
  "não-tocado": { tone: "gray", ico: "minus", bar: "#26313f" },
};

interface FloatingVeraProps {
  state: HudState;
  elapsedMs: number;
  contexto?: string;
  chat: ChatTurn[];
  callbacks: HudCallbacks;
}

function fmt(ms: number): string {
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function FloatingVera({ state, elapsedMs, contexto, chat, callbacks }: FloatingVeraProps) {
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - ICON - 40,
    y: window.innerHeight - ICON - 150,
  }));
  const [expanded, setExpanded] = useState(false);
  const [sugIdx, setSugIdx] = useState(0);
  const [chatText, setChatText] = useState("");

  const iconRef = useRef<HTMLButtonElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const busyRef = useRef(false);
  const drag = useRef({
    id: -1,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
    moved: false,
    active: false,
    tap: undefined as undefined | (() => void),
  });
  const prevReq = useRef<Record<string, RequisitoStatus>>({});

  const suggestions = useMemo(
    () => (state.suggestion ? [state.suggestion, ...state.queue] : state.queue),
    [state.suggestion, state.queue],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset ao mudar a sugestão de topo
  useEffect(() => setSugIdx(0), [state.suggestion?.pergunta]);
  const sug = suggestions[Math.min(sugIdx, suggestions.length - 1)] ?? null;

  /* Click-through robusto: a janela só apanha o rato quando está EM CIMA da Vera (hit-test
     contínuo do cursor — mais fiável que onMouseEnter/Leave); fora dela, os cliques passam para a
     chamada. Durante o arrasto fica sempre interativa. */
  useEffect(() => {
    let on = false;
    const onMove = (e: MouseEvent) => {
      const over =
        drag.current.active ||
        !!document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest(".vera-icon,.vera-bubble,.vera-panel");
      if (over !== on) {
        on = over;
        window.vera?.setInteractive(over);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  /* arrasto (ícone e cabeçalho do painel) */
  const clampPos = (x: number, y: number) => ({
    x: Math.max(6, Math.min(x, window.innerWidth - ICON - 6)),
    y: Math.max(6, Math.min(y, window.innerHeight - ICON - 6)),
  });
  const onDown = (e: RPointerEvent, tap?: () => void) => {
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // pointer já libertado / sintético — ignora.
    }
    drag.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: posRef.current.x,
      oy: posRef.current.y,
      moved: false,
      active: true,
      tap,
    };
    window.vera?.setInteractive(true);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d.active || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setPos(clampPos(d.ox + dx, d.oy + dy));
  };
  const onUp = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d.active || d.id !== e.pointerId) return;
    d.active = false;
    if (!d.moved) d.tap?.();
  };

  /* idle quando parada */
  useEffect(() => {
    const t = window.setInterval(() => {
      if (busyRef.current || expandedRef.current || drag.current.active || !iconRef.current) return;
      busyRef.current = true;
      idleAnim(iconRef.current).finally(() => {
        busyRef.current = false;
      });
    }, 2600);
    return () => window.clearInterval(t);
  }, []);

  /* reação à mentira (requisito vira 'contradito') */
  useEffect(() => {
    const prev = prevReq.current;
    let newLie = false;
    for (const r of state.requisitos) {
      if (r.status === "contradito" && prev[r.requisitoId] !== "contradito") newLie = true;
    }
    prevReq.current = Object.fromEntries(state.requisitos.map((r) => [r.requisitoId, r.status]));
    if (
      newLie &&
      !expandedRef.current &&
      iconRef.current &&
      sparksRef.current &&
      !busyRef.current
    ) {
      busyRef.current = true;
      reactionAnim(iconRef.current, sparksRef.current, Math.max(40, posRef.current.y - 8)).finally(
        () => {
          busyRef.current = false;
        },
      );
    }
  }, [state.requisitos]);

  /* contagens do barómetro */
  const counts = { green: 0, red: 0, gray: 0 };
  for (const r of state.requisitos) counts[STATUS_MAP[r.status].tone]++;

  const onRight = pos.x + ICON / 2 > window.innerWidth / 2;
  const bubbleStyle = {
    left: onRight ? pos.x - 250 - 10 : pos.x + ICON + 10,
    top: Math.max(6, Math.min(pos.y - 6, window.innerHeight - 150)),
  };
  const panelStyle = {
    left: Math.max(
      6,
      Math.min(onRight ? pos.x - 332 - 10 : pos.x + ICON + 10, window.innerWidth - 338),
    ),
    top: Math.max(6, Math.min(pos.y - 60, window.innerHeight - 440)),
  };

  const flagStatus = sug
    ? (state.requisitos.find((r) => r.requisitoId === sug.requisitoId)?.status ?? "não-tocado")
    : null;

  function submitChat(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const t = chatText.trim();
    if (!t) return;
    callbacks.onSendChat(t);
    setChatText("");
  }

  return (
    <div className="vera-layer">
      <div ref={sparksRef} className="vera-sparks" style={{ left: pos.x + ICON / 2, top: 8 }} />

      {/* ── colapsado: ícone + balão ── */}
      {!expanded && (
        <>
          {sug && (
            <div className="vera-bubble" style={bubbleStyle}>
              <div
                className={`vera-bubble__flag ${flagStatus === "contradito" ? "vera-bubble__flag--red" : flagStatus === "coberto-com-prova" ? "vera-bubble__flag--green" : ""}`}
              >
                {flagStatus === "contradito" ? (
                  <>
                    <Ico n="alert" s={14} />
                    <span className="ct">Contradiz o CV</span>
                  </>
                ) : flagStatus === "coberto-com-prova" ? (
                  <>
                    <Ico n="check" s={14} />
                    <span className="ct">Confere com o CV</span>
                  </>
                ) : (
                  <span className="ct ct2" style={{ color: "#d9a64b" }}>
                    A Vera sugere
                  </span>
                )}
                <span className="vera-bubble__count">
                  {suggestions.length > 1 ? `${sugIdx + 1}/${suggestions.length}` : ""}
                </span>
              </div>
              <div className="vera-bubble__body">
                <p className="vera-bubble__q">{sug.pergunta}</p>
                <div className="vera-bubble__nav">
                  <button
                    type="button"
                    className="vera-nbtn"
                    disabled={sugIdx <= 0}
                    onClick={() => setSugIdx((i) => Math.max(0, i - 1))}
                    aria-label="Anterior"
                  >
                    <Ico n="left" s={13} />
                  </button>
                  <button
                    type="button"
                    className="vera-nbtn"
                    disabled={sugIdx >= suggestions.length - 1}
                    onClick={() => setSugIdx((i) => Math.min(suggestions.length - 1, i + 1))}
                    aria-label="Próxima"
                  >
                    <Ico n="right" s={13} />
                  </button>
                  <button
                    type="button"
                    className="vera-gold"
                    style={{ marginLeft: "auto", fontSize: 11, padding: "5px 12px" }}
                    onClick={callbacks.onUsei}
                  >
                    Usei
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            ref={iconRef}
            className="vera-icon"
            style={{ left: pos.x, top: pos.y }}
            aria-label="Vera: arrasta para mover, clica para abrir"
            onPointerDown={(e) => onDown(e, () => setExpanded(true))}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded(true);
              }
            }}
            title="Arrasta para mover · clica para abrir"
          >
            <IrisMark size={ICON} />
          </button>
        </>
      )}

      {/* ── expandido: painel ── */}
      {expanded && (
        <div className="vera-panel" style={panelStyle}>
          <div
            className="vera-panel__hd"
            onPointerDown={(e) => onDown(e)}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            <span className="vera-panel__hdmark">
              <IrisMark size={26} />
            </span>
            <span className="vera-panel__hdname">
              <b>{contexto ?? "Entrevista"}</b>
              <span>{state.recording ? "ao vivo · IRIS" : "IRIS"}</span>
            </span>
            <span className="vera-panel__time">{fmt(elapsedMs)}</span>
            <button
              type="button"
              className="vera-iconbtn"
              aria-label="Recolher"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setExpanded(false)}
            >
              <Ico n="min" s={16} />
            </button>
          </div>

          <div className="vera-panel__hero">
            {sug ? (
              <>
                <div className="vera-panel__cue">A Vera sugere</div>
                <p className="vera-panel__q">{sug.pergunta}</p>
                <div className="vera-panel__actions">
                  <button
                    type="button"
                    className="vera-gold"
                    style={{ fontSize: 13, padding: "7px 16px" }}
                    onClick={callbacks.onUsei}
                  >
                    Usei
                  </button>
                  <button
                    type="button"
                    className="vera-ghost"
                    style={{ fontSize: 13, padding: "7px 16px" }}
                    onClick={callbacks.onPular}
                  >
                    Pular
                  </button>
                  <button
                    type="button"
                    className="vera-ghost"
                    style={{ marginLeft: "auto", fontSize: 13, padding: "7px 11px" }}
                    aria-label="Marcar momento"
                    onClick={callbacks.onStar}
                  >
                    ★
                  </button>
                </div>
              </>
            ) : (
              <p className="vera-panel__calm">No caminho. Segue a conversa.</p>
            )}
          </div>

          {state.requisitos.length > 0 && (
            <div className="vera-panel__verdict">
              <div className="vera-panel__vhd">
                <span className="l">Verdade vs CV</span>
                <span className="l">{state.requisitos.length} critérios</span>
              </div>
              <div className="vera-bar">
                {counts.green > 0 && <span style={{ flex: counts.green, background: "#5dcaa5" }} />}
                {counts.red > 0 && <span style={{ flex: counts.red, background: "#e24b4a" }} />}
                {counts.gray > 0 && <span style={{ flex: counts.gray, background: "#26313f" }} />}
              </div>
              <div className="vera-chips">
                {state.requisitos.map((r) => {
                  const m = STATUS_MAP[r.status];
                  return (
                    <span key={r.requisitoId} className={`vera-chip vera-chip--${m.tone}`}>
                      <Ico n={m.ico} s={13} />
                      {r.display}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {state.alerts.length > 0 && (
            <div className="vera-panel__verdict" style={{ paddingTop: 0 }}>
              {state.alerts.map((a) => (
                <div
                  key={a}
                  style={{
                    display: "flex",
                    gap: 9,
                    background: "#1b1710",
                    border: "0.5px solid #3a2f15",
                    borderRadius: 9,
                    padding: "10px 12px",
                    color: "#f0cd86",
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: "#d9a64b", flex: "none", marginTop: 1 }}>
                    <Ico n="alert" s={15} />
                  </span>
                  {a}
                </div>
              ))}
            </div>
          )}

          <div className="vera-panel__chat">
            {chat.length > 0 && (
              <ul className="vera-chat__log">
                {chat.map((turn) => (
                  <li key={turn.id} className={`vera-chat__turn vera-chat__turn--${turn.role}`}>
                    <b>{turn.role === "bot" ? "Vera" : "Tu"}</b> · {turn.text}
                  </li>
                ))}
              </ul>
            )}
            <form className="vera-chat__form" onSubmit={submitChat}>
              <input
                className="vera-chat__input"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Perguntar à Vera…"
                aria-label="Perguntar à Vera"
              />
              <button
                type="submit"
                className="vera-ghost"
                style={{ fontSize: 12, padding: "8px 13px", color: "#9fe1cb" }}
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
