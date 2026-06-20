import type { DbHandle } from "@rh/db";
import { schema as s } from "@rh/db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

type Db = DbHandle["db"];

export interface PurgeSummary {
  candidateId: string;
  removed: Record<string, number>;
}

/**
 * Purga RGPD (direito ao esquecimento): apaga o candidato + TODA a PII em cascata, numa transação,
 * isolado por `agencyId` (NUNCA toca noutra agência). HARD delete (LEGAL-E-RGPD: soft-delete +
 * `purge_after` → este é o passo final do hard-delete). Embeddings (memory/sourceDoc/transcript)
 * caem por `onDelete: cascade` dos FKs. Ordem: filhos → pais. Inclui PII polimórfica sem FK
 * (proactive_task por target, intake_message por alvo/entity).
 *
 * COBERTURA Ω-1 (migração 0002 candidate_id): (a) `async_job WHERE candidate_id` (PII no JSONB args);
 * (b) threads/mensagens/ações do assistente ligadas ao candidato (via `active_context->>'candidate_id'`);
 * (c) entrevistas órfãs (`process_id IS NULL`) atribuídas pelo `interview.candidate_id`.
 *
 * Ligação assistente↔candidato (decisão Ω-1): uma thread "pertence" ao candidato sse o seu
 * `active_context->>'candidate_id'` for o candidato. Apaga-se a thread inteira (mensagens, ações,
 * jobs por thread) — o texto livre das mensagens fica assim coberto sem varrer NLP. async_job
 * também é apagado por `candidate_id` direto (cobre jobs sem thread).
 */
