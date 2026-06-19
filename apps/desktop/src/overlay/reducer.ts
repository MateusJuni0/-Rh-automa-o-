import type { Lente, RequisitoStatus, ServerMessage } from "@rh/core";
import type { HudAction, HudState, HudSuggestionView, RequisitoView } from "./types";

const QUEUE_CAP = 3;
const COVERED: RequisitoStatus = "coberto-com-prova";
const VALID_STATUS: ReadonlySet<string> = new Set<RequisitoStatus>([
  "não-tocado",
  "raso",
  "coberto-com-prova",
  "contradito",
]);

const PORQUE_POR_STATUS: Record<RequisitoStatus, string> = {
  "não-tocado": "ainda por cobrir",
  raso: "afirmação rasa — falta prova",
  "coberto-com-prova": "já coberto — confirmar profundidade",
  contradito: "contradiz o CV — confirmar",
};

const PORQUE_POR_LENTE: Record<Lente, string> = {
  tecnica: "aprofundar a competência técnica",
  cliente: "o que este cliente quer saber",
  gap: "lacuna entre o CV e a vaga",
};

export const initialHudState: HudState = {
  conn: "connecting",
  interviewActive: false,
  recording: false,
  suggestion: null,
  queue: [],
  requisitos: [],
  alerts: [],
  resumoCorrente: "",
  lastSeq: -1,
};

/** Porquê numa frase: do estado do requisito ligado; senão, da lente (APP-DESKTOP §3 / Tela 6). */
export function derivePorque(
  s: { lente: Lente; requisitoId: string | null },
  requisitos: readonly RequisitoView[],
): string {
  if (s.requisitoId) {
    const req = requisitos.find((r) => r.requisitoId === s.requisitoId);
    if (req) {
      return PORQUE_POR_STATUS[req.status];
    }
  }
  return PORQUE_POR_LENTE[s.lente];
}

function isCovered(view: HudSuggestionView, requisitos: readonly RequisitoView[]): boolean {
  if (!view.requisitoId) {
    return false;
  }
  return requisitos.some((r) => r.requisitoId === view.requisitoId && r.status === COVERED);
}

/** Re-deriva o porquê e descarta sugestões já cobertas; promove a próxima viva da fila. */
function refreshSuggestions(
  suggestion: HudSuggestionView | null,
  queue: readonly HudSuggestionView[],
  requisitos: readonly RequisitoView[],
): Pick<HudState, "suggestion" | "queue"> {
  const rederive = (v: HudSuggestionView): HudSuggestionView => ({
    ...v,
    porque: derivePorque(v, requisitos),
  });
  const liveQueue = queue.filter((v) => !isCovered(v, requisitos)).map(rederive);

  let current = suggestion ? rederive(suggestion) : null;
  let rest = liveQueue;
  while (current && isCovered(current, requisitos)) {
    current = rest[0] ?? null;
    rest = rest.slice(1);
  }
  return { suggestion: current, queue: rest };
}

function mapRequisitos(
  estadoRequisitos: ReadonlyArray<{
    requisitoId: string;
    display: string;
    status: RequisitoStatus;
    evidencia?: string;
  }>,
): RequisitoView[] {
  return estadoRequisitos.map((r) => ({
    requisitoId: r.requisitoId,
    display: r.display,
    status: r.status,
    ...(r.evidencia !== undefined ? { evidencia: r.evidencia } : {}),
  }));
}

function applyCoverage(
  requisitos: readonly RequisitoView[],
  updates: ReadonlyArray<{ requisitoId: string; status: string }>,
): RequisitoView[] {
  const valid = new Map<string, RequisitoStatus>();
  for (const u of updates) {
    if (VALID_STATUS.has(u.status)) {
      valid.set(u.requisitoId, u.status as RequisitoStatus);
    }
  }
  const updated = requisitos.map((r) => {
    const status = valid.get(r.requisitoId);
    return status !== undefined ? { ...r, status } : r;
  });
  // `coverage.update` pode referir um requisito antes do `tick.update` que o estabelece;
  // entra com display vazio (o próximo tick.update preenche o texto).
  const novos: RequisitoView[] = [];
  for (const [requisitoId, status] of valid) {
    if (!requisitos.some((r) => r.requisitoId === requisitoId)) {
      novos.push({ requisitoId, display: "", status });
    }
  }
  return [...updated, ...novos];
}

function pushQueue(
  queue: readonly HudSuggestionView[],
  prev: HudSuggestionView | null,
): HudSuggestionView[] {
  if (!prev) {
    return [...queue];
  }
  const deduped = queue.filter((v) => v.pergunta !== prev.pergunta);
  return [prev, ...deduped].slice(0, QUEUE_CAP);
}

function applyServer(state: HudState, msg: ServerMessage): HudState {
  // Proteção de replay: descarta frames já processados (seq monótono; -1 = ainda nenhum).
  if (state.lastSeq !== -1 && msg.seq <= state.lastSeq) {
    return state;
  }
  const base: HudState = { ...state, lastSeq: msg.seq };

  switch (msg.type) {
    case "auth.ok":
      return { ...base, conn: "live" };
    case "auth.error":
      // 4401 (refresh) vs 4403 (sem posse) ambos → offline; TODO v1.1: distinguir p/ re-auth UX.
      return { ...base, conn: "offline" };
    case "auth.refresh_needed":
      // O reducer só rastreia o estado do overlay; o refresh do token é tratado no cliente WS.
      return base;
    case "interview.active": {
      if (!msg.on) {
        return {
          ...base,
          interviewActive: false,
          recording: false,
          suggestion: null,
          queue: [],
          alerts: [],
        };
      }
      return { ...base, conn: "live", interviewActive: true, recording: true };
    }
    case "tick.update": {
      const requisitos = mapRequisitos(msg.estado.requisitos);
      const { suggestion, queue } = refreshSuggestions(base.suggestion, base.queue, requisitos);
      return { ...base, requisitos, resumoCorrente: msg.estado.resumoCorrente, suggestion, queue };
    }
    case "suggestion.next": {
      const view: HudSuggestionView = {
        pergunta: msg.pergunta,
        lente: msg.lente,
        requisitoId: msg.requisitoId,
        porque: derivePorque({ lente: msg.lente, requisitoId: msg.requisitoId }, base.requisitos),
      };
      return { ...base, suggestion: view, queue: pushQueue(base.queue, base.suggestion) };
    }
    case "coverage.update": {
      const requisitos = applyCoverage(base.requisitos, msg.requisitos);
      const { suggestion, queue } = refreshSuggestions(base.suggestion, base.queue, requisitos);
      return { ...base, requisitos, suggestion, queue };
    }
    case "alert":
      return base.alerts.includes(msg.texto)
        ? base
        : { ...base, alerts: [...base.alerts, msg.texto] };
    case "job.progress":
    case "job.done":
      return base;
  }
}

/** Reducer puro do overlay: aplica mensagens do WS (e controlo) ao `HudState`. Imutável. */
export function hudReduce(state: HudState, action: HudAction): HudState {
  switch (action.kind) {
    case "conn":
      return { ...state, conn: action.status };
    case "dismissSuggestion": {
      const [next, ...rest] = state.queue;
      return { ...state, suggestion: next ?? null, queue: rest };
    }
    case "server":
      return applyServer(state, action.msg);
  }
}
