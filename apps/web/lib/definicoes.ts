import type { Slot } from "@rh/ai";

export interface RetentionRow {
  label: string;
  valor: string;
}

/**
 * Defaults SUGERIDOS de retenção (LEGAL-E-RGPD §3). O produto só oferece as alavancas — a IRIS
 * ajusta os prazos. Mostrados como leitura no ecrã de Definições.
 */
export const RETENTION_DEFAULTS: ReadonlyArray<RetentionRow> = [
  { label: "Áudio / transcrição crua", valor: "30 dias" },
  { label: "Factos pessoais", valor: "90 dias" },
  { label: "Janela soft → hard delete (purga)", valor: "30 dias" },
];

/** Ambiente da app (secção "Sobre"). Determinístico a partir de `NODE_ENV`. */
export function appEnvironment(env: string | undefined): "produção" | "desenvolvimento" {
  return env === "production" ? "produção" : "desenvolvimento";
}

/** Defaults dos slots (espelham `lib/ai.ts`). Usados só para LEITURA no ecrã de Definições. */
const SLOT_DEFAULT_MODEL: Record<Slot, string> = {
  EXTRACTOR: "anthropic/claude-haiku-4-5",
  ARCHITECT: "anthropic/claude-opus-4-8",
  LIVE: "anthropic/claude-sonnet-4-6",
};

export interface ModelSlotRow {
  slot: Slot;
  /** Nome curto para o cabeçalho da linha (PT). */
  titulo: string;
  /** Para que serve o slot, em linguagem da Filipa. */
  papel: string;
  /** Capacidades exigidas (MODELOS-E-API §3). */
  requisitos: string;
  /** Modelo configurado (env override ou default). Só leitura. */
  modelo: string;
}

/** Metadados dos 3 slots de IA. Estáticos (papel/requisitos); o modelo vem do ambiente. */
const SLOT_META: Record<Slot, Pick<ModelSlotRow, "titulo" | "papel" | "requisitos">> = {
  EXTRACTOR: {
    titulo: "Extrator",
    papel: "Lê CVs e vagas, destila factos. O trabalho barato e em volume.",
    requisitos: "Saída estruturada (JSON)",
  },
  ARCHITECT: {
    titulo: "Arquiteto",
    papel: "Rubric, briefing, parecer e comparações. O raciocínio que pesa na decisão.",
    requisitos: "Raciocínio forte, contexto longo, JSON, tools",
  },
  LIVE: {
    titulo: "Ao vivo",
    papel: "Acompanha a entrevista em tempo real e responde no chat.",
    requisitos: "Baixa latência, streaming, JSON, tools",
  },
};

/**
 * Lê a configuração dos slots a partir do ambiente (mesma fonte que `lib/ai.ts`): `MODEL_<slot>`
 * com fallback para o default. Só leitura, determinístico, sem efeitos. O seletor real (catálogo
 * OpenRouter, filtrado por slot) precisa de chave, por isso aqui só mostramos o estado.
 */
export function readModelSlots(env: NodeJS.ProcessEnv): ReadonlyArray<ModelSlotRow> {
  return (["EXTRACTOR", "ARCHITECT", "LIVE"] as const).map((slot) => ({
    slot,
    ...SLOT_META[slot],
    modelo: env[`MODEL_${slot}`] ?? SLOT_DEFAULT_MODEL[slot],
  }));
}
