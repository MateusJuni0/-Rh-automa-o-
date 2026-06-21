import type { DbHandle } from "@rh/db";
import { getCandidato } from "../candidatos";
import { getCliente } from "../clientes";
import { buildCandidateAnswer, buildClientAnswer, type QaAnswer } from "./qa";

type Db = DbHandle["db"];

export interface QaInput {
  entityType: "candidate" | "client";
  entityId: string;
  question: string;
}

/**
 * Responde a uma pergunta sobre UMA entidade, reusando os factos que a ficha de detalhe já carrega
 * (sem 2.ª query). Devolve `null` se a entidade não existir nesta agência (→ 404 na rota).
 * Isolamento por `agency_id` herdado de `getCandidato`/`getCliente`.
 */
export async function answerAboutEntity(
  db: Db,
  agencyId: string,
  input: QaInput,
): Promise<QaAnswer | null> {
  if (input.entityType === "candidate") {
    const cand = await getCandidato(db, agencyId, input.entityId);
    if (!cand) {
      return null;
    }
    return buildCandidateAnswer(input.question, cand.factos);
  }
  const cli = await getCliente(db, agencyId, input.entityId);
  if (!cli) {
    return null;
  }
  return buildClientAnswer(input.question, cli.factosComProva);
}
