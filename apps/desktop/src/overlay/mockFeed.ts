import {
  type RequisitoStatus,
  type ServerMessage,
  serverMessage,
  WS_PROTOCOL_VERSION,
} from "@rh/core";

/**
 * Feed WS MOCK — uma "entrevista golden" guionada (APP-DESKTOP §3, sem áudio nem LiveKit).
 * Alimenta o overlay no demo e prova ponta-a-ponta (logic) que: sugestão dispara → semáforo
 * muda → auto-dismiss → rede de segurança no fim. Substituível pelo WS real só com a chave.
 */

export const MOCK_INTERVIEW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REQ_REACT = "11111111-1111-4111-8111-111111111111";
const REQ_ANOS = "22222222-2222-4222-8222-222222222222";
const REQ_INGLES = "33333333-3333-4333-8333-333333333333";
const REQ_TESTES = "44444444-4444-4444-8444-444444444444";

type StatusMap = Partial<Record<string, RequisitoStatus>>;

function requisitos(status: StatusMap) {
  const get = (id: string): RequisitoStatus => status[id] ?? "não-tocado";
  return [
    { requisitoId: REQ_REACT, display: "React (must)", status: get(REQ_REACT) },
    { requisitoId: REQ_ANOS, display: "5+ anos", status: get(REQ_ANOS) },
    { requisitoId: REQ_INGLES, display: "Inglês", status: get(REQ_INGLES) },
    { requisitoId: REQ_TESTES, display: "Testes automatizados", status: get(REQ_TESTES) },
  ];
}

function estado(status: StatusMap, resumo: string, redFlags: string[] = []) {
  return {
    requisitos: requisitos(status),
    interessesCliente: [],
    afirmacoesCandidato: [],
    perguntasFeitas: [],
    redFlags,
    resumoCorrente: resumo,
  };
}

/** Omit distributivo sobre o union de frames (preserva os campos de cada variante). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type FramePayload = DistributiveOmit<ServerMessage, "v" | "seq">;

const PAYLOADS: FramePayload[] = [
  { type: "interview.active", interviewId: MOCK_INTERVIEW_ID, on: true },
  {
    type: "tick.update",
    interviewId: MOCK_INTERVIEW_ID,
    estado: estado({}, "Entrevista a começar."),
  },
  {
    type: "suggestion.next",
    interviewId: MOCK_INTERVIEW_ID,
    pergunta: "Você falou em React há 5 anos — como lida com performance em listas grandes?",
    lente: "tecnica",
    requisitoId: REQ_REACT,
  },
  {
    type: "tick.update",
    interviewId: MOCK_INTERVIEW_ID,
    estado: estado({ [REQ_REACT]: "raso" }, "Mencionou React, ainda sem prova."),
  },
  {
    type: "coverage.update",
    interviewId: MOCK_INTERVIEW_ID,
    requisitos: [{ requisitoId: REQ_REACT, status: "coberto-com-prova" }],
  },
  {
    type: "suggestion.next",
    interviewId: MOCK_INTERVIEW_ID,
    pergunta: "No CV diz que escreve testes — pode dar um exemplo concreto?",
    lente: "gap",
    requisitoId: REQ_TESTES,
  },
  {
    type: "tick.update",
    interviewId: MOCK_INTERVIEW_ID,
    estado: estado(
      { [REQ_REACT]: "coberto-com-prova", [REQ_TESTES]: "contradito" },
      "Sobre testes, o que disse contradiz o CV.",
      ["Testes: afirma no CV mas não confirmou na entrevista"],
    ),
  },
  {
    type: "alert",
    interviewId: MOCK_INTERVIEW_ID,
    texto: "Antes de terminar: falta confirmar Inglês e 5+ anos.",
  },
];

/** Sequência completa de frames da entrevista golden (com `v`+`seq` válidos). */
export function goldenInterviewFrames(): ServerMessage[] {
  return PAYLOADS.map((payload, index) =>
    serverMessage.parse({ ...payload, v: WS_PROTOCOL_VERSION, seq: index }),
  );
}

export interface ScheduledFrame {
  delayMs: number;
  msg: ServerMessage;
}

/** Mesma sequência com atrasos para o player do renderer reproduzir ao vivo. */
export function goldenInterviewScript(stepMs = 2500): ScheduledFrame[] {
  return goldenInterviewFrames().map((msg, index) => ({ delayMs: index * stepMs, msg }));
}
