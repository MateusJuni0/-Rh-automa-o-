import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/** IDs fixos do seed (deterministas → idempotência). */
export const SEED_IDS = {
  agency: "11111111-0000-4000-8000-000000000001",
  recruiterFilipa: "22222222-0000-4000-8000-000000000001",
  recruiterInes: "22222222-0000-4000-8000-000000000002",
  client: "44444444-0000-4000-8000-000000000001",
  job: "55555555-0000-4000-8000-000000000001",
  jobWaiting: "55555555-0000-4000-8000-000000000002",
  candidate: "66666666-0000-4000-8000-000000000001",
  candidateMarta: "66666666-0000-4000-8000-000000000002",
  process: "77777777-0000-4000-8000-000000000001",
  processMarta: "77777777-0000-4000-8000-000000000002",
  interviewSoon: "88888888-0000-4000-8000-000000000001",
  interviewLater: "88888888-0000-4000-8000-000000000002",
  interviewJoaoDone: "88888888-0000-4000-8000-000000000003",
  interviewMartaDone: "88888888-0000-4000-8000-000000000004",
} as const;

const FILIPA_USER_ID = "33333333-0000-4000-8000-000000000001";
const INES_USER_ID = "33333333-0000-4000-8000-000000000002";

/** "MM:SS" → milissegundos (para `start_ms`, ordenação robusta independente de `seq`). */
function msFromTs(ts: string): number {
  const [m, s] = ts.split(":").map((n) => Number.parseInt(n, 10));
  return ((m ?? 0) * 60 + (s ?? 0)) * 1000;
}

/** Uma fala diarizada da transcrição golden (Camada A). */
interface ChunkSeed {
  id: string;
  seq: number;
  speaker: "candidate" | "recruiter";
  ts: string;
  text: string;
}

/**
 * Transcrição golden do JOÃO (forte, honesto) — Dev Frontend React Pleno.
 * Os quotes dos factos aparecem VERBATIM aqui → o facto é rastreável à fala (anti-achismo).
 */
const JOAO_CHUNKS: ChunkSeed[] = [
  {
    id: "99999999-0000-4000-8000-000000000001",
    seq: 1,
    speaker: "recruiter",
    ts: "00:00",
    text: "Olá João, obrigada por vires. Vamos começar pela tua experiência com React?",
  },
  {
    id: "99999999-0000-4000-8000-000000000002",
    seq: 2,
    speaker: "candidate",
    ts: "00:09",
    text: "Claro. Trabalho com React há cerca de 5 anos, os últimos 3 muito focado em Next.js.",
  },
  {
    id: "99999999-0000-4000-8000-000000000003",
    seq: 3,
    speaker: "recruiter",
    ts: "11:58",
    text: "Dá-me um projeto concreto onde o React fez diferença.",
  },
  {
    id: "99999999-0000-4000-8000-000000000004",
    seq: 4,
    speaker: "candidate",
    ts: "12:34",
    text: "Liderei a migração de uma app de CRA para o Next.js App Router e o LCP caiu quase para metade.",
  },
  {
    id: "99999999-0000-4000-8000-000000000005",
    seq: 5,
    speaker: "recruiter",
    ts: "17:40",
    text: "E como organizas os componentes numa equipa?",
  },
  {
    id: "99999999-0000-4000-8000-000000000006",
    seq: 6,
    speaker: "candidate",
    ts: "18:02",
    text: "Mantemos um design system interno com mais de 80 componentes, Radix + Tailwind, é a base de tudo.",
  },
  {
    id: "99999999-0000-4000-8000-000000000007",
    seq: 7,
    speaker: "recruiter",
    ts: "23:30",
    text: "Como garantes qualidade? Falas-me de testes?",
  },
  {
    id: "99999999-0000-4000-8000-000000000008",
    seq: 8,
    speaker: "candidate",
    ts: "24:10",
    text: "Unitários sempre. E2E, confesso, é onde tenho menos horas de voo.",
  },
  {
    id: "99999999-0000-4000-8000-000000000009",
    seq: 9,
    speaker: "recruiter",
    ts: "25:02",
    text: "Perfeito, ficou claro. Obrigada João.",
  },
];

/**
 * Transcrição golden da MARTA (CV diz 4 anos de React; na entrevista assume ~1,5 anos).
 * A `contradiction` vs CV ancora-se ao chunk 2 — é a "Verdade vs CV" que o overlay mostra.
 */