export async function purgeCandidate(
  db: Db,
  agencyId: string,
  candidateId: string,
): Promise<PurgeSummary> {
  return db.transaction(async (tx) => {
    const removed: Record<string, number> = {};
    const mark = (label: string, rows: { id: string }[]): void => {
      removed[label] = rows.length;
    };

    // Subárvore (agency-scoped): processos do candidato → entrevistas desses processos.
    const processIds = (
      await tx
        .select({ id: s.process.id })
        .from(s.process)
        .where(and(eq(s.process.candidateId, candidateId), eq(s.process.agencyId, agencyId)))
    ).map((r) => r.id);

    // Entrevistas do candidato: via processo (subárvore) + órfãs atribuídas (candidate_id, process NULL).
    const ivViaProcess =
      processIds.length > 0
        ? await tx
            .select({ id: s.interview.id })
            .from(s.interview)
            .where(inArray(s.interview.processId, processIds))
        : [];
    const ivOrphan = await tx
      .select({ id: s.interview.id })
      .from(s.interview)
      .where(
        and(
          eq(s.interview.agencyId, agencyId),
          eq(s.interview.candidateId, candidateId),
          isNull(s.interview.processId),
        ),
      );
    const interviewIds = [...new Set([...ivViaProcess, ...ivOrphan].map((r) => r.id))];

    // 1) Filhos das entrevistas (transcript_chunk arrasta o embedding por cascade).
    if (interviewIds.length > 0) {
      // contradiction → chunk (FK sem cascade): apagar ANTES dos chunks p/ não violar FK.
      const chunkIds = (
        await tx
          .select({ id: s.transcriptChunk.id })
          .from(s.transcriptChunk)
          .where(inArray(s.transcriptChunk.interviewId, interviewIds))
      ).map((r) => r.id);
      if (chunkIds.length > 0) {
        mark(
          "contradiction(chunk)",
          await tx
            .delete(s.contradiction)
            .where(
              or(
                inArray(s.contradiction.chunkA, chunkIds),
                inArray(s.contradiction.chunkB, chunkIds),
              ),
            )
            .returning({ id: s.contradiction.id }),
        );
      }
      mark(
        "proactive_task(iv)",
        await tx
          .delete(s.proactiveTask)
          .where(
            and(
              eq(s.proactiveTask.targetType, "interview"),
              inArray(s.proactiveTask.targetId, interviewIds),
            ),
          )
          .returning({ id: s.proactiveTask.id }),
      );
      mark(
        "interview_tick",
        await tx
          .delete(s.interviewTick)
          .where(inArray(s.interviewTick.interviewId, interviewIds))
          .returning({ id: s.interviewTick.id }),
      );
      mark(
        "interview_gap",
        await tx
          .delete(s.interviewGap)
          .where(inArray(s.interviewGap.interviewId, interviewIds))
          .returning({ id: s.interviewGap.id }),
      );
      mark(
        "interview_participant",
        await tx
          .delete(s.interviewParticipant)
          .where(inArray(s.interviewParticipant.interviewId, interviewIds))
          .returning({ id: s.interviewParticipant.id }),
      );
      mark(
        "report",
        await tx
          .delete(s.report)
          .where(inArray(s.report.interviewId, interviewIds))
          .returning({ id: s.report.id }),
      );
      mark(
        "transcript_chunk(iv)",
        await tx
          .delete(s.transcriptChunk)
          .where(inArray(s.transcriptChunk.interviewId, interviewIds))
          .returning({ id: s.transcriptChunk.id }),
      );
    }

    // 2) As entrevistas (via-processo + órfãs), depois os filhos dos processos e os processos.
    if (interviewIds.length > 0) {
      mark(
        "interview",
        await tx
          .delete(s.interview)
          .where(inArray(s.interview.id, interviewIds))
          .returning({ id: s.interview.id }),
      );
    }
    if (processIds.length > 0) {
      mark(
        "client_verdict",
        await tx
          .delete(s.clientVerdict)
          .where(inArray(s.clientVerdict.processId, processIds))
          .returning({ id: s.clientVerdict.id }),
      );
      mark(
        "placement_outcome",
        await tx
          .delete(s.placementOutcome)
          .where(inArray(s.placementOutcome.processId, processIds))
          .returning({ id: s.placementOutcome.id }),
      );
      mark(
        "agenda_event",
        await tx
          .delete(s.agendaEvent)
          .where(inArray(s.agendaEvent.processId, processIds))
          .returning({ id: s.agendaEvent.id }),
      );
      mark(
        "contradiction",
        await tx
          .delete(s.contradiction)
          .where(inArray(s.contradiction.processId, processIds))
          .returning({ id: s.contradiction.id }),
      );
      mark(
        "proactive_task(process)",
        await tx
          .delete(s.proactiveTask)
          .where(
            and(
              eq(s.proactiveTask.targetType, "process"),
              inArray(s.proactiveTask.targetId, processIds),
            ),
          )
          .returning({ id: s.proactiveTask.id }),
      );
      mark(
        "process",
        await tx
          .delete(s.process)
          .where(inArray(s.process.id, processIds))
          .returning({ id: s.process.id }),
      );
    }

    // 3) PII direta do candidato. Documentos: limpa o self-ref `based_on` antes de apagar.
    const docIds = (
      await tx
        .select({ id: s.document.id })
        .from(s.document)
        .where(and(eq(s.document.candidateId, candidateId), eq(s.document.agencyId, agencyId)))
    ).map((r) => r.id);
    if (docIds.length > 0) {
      await tx
        .update(s.document)
        .set({ basedOnDocumentId: null })
        .where(inArray(s.document.basedOnDocumentId, docIds));
    }
    mark(
      "candidate_memory_fact",
      await tx
        .delete(s.candidateMemoryFact)
        .where(
          and(
            eq(s.candidateMemoryFact.candidateId, candidateId),
            eq(s.candidateMemoryFact.agencyId, agencyId),
          ),
        )
        .returning({ id: s.candidateMemoryFact.id }),
    );
    mark(
      "source_doc",
      await tx
        .delete(s.sourceDoc)
        .where(and(eq(s.sourceDoc.candidateId, candidateId), eq(s.sourceDoc.agencyId, agencyId)))
        .returning({ id: s.sourceDoc.id }),
    );
    mark(
      "document",
      await tx
        .delete(s.document)
        .where(and(eq(s.document.candidateId, candidateId), eq(s.document.agencyId, agencyId)))
        .returning({ id: s.document.id }),
    );

    // 3b) PII polimórfica (sem FK) que aponta ao candidato: proactive_task + intake_message.
    mark(
      "proactive_task(candidate)",
      await tx
        .delete(s.proactiveTask)
        .where(
          and(
            eq(s.proactiveTask.agencyId, agencyId),
            eq(s.proactiveTask.targetType, "candidate"),
            eq(s.proactiveTask.targetId, candidateId),
          ),
        )
        .returning({ id: s.proactiveTask.id }),
    );
    mark(
      "intake_message",
      await tx
        .delete(s.intakeMessage)
        .where(
          and(
            eq(s.intakeMessage.agencyId, agencyId),
            or(
              and(eq(s.intakeMessage.alvo, "candidato"), eq(s.intakeMessage.alvoId, candidateId)),
              and(
                eq(s.intakeMessage.entityType, "candidate_cv"),
                eq(s.intakeMessage.entityId, candidateId),
              ),
            ),
          ),
        )
        .returning({ id: s.intakeMessage.id }),
    );

    // 3c) Assistente ligado ao candidato + async_job com PII no JSONB (candidate_id, migração 0002).
    //   Threads do candidato = active_context->>'candidate_id' == candidato. Apaga filhos→thread.
    const threadIds = (
      await tx
        .select({ id: s.assistantThread.id })
        .from(s.assistantThread)
        .where(
          and(
            eq(s.assistantThread.agencyId, agencyId),
            sql`${s.assistantThread.activeContext}->>'candidate_id' = ${candidateId}`,
          ),
        )
    ).map((r) => r.id);
    mark(
      "async_job(candidate)",
      await tx
        .delete(s.asyncJob)
        .where(and(eq(s.asyncJob.agencyId, agencyId), eq(s.asyncJob.candidateId, candidateId)))
        .returning({ id: s.asyncJob.id }),
    );
    if (threadIds.length > 0) {
      mark(
        "assistant_message",
        await tx
          .delete(s.assistantMessage)
          .where(inArray(s.assistantMessage.threadId, threadIds))
          .returning({ id: s.assistantMessage.id }),
      );
      mark(
        "assistant_action",
        await tx
          .delete(s.assistantAction)
          .where(inArray(s.assistantAction.threadId, threadIds))
          .returning({ id: s.assistantAction.id }),
      );
      // jobs ligados à thread (além dos já apagados por candidate_id) — evita violar FK threadId.
      mark(
        "async_job(thread)",
        await tx
          .delete(s.asyncJob)
          .where(inArray(s.asyncJob.threadId, threadIds))
          .returning({ id: s.asyncJob.id }),
      );
      mark(
        "assistant_thread",
        await tx
          .delete(s.assistantThread)
          .where(inArray(s.assistantThread.id, threadIds))
          .returning({ id: s.assistantThread.id }),
      );
    }

    // 4) O candidato (isolado por agência — cross-agency é no-op).
    mark(
      "candidate",
      await tx
        .delete(s.candidate)
        .where(and(eq(s.candidate.id, candidateId), eq(s.candidate.agencyId, agencyId)))
        .returning({ id: s.candidate.id }),
    );

    return { candidateId, removed };
  });
}
