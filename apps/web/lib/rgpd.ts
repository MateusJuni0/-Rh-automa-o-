import type { DbHandle } from "@rh/db";
import { schema as s } from "@rh/db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

type Db = DbHandle["db"];

export interface PurgeSummary {
  candidateId: string;
  /** `true` se o candidato existia nesta agência e foi anonimizado; `false` = no-op (não encontrado / outra agência). */
  anonymized: boolean;
  /** Linhas MANTIDAS sem PII (âncora + ground-truth de calibração + custo operacional). */
  preserved: Record<string, number>;
  /** Linhas MANTIDAS com o payload PII limpo (auditoria + sessões de intake). */
  redacted: Record<string, number>;
  /** Linhas APAGADAS (PII bruta). */
  removed: Record<string, number>;
}

/**
 * Apagamento de candidato (RGPD Art.17) = **ANONIMIZAR**, não destruir o sinal (DATA-RETENTION §3.2/§6).
 * Numa transação, isolada por `agencyId` (NUNCA toca noutra agência). Três regimes da matriz (§ topo):
 *
 *  🔴 **apaga** a PII bruta — transcrição (`transcript_chunk`), `interview_gap`/`participant`, factos,
 *     CVs/documentos, source-docs, `intake_message`, conversa do assistente (threads/mensagens),
 *     async-jobs, `agenda_event`, `contradiction`, e as entrevistas SEM parecer. Embeddings caem por
 *     `onDelete: cascade`.
 *  🟢 **preserva sem PII** o ground-truth (§1.6): `client_verdict` + `placement_outcome` (limpa o texto
 *     livre `reason`/`decline_reason`); `report` anonimizado (NULL no conteúdo livre, mantém veredito,
 *     §4 "report existe sem PII"); a `interview` do parecer (limpa `livekit_room`); o `interview_tick`
 *     das entrevistas preservadas (limpa `live_state`/`suggestion`, MANTÉM custo/tokens — §1.6); e o
 *     `process` (FK do verdict/outcome; limpa motivo/refs).
 *  ⚖️ **redige** (mantém a linha): `assistant_action` (limpa `args`/`result_ref`, solta o `thread_id`)
 *     e `intake_session` (limpa `messages_raw`/`extraction`, mantém a linha pelas FKs das mensagens).
 *  Por fim, **anonimiza** o `candidate`: mantém a linha como âncora anónima dos outcomes, carimba
 *     `anonymized_at`/`deleted_at` e limpa name/email/phone/linkedin/profile.
 *
 * NOTA: factos `candidate_memory_fact` saem TODOS (pessoal E profissional — DATA-RETENTION §3.2/4: a
 * memória de valor sai com a PII do titular). A "entrevista sem parecer" (não a "órfã") é o que se
 * apaga — uma órfã COM parecer é preservada pela partição keep/drop abaixo.
 *
 * Escopo Ω (deferido, continua PII-safe): redação-com-hash do `transcript_chunk` (§3.2/4) — aqui é
 * apagado; carimbo `anonymized_at` por-`report`; isolamento SERIALIZABLE; Storage/pgvector REINDEX.
 */