const MARTA_CHUNKS: ChunkSeed[] = [
  {
    id: "99999999-0000-4000-8000-000000000101",
    seq: 1,
    speaker: "recruiter",
    ts: "00:00",
    text: "Olá Marta. No CV indicas 4 anos de React, certo?",
  },
  {
    id: "99999999-0000-4000-8000-000000000102",
    seq: 2,
    speaker: "candidate",
    ts: "00:11",
    text: "Sim… bom, na verdade React a sério foi mais ano e meio. Os outros anos foram sobretudo Vue.",
  },
  {
    id: "99999999-0000-4000-8000-000000000103",
    seq: 3,
    speaker: "recruiter",
    ts: "00:34",
    text: "Entendo. E como tem sido a transição para React?",
  },
  {
    id: "99999999-0000-4000-8000-000000000104",
    seq: 4,
    speaker: "candidate",
    ts: "00:46",
    text: "Tenho gostado, mas o TypeScript ainda estou a consolidar.",
  },
  {
    id: "99999999-0000-4000-8000-000000000105",
    seq: 5,
    speaker: "recruiter",
    ts: "08:15",
    text: "Conta-me algo que construíste em React.",
  },
  {
    id: "99999999-0000-4000-8000-000000000106",
    seq: 6,
    speaker: "candidate",
    ts: "08:30",
    text: "Refiz o dashboard de uma equipa em React + Vite, ainda em JavaScript.",
  },
  {
    id: "99999999-0000-4000-8000-000000000107",
    seq: 7,
    speaker: "recruiter",
    ts: "12:00",
    text: "Obrigada Marta, foi muito útil.",
  },
];

interface FactSeed {
  id: string;
  competencia: string;
  factText: string;
  quoteChunk: string; // id do chunk que prova o facto
  ts: string;
  level: "fraco" | "ok" | "forte";
  type: "statement" | "skill_demo" | "gap";
  naoSustentado?: boolean;
}

const JOAO_FACTS: FactSeed[] = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    competencia: "React / Next.js",
    factText: "Liderou a migração de CRA para Next.js (App Router), cortando o LCP em ~40%.",
    quoteChunk: "99999999-0000-4000-8000-000000000004",
    ts: "12:34",
    level: "forte",
    type: "skill_demo",
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000002",
    competencia: "Design systems",
    factText: "Mantém um design system interno com 80+ componentes (Radix + Tailwind).",
    quoteChunk: "99999999-0000-4000-8000-000000000006",
    ts: "18:02",
    level: "forte",
    type: "skill_demo",
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000003",
    competencia: "Testes E2E",
    factText: "Pouca prática em testes end-to-end; trabalhou sobretudo com unitários.",
    quoteChunk: "99999999-0000-4000-8000-000000000008",
    ts: "24:10",
    level: "fraco",
    type: "gap",
  },
];

const MARTA_FACTS: FactSeed[] = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000101",
    competencia: "React (experiência)",
    factText:
      "CV indica 4 anos de React, mas na entrevista assumiu ~1,5 anos a sério (resto em Vue).",
    quoteChunk: "99999999-0000-4000-8000-000000000102",
    ts: "00:11",
    level: "fraco",
    type: "gap",
    naoSustentado: true,
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000102",
    competencia: "TypeScript",
    factText: "TypeScript ainda em consolidação — assumido pela própria.",
    quoteChunk: "99999999-0000-4000-8000-000000000104",
    ts: "00:46",
    level: "fraco",
    type: "gap",
  },
];

const MARTA_CV_TEXT = `RESUMO
Frontend Engineer com 4 anos de experiência em React.

EXPERIÊNCIA
- Frontend Engineer — 4 anos a construir interfaces em React.
- Stack: React, JavaScript, Vue, CSS.`;

/**
 * Seed de dev (INFRA-E-MIGRACAO §8): 1 agência IRIS + Filipa/Inês + 1 cliente + 1 vaga +
 * 2 candidatos (João forte, Marta com contradição vs CV) + processos + entrevistas agendadas
 * E entrevistas `done` com transcrição diarizada, factos com prova e 1 contradição.
 * Idempotente (UUIDs fixos + `onConflictDoNothing`) — re-correr não duplica.
 */
