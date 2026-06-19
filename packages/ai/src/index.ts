// @rh/ai — slots de LLM por capacidade + gate ZDR + runner (fallback) + transporte OpenRouter
// + generate (output validado por Zod, base das features) + mock de teste + features (cérebro).
export * from "./features/extract";
export * from "./features/judge";
export * from "./features/prepare";
export * from "./generate";
export * from "./mock";
export * from "./registry";
export * from "./runner";
export * from "./transport";
