import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, asc, desc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";

type Db = DbHandle["db"];

export interface DashboardStats {
  vagasAbertas: number;
  candidatosAtivos: number;
  entrevistasAgendadas: number;
  processosAtivos: number;
}

export interface VagaEspera {
  id: string;
  title: string;
  clientName: string | null;
  diasAberta: number;
}

export interface EntrevistaAgenda {
  id: string;
  candidateName: string | null;
  jobTitle: string | null;
  startedAt: Date | null;
  status: string;
}

export interface DashboardData {
  stats: DashboardStats;
  vagasSemCandidatos: VagaEspera[];
  proximasEntrevistas: EntrevistaAgenda[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dados do painel (QG da Filipa) — TUDO de dados reais (isolado por agência):
 * - KPIs (vagas/candidatos/entrevistas/processos ativos)
 * - vagas SEM ninguém no funil ("clientes à espera")
 * - próximas entrevistas agendadas/ao vivo (agenda)
 */
export async function getDashboard(db: Db, agencyId: string): Promise<DashboardData> {
  const [vagasAbertas, candidatosAtivos, entrevistasAgendadas, processosAtivos] = await Promise.all(
    [
      db.$count(schema.job, and(eq(schema.job.agencyId, agencyId), isNull(schema.job.deletedAt))),
      db.$count(
        schema.candidate,
        and(eq(schema.candidate.agencyId, agencyId), isNull(schema.candidate.deletedAt)),
      ),
      db.$count(
        schema.interview,
        and(
          eq(schema.interview.agencyId, agencyId),
          inArray(schema.interview.status, ["scheduled", "live"]),
        ),
      ),
      db.$count(
        schema.process,
        and(eq(schema.process.agencyId, agencyId), isNull(schema.process.deletedAt)),
      ),
    ],
  );

  const semCandidatosRows = await db
    .select({
      id: schema.job.id,
      title: schema.job.title,
      clientName: schema.client.name,
      createdAt: schema.job.createdAt,
    })
    .from(schema.job)
    .leftJoin(schema.client, eq(schema.client.id, schema.job.clientId))
    .where(
      and(
        eq(schema.job.agencyId, agencyId),
        isNull(schema.job.deletedAt),
        // NENHUM processo (não-apagado) liga esta vaga a um candidato → ninguém no funil.
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.process)
            .where(and(eq(schema.process.jobId, schema.job.id), isNull(schema.process.deletedAt))),
        ),
      ),
    )
    .orderBy(desc(schema.job.createdAt));

  const now = Date.now();
  const vagasSemCandidatos: VagaEspera[] = semCandidatosRows.map((r) => ({
    id: r.id,
    title: r.title,
    clientName: r.clientName,
    diasAberta: r.createdAt ? Math.max(0, Math.floor((now - r.createdAt.getTime()) / DAY_MS)) : 0,
  }));

  const proximasEntrevistas: EntrevistaAgenda[] = await db
    .select({
      id: schema.interview.id,
      status: schema.interview.status,
      startedAt: schema.interview.startedAt,
      candidateName: schema.candidate.name,
      jobTitle: schema.job.title,
    })
    .from(schema.interview)
    .leftJoin(schema.process, eq(schema.process.id, schema.interview.processId))
    .leftJoin(schema.job, eq(schema.job.id, schema.process.jobId))
    .leftJoin(schema.candidate, eq(schema.candidate.id, schema.interview.candidateId))
    .where(
      and(
        eq(schema.interview.agencyId, agencyId),
        inArray(schema.interview.status, ["scheduled", "live"]),
      ),
    )
    .orderBy(asc(schema.interview.startedAt))
    .limit(6);

  return {
    stats: { vagasAbertas, candidatosAtivos, entrevistasAgendadas, processosAtivos },
    vagasSemCandidatos,
    proximasEntrevistas,
  };
}