export async function seed(db: NodePgDatabase<typeof schema>): Promise<typeof SEED_IDS> {
  await db
    .insert(schema.agency)
    .values({ id: SEED_IDS.agency, name: "IRIS Tech" })
    .onConflictDoNothing();

  await db
    .insert(schema.recruiter)
    .values([
      {
        id: SEED_IDS.recruiterFilipa,
        agencyId: SEED_IDS.agency,
        userId: FILIPA_USER_ID,
        name: "Filipa",
      },
      { id: SEED_IDS.recruiterInes, agencyId: SEED_IDS.agency, userId: INES_USER_ID, name: "Inês" },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.client)
    .values({ id: SEED_IDS.client, agencyId: SEED_IDS.agency, name: "TechCorp (demo)" })
    .onConflictDoNothing();

  await db
    .insert(schema.job)
    .values({
      id: SEED_IDS.job,
      agencyId: SEED_IDS.agency,
      clientId: SEED_IDS.client,
      recruiterId: SEED_IDS.recruiterFilipa,
      title: "Dev Frontend React Pleno",
      roleTypeSlug: "dev_frontend_react_pleno",
      requirements: { must: ["React", "TypeScript"], nice: ["Next.js"] },
    })
    .onConflictDoNothing();

  // Vaga SEM candidatos (demo da secção "Vagas à espera" no painel).
  await db
    .insert(schema.job)
    .values({
      id: SEED_IDS.jobWaiting,
      agencyId: SEED_IDS.agency,
      clientId: SEED_IDS.client,
      recruiterId: SEED_IDS.recruiterFilipa,
      title: "Backend Python Sénior",
      roleTypeSlug: "dev_backend_python_senior",
      requirements: { must: ["Python", "PostgreSQL"], nice: ["FastAPI"] },
    })
    .onConflictDoNothing();

  // 2 candidatos: João (forte, honesto) e Marta (CV sobredimensiona React).
  await db
    .insert(schema.candidate)
    .values([
      {
        id: SEED_IDS.candidate,
        agencyId: SEED_IDS.agency,
        name: "João Demonstração",
        nameNormalized: "joao demonstracao",
        email: "joao.demo@example.com",
        profile: {
          skillsDeclaradas: ["React", "TypeScript", "Next.js", "Design systems"],
          experienciaAnos: 5,
          gapsCv: ["Pouca prática em testes end-to-end"],
          resumo:
            "Frontend sénior com 5 anos, forte em React/Next.js e design systems. Lidera migrações e cuida da performance.",
        },
      },
      {
        id: SEED_IDS.candidateMarta,
        agencyId: SEED_IDS.agency,
        name: "Marta Ferreira",
        nameNormalized: "marta ferreira",
        email: "marta.ferreira@example.com",
        profile: {
          skillsDeclaradas: ["React", "Vue", "JavaScript"],
          experienciaAnos: 4,
          gapsCv: ["TypeScript ainda em consolidação"],
          resumo:
            "Frontend com 4 anos (transição de Vue para React). Em consolidação de TypeScript.",
        },
      },
    ])
    .onConflictDoNothing();

  // Enriquece o perfil mesmo em DBs onde o candidato já existia sem `profile` (idempotente).
  await db
    .update(schema.candidate)
    .set({
      profile: {
        skillsDeclaradas: ["React", "TypeScript", "Next.js", "Design systems"],
        experienciaAnos: 5,
        gapsCv: ["Pouca prática em testes end-to-end"],
        resumo:
          "Frontend sénior com 5 anos, forte em React/Next.js e design systems. Lidera migrações e cuida da performance.",
      },
    })
    .where(eq(schema.candidate.id, SEED_IDS.candidate));

  // CV bruto da Marta (o card "CV — texto original" mostra-o; e prova o "4 anos" que a entrevista desmente).
  await db
    .insert(schema.sourceDoc)
    .values({
      id: "dddddddd-0000-4000-8000-000000000001",
      agencyId: SEED_IDS.agency,
      kind: "cv",
      candidateId: SEED_IDS.candidateMarta,
      rawText: MARTA_CV_TEXT,
      title: "CV — Marta Ferreira",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.process)
    .values([
      {
        id: SEED_IDS.process,
        agencyId: SEED_IDS.agency,
        candidateId: SEED_IDS.candidate,
        jobId: SEED_IDS.job,
        recruiterId: SEED_IDS.recruiterFilipa,
        stage: "interview",
      },
      {
        id: SEED_IDS.processMarta,
        agencyId: SEED_IDS.agency,
        candidateId: SEED_IDS.candidateMarta,
        jobId: SEED_IDS.job,
        recruiterId: SEED_IDS.recruiterFilipa,
        stage: "screening",
      },
    ])
    .onConflictDoNothing();

  // Entrevistas: 2 agendadas (agenda do painel) + 2 `done` (com transcrição → o que a Filipa revê).
  const now = Date.now();
  await db
    .insert(schema.interview)
    .values([
      {
        id: SEED_IDS.interviewSoon,
        agencyId: SEED_IDS.agency,
        processId: SEED_IDS.process,
        candidateId: SEED_IDS.candidate,
        recruiterId: SEED_IDS.recruiterFilipa,
        status: "scheduled",
        startedAt: new Date(now + 35 * 60 * 1000),
      },
      {
        id: SEED_IDS.interviewLater,
        agencyId: SEED_IDS.agency,
        processId: SEED_IDS.processMarta,
        candidateId: SEED_IDS.candidateMarta,
        recruiterId: SEED_IDS.recruiterFilipa,
        status: "scheduled",
        startedAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: SEED_IDS.interviewJoaoDone,
        agencyId: SEED_IDS.agency,
        processId: SEED_IDS.process,
        candidateId: SEED_IDS.candidate,
        recruiterId: SEED_IDS.recruiterFilipa,
        status: "done",
        captureType: "bot_online",
        startedAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        endedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 26 * 60 * 1000),
        distilledAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      },
      {
        id: SEED_IDS.interviewMartaDone,
        agencyId: SEED_IDS.agency,
        processId: SEED_IDS.processMarta,
        candidateId: SEED_IDS.candidateMarta,
        recruiterId: SEED_IDS.recruiterFilipa,
        status: "done",
        captureType: "bot_online",
        startedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
        endedAt: new Date(now - 1 * 24 * 60 * 60 * 1000 + 13 * 60 * 1000),
        distilledAt: new Date(now - 1 * 24 * 60 * 60 * 1000 + 16 * 60 * 1000),
      },
    ])
    .onConflictDoNothing();

  // Transcrição diarizada (Camada A) das 2 entrevistas done.
  const chunkRows = [
    ...JOAO_CHUNKS.map((c) => ({ c, interviewId: SEED_IDS.interviewJoaoDone })),
    ...MARTA_CHUNKS.map((c) => ({ c, interviewId: SEED_IDS.interviewMartaDone })),
  ].map(({ c, interviewId }) => ({
    id: c.id,
    interviewId,
    agencyId: SEED_IDS.agency,
    seq: c.seq,
    speaker: c.speaker,
    speakerLabel: c.speaker === "recruiter" ? "Filipa" : null,
    tsStart: c.ts,
    text: c.text,
    startMs: msFromTs(c.ts),
    isFinal: true,
  }));
  await db.insert(schema.transcriptChunk).values(chunkRows).onConflictDoNothing();

  // Factos destilados com PROVA ancorada ao chunk (proveniência §16A).
  const factRows = [
    ...JOAO_FACTS.map((f) => ({ f, candidateId: SEED_IDS.candidate, processId: SEED_IDS.process })),
    ...MARTA_FACTS.map((f) => ({
      f,
      candidateId: SEED_IDS.candidateMarta,
      processId: SEED_IDS.processMarta,
    })),
  ].map(({ f, candidateId, processId }) => ({
    id: f.id,
    candidateId,
    agencyId: SEED_IDS.agency,
    processId,
    competencia: f.competencia,
    factText: f.factText,
    evidenceQuote:
      JOAO_CHUNKS.concat(MARTA_CHUNKS).find((c) => c.id === f.quoteChunk)?.text ?? null,
    evidenceTs: f.ts,
    speaker: "candidate" as const,
    factType: f.type,
    rubricLevel: f.level,
    sourceType: "interview" as const,
    sourceChunkId: [f.quoteChunk],
    naoSustentado: f.naoSustentado ?? false,
  }));
  await db.insert(schema.candidateMemoryFact).values(factRows).onConflictDoNothing();

  // Contradição vs CV da Marta — "Verdade vs CV" ancorada à fala (chunk 2).
  await db
    .insert(schema.contradiction)
    .values({
      id: "bbbbbbbb-0000-4000-8000-000000000001",
      agencyId: SEED_IDS.agency,
      processId: SEED_IDS.processMarta,
      requisito: "Experiência com React",
      tipo: "vs_cv",
      chunkA: "99999999-0000-4000-8000-000000000102",
      divergenceOrigin: "candidate",
      detalhe:
        "CV indica 4 anos de React; na entrevista assumiu ~1,5 anos a sério (restante em Vue).",
    })
    .onConflictDoNothing();

  return SEED_IDS;
}
