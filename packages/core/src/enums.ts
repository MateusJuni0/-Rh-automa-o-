import { z } from "zod";

// Enums de domínio partilhados — fonte ÚNICA de validação nas fronteiras (boundary).
// Espelham os valores permitidos das colunas TEXT do schema (@rh/db). Mantê-los em sincronia.

/** Efeito de uma ação do assistente (tool registry — AGENTE-TOOLS-E-WS). */
export const efeito = z.enum(["leitura", "gravar", "enviar_fora"]);
export type Efeito = z.infer<typeof efeito>;

/** Papel do participante (role-binding, §16M). 'unknown' até a Filipa confirmar. */
export const speakerRole = z.enum(["candidate", "client", "recruiter", "other", "unknown"]);
export type SpeakerRole = z.infer<typeof speakerRole>;

/** Falante de um chunk/facto (§13 inclui 'client'). */
export const speaker = z.enum(["candidate", "recruiter", "client", "other"]);
export type Speaker = z.infer<typeof speaker>;

/** Etapa do processo (candidatura). */
export const processStage = z.enum([
  "sourced",
  "screening",
  "interview",
  "submitted",
  "client_iv",
  "offer",
  "placed",
  "rejected",
  "withdrawn",
]);
export type ProcessStage = z.infer<typeof processStage>;

/** Estado da entrevista. 'unstructured' = órfã (gravou, falta ligar a process). */
export const interviewStatus = z.enum(["scheduled", "live", "done", "unstructured"]);
export type InterviewStatus = z.infer<typeof interviewStatus>;

/** Tipo de captura. 'none' = entrevista sem captura (candidato recusou). */
export const captureType = z.enum(["bot_online", "local_mic", "none"]);
export type CaptureType = z.infer<typeof captureType>;

/** Estado de prova de um facto (§7). 'research' fica 'a_confirmar' até confirmado ao vivo. */
export const estadoProva = z.enum(["direto", "a_confirmar", "superseded"]);
export type EstadoProva = z.infer<typeof estadoProva>;

/** Origem do facto destilado (§7). */
export const factSourceType = z.enum(["interview", "research", "cv"]);
export type FactSourceType = z.infer<typeof factSourceType>;

/**
 * Classificação RGPD (§5 + nicho clínico §5). Default conservador: na dúvida de categoria
 * especial → fora do score. 'professional_clinico' = saúde de TERCEIROS que o candidato trata
 * (é a própria evidência profissional, DENTRO do score); 'personal_saude_titular' = saúde do
 * candidato (sensível, FORA do score).
 */
export const classificacao = z.enum([
  "professional",
  "personal",
  "personal_saude_titular",
  "professional_clinico",
]);
export type Classificacao = z.infer<typeof classificacao>;

/** Nível do gabarito (§9/§16L). */
export const rubricLevel = z.enum(["fraco", "ok", "forte"]);
export type RubricLevel = z.infer<typeof rubricLevel>;

/** Confiança (de fonte ou de juízo). */
export const confianca = z.enum(["alta", "media", "baixa"]);
export type Confianca = z.infer<typeof confianca>;

/** Peso/obrigatoriedade de um requisito (Parte F). */
export const peso = z.enum(["must", "normal", "nice"]);
export type Peso = z.infer<typeof peso>;

/** Lente da sugestão ao vivo (3 lentes). */
export const lente = z.enum(["tecnica", "cliente", "gap"]);
export type Lente = z.infer<typeof lente>;

/** Estado do fetch de pesquisa ao vivo (§16K). */
export const fetchStatus = z.enum([
  "ok",
  "not_found",
  "forbidden",
  "timeout",
  "blocked_ssrf",
  "unrenderable",
  "cap_reached",
]);
export type FetchStatus = z.infer<typeof fetchStatus>;

/** Ciclo de vida do parecer (§16B). */
export const reportStatus = z.enum(["generating", "ready", "failed"]);
export type ReportStatus = z.infer<typeof reportStatus>;

/** Estado de uma ação do assistente. */
export const assistantActionStatus = z.enum(["pending_confirm", "done", "rejected", "failed"]);
export type AssistantActionStatus = z.infer<typeof assistantActionStatus>;

/** Estado de um job assíncrono durável (§12). */
export const asyncJobStatus = z.enum(["running", "done", "failed", "pending_confirm"]);
export type AsyncJobStatus = z.infer<typeof asyncJobStatus>;

/** Veredito do cliente (calibração). */
export const verdictValue = z.enum(["approved", "rejected", "pending"]);
export type VerdictValue = z.infer<typeof verdictValue>;

/** Origem de uma linha da rubric (CAMADA-CONHECIMENTO — de onde a linha veio). */
export const criterioOrigem = z.enum(["role_profile", "client_criteria", "ambos"]);
export type CriterioOrigem = z.infer<typeof criterioOrigem>;

/** Tipo de critério: competência (prova-se por profundidade) vs credencial (por documento, §11). */
export const criterioTipo = z.enum(["competencia", "credencial"]);
export type CriterioTipo = z.infer<typeof criterioTipo>;

/** Estado de uma credencial regulada (§11) — verificada por DOCUMENTO, não por profundidade. */
export const credencialEstado = z.enum(["por_verificar", "verificado", "invalido", "expirado"]);
export type CredencialEstado = z.infer<typeof credencialEstado>;

/** A QUEM pertence uma entrada de intake (envelope tipado — o bot nunca adivinha). */
export const intakeAlvo = z.enum(["cliente", "vaga", "candidato"]);
export type IntakeAlvo = z.infer<typeof intakeAlvo>;

/** Intenção de uma entrada de intake (decide o fluxo; só 'pergunta' NÃO grava nada durável). */
export const intakeIntencao = z.enum([
  "setup",
  "add_requisito",
  "corrigir_facto",
  "pergunta",
  "nova_vaga",
  "novo_candidato",
]);
export type IntakeIntencao = z.infer<typeof intakeIntencao>;

/** Resposta a um critério no relatório do cliente (RELATORIO-CLIENTE §3). */
export const respostaCriterio = z.enum([
  "coberto-com-prova",
  "raso",
  "não-confirmado",
  "contradito",
]);
export type RespostaCriterio = z.infer<typeof respostaCriterio>;
