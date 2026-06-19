import { z } from "zod";

/**
 * Ação leve do overlay (preload → main, APP-DESKTOP §3). Validada na fronteira IPC
 * (um renderer comprometido não pode injetar payloads inesperados).
 */
export const veraAction = z.object({
  kind: z.enum(["usei", "pular", "star", "chat", "end"]),
  text: z.string().max(2000).optional(),
});

export type VeraAction = z.infer<typeof veraAction>;