export async function purgeCandidate(
  db: Db,
  agencyId: string,
  candidateId: string,
): Promise<PurgeSummary> {
  return db.transaction(async (tx) => {
    const preserved: Record<string, number> = {};
    const redacted: Record<string, number> = {};
    const removed: Record<string, number> = {};
    const n = (rows: { id: string }[]): number => rows.length;

    // Subárvore (agency-scoped): processos do candidato.
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

    // Entrevistas a PRESERVAR = as que têm parecer (FK report→interview obriga a manter a interview).
    // As restantes (sem parecer) não têm ground-truth → apagam-se. (report.interview_id é UNIQUE.)
    const keepInterviewIds = (
      interviewIds.length > 0
        ? await tx
            .select({ interviewId: s.report.interviewId })
            .from(s.report)
            .where(inArray(s.report.interviewId, interviewIds))
        : []
    ).map((r) => r.interviewId);
    const dropInterviewIds = interviewIds.filter((id) => !keepInterviewIds.includes(id));

    // Chunks de TODAS as entrevistas (a Camada A é PII bruta; embeddings caem por cascade).
    const chunkIds = (
      interviewIds.length > 0
        ? await tx
            .select({ id: s.transcriptChunk.id })
            .from(s.transcriptChunk)
            .where(inArray(s.transcriptChunk.interviewId, interviewIds))
        : []
    ).map((r) => r.id);

    // 1) `contradiction` (PII no `detalhe`): por processo OU por chunk, numa só passagem ANTES de apagar
    //    chunks/documentos (FKs `chunk_a`/`chunk_b`/`cv_document_id` sem cascade) — contagem fiável.
    const contraConds = [
      ...(processIds.length > 0 ? [inArray(s.contradiction.processId, processIds)] : []),
      ...(chunkIds.length > 0
        ? [inArray(s.contradiction.chunkA, chunkIds), inArray(s.contradiction.chunkB, chunkIds)]
        : []),
    ];
    if (contraConds.length > 0) {
      removed.contradiction = n(
        await tx
          .delete(s.contradiction)
          .where(or(...contraConds))
          .returning({ id: s.contradiction.id }),
      );
    }

    // 2) Filhos PII das entrevistas (todas) + a transcrição.
    if (interviewIds.length > 0) {
      removed["proactive_task(iv)"] = n(
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
      removed.interview_gap = n(
        await tx
          .delete(s.interviewGap)
          .where(inArray(s.interviewGap.interviewId, interviewIds))
          .returning({ id: s.interviewGap.id }),
      );
      removed.interview_participant = n(
        await tx
          .delete(s.interviewParticipant)
          .where(inArray(s.interviewParticipant.interviewId, interviewIds))
          .returning({ id: s.interviewParticipant.id }),
      );
      removed.transcript_chunk = n(
        await tx
          .delete(s.transcriptChunk)
          .where(inArray(s.transcriptChunk.interviewId, interviewIds))
          .returning({ id: s.transcriptChunk.id }),
      );
    }

    // 3) interview_tick: PRESERVAR o custo (§1.6) nas entrevistas mantidas (limpa o estado vivo PII);
    //    apagar nas entrevistas sem parecer.
    if (keepInterviewIds.length > 0) {
      preserved.interview_tick = n(
        await tx
          .update(s.interviewTick)
          .set({ liveState: {}, suggestion: null })
          .where(inArray(s.interviewTick.interviewId, keepInterviewIds))
          .returning({ id: s.interviewTick.id }),
      );
    }
    if (dropInterviewIds.length > 0) {
      removed.interview_tick = n(
        await tx
          .delete(s.interviewTick)
          .where(inArray(s.interviewTick.interviewId, dropInterviewIds))
          .returning({ id: s.interviewTick.id }),
      );
    }

    // 4) Parecer + a sua interview: PRESERVAR anonimizado (existe sem PII, §4/§6).
    if (keepInterviewIds.length > 0) {
      preserved.report = n(
        await tx
          .update(s.report)
          .set({
            contentMd: null,
            contentEdited: null,
            contentClientMd: null,
            filipaOverrideReason: null,
            staleReason: null,
          })
          .where(inArray(s.report.interviewId, keepInterviewIds))
          .returning({ id: s.report.id }),
      );
      // A interview mantida (FK do parecer): limpa o identificador de sala (pode conter PII).
      preserved.interview = n(
        await tx
          .update(s.interview)
          .set({ livekitRoom: null })
          .where(inArray(s.interview.id, keepInterviewIds))
          .returning({ id: s.interview.id }),
      );
    }

    // 5) Entrevistas SEM parecer: apagar a linha (sem valor de calibração).
    if (dropInterviewIds.length > 0) {
      removed.interview = n(
        await tx
          .delete(s.interview)
          .where(inArray(s.interview.id, dropInterviewIds))
          .returning({ id: s.interview.id }),
      );
    }

    // 6) Por processo: PRESERVAR ground-truth (limpa PII); apagar derivados; PRESERVAR o process.
    if (processIds.length > 0) {
      preserved.client_verdict = n(
        await tx
          .update(s.clientVerdict)
          .set({ reason: null })
          .where(inArray(s.clientVerdict.processId, processIds))
          .returning({ id: s.clientVerdict.id }),
      );
      preserved.placement_outcome = n(
        await tx
          .update(s.placementOutcome)
          .set({ declineReason: null })
          .where(inArray(s.placementOutcome.processId, processIds))
          .returning({ id: s.placementOutcome.id }),
      );
      removed.agenda_event = n(
        await tx
          .delete(s.agendaEvent)
          .where(inArray(s.agendaEvent.processId, processIds))
          .returning({ id: s.agendaEvent.id }),
      );
      removed["proactive_task(process)"] = n(
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
      preserved.process = n(
        await tx
          .update(s.process)
          .set({ statusReason: null, consentEvidenceRef: null })
          .where(inArray(s.process.id, processIds))
          .returning({ id: s.process.id }),
      );
    }

    // 7) PII direta do candidato. Documentos: limpa o self-ref `based_on` antes de apagar (qualquer
    //    documento que aponte a estes — inclui outros do candidato; sem `agencyId` de propósito, senão
    //    uma FK sobrevivia a apontar a uma linha apagada).
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
    removed.candidate_memory_fact = n(
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
    removed.source_doc = n(
      await tx
        .delete(s.sourceDoc)
        .where(and(eq(s.sourceDoc.candidateId, candidateId), eq(s.sourceDoc.agencyId, agencyId)))
        .returning({ id: s.sourceDoc.id }),
    );
    removed.document = n(
      await tx
        .delete(s.document)
        .where(and(eq(s.document.candidateId, candidateId), eq(s.document.agencyId, agencyId)))
        .returning({ id: s.document.id }),
    );

    // 8) PII polimórfica (sem FK): proactive_task + intake_message. As sessões de intake (PII no
    //    `messages_raw`) são redigidas — manter a linha pelas FKs das mensagens que sobrevivem.
    removed["proactive_task(candidate)"] = n(
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
    const intakeCond = and(
      eq(s.intakeMessage.agencyId, agencyId),
      or(
        and(eq(s.intakeMessage.alvo, "candidato"), eq(s.intakeMessage.alvoId, candidateId)),
        and(
          eq(s.intakeMessage.entityType, "candidate_cv"),
          eq(s.intakeMessage.entityId, candidateId),
        ),
      ),
    );
    const intakeSessionIds = [
      ...new Set(
        (
          await tx
            .select({ sessionId: s.intakeMessage.sessionId })
            .from(s.intakeMessage)
            .where(intakeCond)
        )
          .map((r) => r.sessionId)
          .filter((id): id is string => id !== null),
      ),
    ];
    removed.intake_message = n(
      await tx.delete(s.intakeMessage).where(intakeCond).returning({ id: s.intakeMessage.id }),
    );
    if (intakeSessionIds.length > 0) {
      redacted.intake_session = n(
        await tx
          .update(s.intakeSession)
          .set({ messagesRaw: [], extraction: null })
          .where(
            and(
              eq(s.intakeSession.agencyId, agencyId),
              inArray(s.intakeSession.id, intakeSessionIds),
            ),
          )
          .returning({ id: s.intakeSession.id }),
      );
    }

    // 9) Assistente ligado ao candidato + async_job com PII no JSONB (candidate_id, migração 0002).
    //   Threads do candidato = active_context->>'candidate_id' == candidato.
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
    // async_job: por candidato OU por thread, numa só passagem (antes de apagar a thread) — sem double-count.
    const asyncConds = [
      and(eq(s.asyncJob.agencyId, agencyId), eq(s.asyncJob.candidateId, candidateId)),
      ...(threadIds.length > 0 ? [inArray(s.asyncJob.threadId, threadIds)] : []),
    ];
    removed.async_job = n(
      await tx
        .delete(s.asyncJob)
        .where(or(...asyncConds))
        .returning({ id: s.asyncJob.id }),
    );
    if (threadIds.length > 0) {
      removed.assistant_message = n(
        await tx
          .delete(s.assistantMessage)
          .where(inArray(s.assistantMessage.threadId, threadIds))
          .returning({ id: s.assistantMessage.id }),
      );
      // Auditoria ⚖️: a LINHA sobrevive — limpa payload (args), referência (result_ref) e solta a thread.
      redacted.assistant_action = n(
        await tx
          .update(s.assistantAction)
          .set({ args: {}, threadId: null, resultRef: null })
          .where(inArray(s.assistantAction.threadId, threadIds))
          .returning({ id: s.assistantAction.id }),
      );
      removed.assistant_thread = n(
        await tx
          .delete(s.assistantThread)
          .where(inArray(s.assistantThread.id, threadIds))
          .returning({ id: s.assistantThread.id }),
      );
    }

    // 10) O candidato: ANONIMIZAR (manter a linha como âncora anónima — isolado por agência).
    const now = new Date();
    const anonRows = await tx
      .update(s.candidate)
      .set({
        name: "[anonimizado]",
        nameNormalized: null,
        email: null,
        phone: null,
        linkedinUrl: null,
        profile: {},
        anonymizedAt: now,
        deletedAt: now,
      })
      .where(and(eq(s.candidate.id, candidateId), eq(s.candidate.agencyId, agencyId)))
      .returning({ id: s.candidate.id });
    const anonymized = anonRows.length > 0;
    if (anonymized) {
      preserved.candidate = anonRows.length;
    }

    return { candidateId, anonymized, preserved, redacted, removed };
  });
}
