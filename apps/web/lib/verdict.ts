import { randomUUID } from "node:crypto";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";

type Db = DbHandle["db"];

export interface RegistarVerdictParams {
  processId: string;
  verdict: "approved" | "rejected" | "pending";
  reason?: string;
  reasonType?: string;
  botPredicted?: "strong" | "ok" | "weak";
  rubricVersion?: number;
}

/**
 * Regista o veredito do cliente (§6/§16E calibração): o ground-truth contra o qual se mede a previsão
 * do bot (`bot_predicted`). Insere em `client_verdict`. Devolve o id.
 */
export async function registarVerdict(
  db: Db,
  agencyId: string,
  params: RegistarVerdictParams,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db.insert(schema.clientVerdict).values({
    id,
    agencyId,
    processId: params.processId,
    verdict: params.verdict,
    reason: params.reason,
    reasonType: params.reasonType,
    botPredicted: params.botPredicted,
    rubricVersion: params.rubricVersion,
  });
  return { id };
}
