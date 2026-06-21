import { randomUUID } from "node:crypto";
import { classifyIntake } from "@rh/ai";
import { type IntakeEnvelope, intakeEnvelope } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { aiOptions } from "./ai";
import { createCandidato } from "./candidatos";
import { DEV_RECRUITER_ID } from "./vagas";

type Db = DbHandle["db"];

/** Envelope canned sem chave (demo) — assume um CV de candidato encaminhado. */
function stubIntake(text: string): IntakeEnvelope {
  return { alvo: "candidato", alvoId: null, intencao: "novo_candidato", conteudo: text };
}

function entityTypeFor(env: IntakeEnvelope): string {
  switch (env.alvo) {
    case "candidato":
      return "candidate_cv";
    case "vaga":
      return "job_requirements";
    case "cliente":
      return "client_feedback";
    default:
      return "unknown";
  }
}

export interface IngerirParams {
  source: string; // telegram|web_upload|email
  text: string;
  recruiterId?: string;
}

/**
 * Ingere uma mensagem de intake (§5): classifica (stub sem chave) e grava `intake_message` por
 * confirmar (`confirmed_at` NULL). NÃO cria nada durável até `confirmarIntake`. Devolve {messageId, envelope}.
 */
export async function ingerirMensagem(
  db: Db,
  agencyId: string,
  params: IngerirParams,
): Promise<{ messageId: string; envelope: IntakeEnvelope }> {
  const envelope = await classifyIntake(params.text, aiOptions(stubIntake(params.text)));
  const messageId = randomUUID();
  await db.insert(schema.intakeMessage).values({
    id: messageId,
    agencyId,
    recruiterId: params.recruiterId ?? DEV_RECRUITER_ID,
    source: params.source,
    rawText: params.text,
    extracted: envelope,
    alvo: envelope.alvo,
    intencao: envelope.intencao,
    entityType: entityTypeFor(envelope),
  });
  return { messageId, envelope };
}

export interface PendingIntake {
  id: string;
  source: string; // telegram|web_upload|email
  alvo: string | null; // candidato|vaga|cliente
  intencao: string | null; // novo_candidato|pergunta|…
  /** Excerto do que chegou (para a Filipa rever antes de confirmar). */
  preview: string;
}

/** Mensagens de intake POR CONFIRMAR (a porta de segurança: nada se grava sem a Filipa rever). */
export async function listPendingIntake(db: Db, agencyId: string): Promise<PendingIntake[]> {
  const rows = await db
    .select({
      id: schema.intakeMessage.id,
      source: schema.intakeMessage.source,
      alvo: schema.intakeMessage.alvo,
      intencao: schema.intakeMessage.intencao,
      rawText: schema.intakeMessage.rawText,
    })
    .from(schema.intakeMessage)
    .where(
      and(eq(schema.intakeMessage.agencyId, agencyId), isNull(schema.intakeMessage.confirmedAt)),
    )
    .orderBy(desc(schema.intakeMessage.createdAt));
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    alvo: r.alvo,
    intencao: r.intencao,
    preview: (r.rawText ?? "").trim().slice(0, 280),
  }));
}

export interface ConfirmarParams {
  messageId: string;
  name?: string; // nome do candidato, quando aplicável
}

export interface ConfirmarResult {
  created: boolean;
  entityType?: string;
  entityId?: string;
  reason?: string;
}

/**
 * Confirma uma mensagem de intake. 'pergunta' nunca grava. 'novo_candidato' cria o candidato
 * (extrai o perfil do conteúdo). Outras intenções requerem o alvo/contexto de sessão (fase seguinte):
 * marcam-se confirmadas sem criar entidade. Idempotente por `confirmed_at`.
 */
export async function confirmarIntake(
  db: Db,
  agencyId: string,
  params: ConfirmarParams,
): Promise<ConfirmarResult> {
  const [msg] = await db
    .select({
      extracted: schema.intakeMessage.extracted,
      confirmedAt: schema.intakeMessage.confirmedAt,
      entityId: schema.intakeMessage.entityId,
      entityType: schema.intakeMessage.entityType,
    })
    .from(schema.intakeMessage)
    .where(
      and(
        eq(schema.intakeMessage.id, params.messageId),
        eq(schema.intakeMessage.agencyId, agencyId),
      ),
    );
  if (!msg) {
    throw new Error("mensagem de intake inexistente nesta agência");
  }
  if (msg.confirmedAt) {
    return {
      created: false,
      entityType: msg.entityType ?? undefined,
      entityId: msg.entityId ?? undefined,
      reason: "já confirmado",
    };
  }

  const env = intakeEnvelope.parse(msg.extracted);
  if (env.intencao === "pergunta") {
    return { created: false, reason: "intenção 'pergunta' não grava nada durável" };
  }

  if (env.alvo === "candidato" && env.intencao === "novo_candidato") {
    const { id } = await createCandidato(db, agencyId, {
      name: params.name ?? "Candidato (intake)",
      cvText: env.conteudo,
    });
    await db
      .update(schema.intakeMessage)
      .set({ confirmedAt: sql`now()`, entityId: id, entityType: "candidate_cv" })
      .where(eq(schema.intakeMessage.id, params.messageId));
    return { created: true, entityType: "candidate", entityId: id };
  }

  await db
    .update(schema.intakeMessage)
    .set({ confirmedAt: sql`now()` })
    .where(eq(schema.intakeMessage.id, params.messageId));
  return { created: false, reason: "intenção requer alvo/contexto de sessão (resolvido na app)" };
}
