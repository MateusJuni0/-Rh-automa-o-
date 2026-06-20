/**
 * Seed DEMO rico (IRIS Tech) — clientes, candidatos com perfis COMPLETOS, vagas com requisitos,
 * pipeline cheio e entrevistas. Para a app parecer "a sério". Idempotente (UUIDs fixos +
 * onConflictDoNothing). Enriquece o candidato "mateus" (upload real) e limpa o lixo de teste.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev \
 *     pnpm --filter web exec tsx scripts/seed-demo.ts
 */
import { createDb, schema } from "@rh/db";
import { and, eq, ilike, inArray, isNull, sql } from "drizzle-orm";

const AGENCY = "11111111-0000-4000-8000-000000000001";
const FILIPA = "22222222-0000-4000-8000-000000000001";

// ── ids fixos (idempotência) ──
const C_ACME = "d1000000-0000-4000-8000-000000000001";
const C_FINPAY = "d1000000-0000-4000-8000-000000000002";
const K_SOFIA = "d2000000-0000-4000-8000-000000000001";
const K_BRUNO = "d2000000-0000-4000-8000-000000000002";
const K_CARLA = "d2000000-0000-4000-8000-000000000003";
const K_TIAGO = "d2000000-0000-4000-8000-000000000004";
const K_INES = "d2000000-0000-4000-8000-000000000005";
const J_FRONT = "d3000000-0000-4000-8000-000000000001";
const J_BACK = "d3000000-0000-4000-8000-000000000002";
const J_DEVOPS = "d3000000-0000-4000-8000-000000000003";
const J_DATA = "d3000000-0000-4000-8000-000000000004";

const CLIENTS = [
  { id: C_ACME, name: "Acme Software" },
  { id: C_FINPAY, name: "FinPay" },
];

// Fichas dos clientes (setor/site/descrição) — fictícias; FUTURO: enriquecidas do site real.
const CLIENT_PROFILES = [
  {
    name: "CMTecnologia",
    sector: "Software House & Automação",
    website: "https://cmtecnologia.pt",
    description:
      "Software house de elite e laboratório de automação — SaaS premium, e-commerce de alta performance e integrações de IA. Estética Linear/Stripe, operação 100% IA.",
  },
  {
    name: "Acme Software",
    sector: "Produto / SaaS B2B",
    website: "https://acme.example.com",
    description:
      "Empresa de produto SaaS B2B em crescimento. Equipa de engenharia distribuída, forte cultura de developer experience e código limpo.",
  },
  {
    name: "FinPay",
    sector: "Fintech / Pagamentos",
    website: "https://finpay.example.com",
    description:
      "Plataforma de pagamentos e infraestrutura financeira. Exigência alta de fiabilidade, segurança e escala.",
  },
  {
    name: "TechCorp (demo)",
    sector: "Tecnologia",
    website: null as string | null,
    description: "Cliente de demonstração.",
  },
];

const CANDIDATES = [
  {
    id: K_SOFIA,
    name: "Sofia Marques",
    skills: ["React", "TypeScript", "Next.js", "Tailwind", "JavaScript"],
    anos: 5,
    gaps: [] as string[],
    resumo: "Frontend engineer focada em React/Next.js e design systems. 5 anos em produtos SaaS.",
  },
  {
    id: K_BRUNO,
    name: "Bruno Costa",
    skills: ["Python", "Django", "PostgreSQL", "Docker", "AWS"],
    anos: 7,
    gaps: ["Sem experiência declarada em frontend"],
    resumo: "Backend engineer (Python/Django) com 7 anos em fintech e APIs de alto tráfego.",
  },
  {
    id: K_CARLA,
    name: "Carla Mendes",
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "GraphQL"],
    anos: 4,
    gaps: ["Pouca experiência em testes E2E"],
    resumo: "Fullstack (TypeScript) com 4 anos. Gosta de produto, do front ao back.",
  },
  {
    id: K_TIAGO,
    name: "Tiago Reis",
    skills: ["Docker", "Kubernetes", "AWS", "Terraform", "Linux", "CI/CD"],
    anos: 6,
    gaps: [] as string[],
    resumo: "DevOps/SRE com 6 anos. Infra como código, observabilidade e fiabilidade.",
  },
  {
    id: K_INES,
    name: "Inês Lopes",
    skills: ["Python", "PyTorch", "TensorFlow", "Machine Learning", "PostgreSQL"],
    anos: 3,
    gaps: ["Experiência sobretudo académica (pouca produção)"],
    resumo: "Data/ML engineer com 3 anos. Modelos em produção e pipelines de dados.",
  },
];

const JOBS = [
  {
    id: J_FRONT,
    clientId: C_ACME,
    title: "Frontend React Sénior",
    slug: "frontend_react_senior",
    must: ["React", "TypeScript", "Next.js", "Tailwind"],
    nice: ["Framer Motion"],
    nivel: "senior",
  },
  {
    id: J_BACK,
    clientId: C_ACME,
    title: "Backend Python",
    slug: "backend_python",
    must: ["Python", "Django", "PostgreSQL", "Docker"],
    nice: ["AWS"],
    nivel: "pleno",
  },
  {
    id: J_DEVOPS,
    clientId: C_FINPAY,
    title: "DevOps / SRE",
    slug: "devops_sre",
    must: ["Docker", "Kubernetes", "AWS", "Terraform"],
    nice: ["Linux"],
    nivel: "senior",
  },
  {
    id: J_DATA,
    clientId: C_FINPAY,
    title: "Data Engineer",
    slug: "data_engineer",
    must: ["Python", "PostgreSQL", "Machine Learning"],
    nice: ["PyTorch"],
    nivel: "pleno",
  },
];

// process (candidate × job × stage) — preenche o funil de ponta a ponta.
const PROCESSES = [
  { id: "d4000000-0000-4000-8000-000000000001", cand: K_SOFIA, job: J_FRONT, stage: "submitted" },
  { id: "d4000000-0000-4000-8000-000000000002", cand: K_CARLA, job: J_FRONT, stage: "interview" },
  { id: "d4000000-0000-4000-8000-000000000003", cand: K_BRUNO, job: J_BACK, stage: "client_iv" },
  { id: "d4000000-0000-4000-8000-000000000004", cand: K_TIAGO, job: J_DEVOPS, stage: "offer" },
  { id: "d4000000-0000-4000-8000-000000000005", cand: K_INES, job: J_DATA, stage: "sourced" },
  { id: "d4000000-0000-4000-8000-000000000006", cand: K_BRUNO, job: J_DATA, stage: "screening" },
];

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("falta DATABASE_URL");
  }
  const { db, close } = createDb(databaseUrl);
  try {
    const now = new Date();

    // 1) limpa o lixo de teste (soft-delete).
    await db
      .update(schema.candidate)
      .set({ deletedAt: now })
      .where(
        and(
          eq(schema.candidate.agencyId, AGENCY),
          inArray(schema.candidate.name, ["Rita Teste", "Ana Silva"]),
        ),
      );
    await db
      .update(schema.client)
      .set({ deletedAt: now })
      .where(and(eq(schema.client.agencyId, AGENCY), eq(schema.client.name, "Walkthrough Lda")));
    await db
      .update(schema.job)
      .set({ deletedAt: now })
      .where(and(eq(schema.job.agencyId, AGENCY), eq(schema.job.title, "QA Engineer")));

    // 2) clientes demo + fichas (setor/site/descrição).
    await db
      .insert(schema.client)
      .values(CLIENTS.map((c) => ({ id: c.id, agencyId: AGENCY, name: c.name })))
      .onConflictDoNothing();
    for (const p of CLIENT_PROFILES) {
      await db
        .update(schema.client)
        .set({ sector: p.sector, website: p.website, description: p.description })
        .where(and(eq(schema.client.agencyId, AGENCY), eq(schema.client.name, p.name)));
    }

    // 3) candidatos demo (perfis completos).
    await db
      .insert(schema.candidate)
      .values(
        CANDIDATES.map((c) => ({
          id: c.id,
          agencyId: AGENCY,
          name: c.name,
          nameNormalized: c.name.toLowerCase(),
          profile: {
            skillsDeclaradas: c.skills,
            experienciaAnos: c.anos,
            gapsCv: c.gaps,
            resumo: c.resumo,
          },
        })),
      )
      .onConflictDoNothing();

    // 4) vagas demo (requisitos com must/nice → triagem com chips).
    await db
      .insert(schema.job)
      .values(
        JOBS.map((j) => ({
          id: j.id,
          agencyId: AGENCY,
          clientId: j.clientId,
          recruiterId: FILIPA,
          title: j.title,
          roleTypeSlug: j.slug,
          requirements: {
            roleType: j.slug,
            nivel: j.nivel,
            skills: { must: j.must, nice: j.nice },
            contexto: `${j.title} — cliente exige ${j.must.join(", ")}.`,
          },
        })),
      )
      .onConflictDoNothing();

    // 5) processos (pipeline cheio).
    await db
      .insert(schema.process)
      .values(
        PROCESSES.map((p) => ({
          id: p.id,
          agencyId: AGENCY,
          candidateId: p.cand,
          jobId: p.job,
          recruiterId: FILIPA,
          stage: p.stage,
        })),
      )
      .onConflictDoNothing();

    // 6) entrevistas agendadas (agenda do painel).
    const t = now.getTime();
    await db
      .insert(schema.interview)
      .values([
        {
          id: "d5000000-0000-4000-8000-000000000001",
          agencyId: AGENCY,
          processId: "d4000000-0000-4000-8000-000000000002",
          candidateId: K_CARLA,
          recruiterId: FILIPA,
          status: "scheduled",
          startedAt: new Date(t + 3 * 60 * 60 * 1000),
        },
        {
          id: "d5000000-0000-4000-8000-000000000002",
          agencyId: AGENCY,
          processId: "d4000000-0000-4000-8000-000000000003",
          candidateId: K_BRUNO,
          recruiterId: FILIPA,
          status: "scheduled",
          startedAt: new Date(t + 26 * 60 * 60 * 1000),
        },
      ])
      .onConflictDoNothing();

    // 7) enriquece o candidato "mateus" (upload real) + liga-o à vaga da CMTecnologia.
    const mateusProfile = {
      skillsDeclaradas: [
        "TypeScript",
        "Python",
        "React",
        "Next.js",
        "Node.js",
        "LLM",
        "PostgreSQL",
      ],
      experienciaAnos: 6,
      gapsCv: ["Confirmar profundidade em infra/Kubernetes"],
      resumo:
        "AI/LLM Engineer & Full-Stack (TypeScript/Python). Construiu e operou sistemas LLM e produtos web em produção. Começou em frontend.",
    };
    await db
      .update(schema.candidate)
      .set({ profile: mateusProfile })
      .where(
        and(
          eq(schema.candidate.agencyId, AGENCY),
          ilike(schema.candidate.name, "mateus%"),
          isNull(schema.candidate.deletedAt),
        ),
      );

    const mateusRows = await db
      .select({ id: schema.candidate.id })
      .from(schema.candidate)
      .where(
        and(
          eq(schema.candidate.agencyId, AGENCY),
          ilike(schema.candidate.name, "mateus%"),
          isNull(schema.candidate.deletedAt),
        ),
      )
      .limit(1);
    const cmtecRows = await db
      .select({ id: schema.job.id })
      .from(schema.job)
      .where(
        and(
          eq(schema.job.agencyId, AGENCY),
          ilike(schema.job.title, "Engenheiro Fullstack%"),
          isNull(schema.job.deletedAt),
        ),
      )
      .limit(1);
    const mateusId = mateusRows[0]?.id;
    const cmtecJobId = cmtecRows[0]?.id;
    if (mateusId && cmtecJobId) {
      await db
        .insert(schema.process)
        .values({
          id: "d4000000-0000-4000-8000-0000000000ff",
          agencyId: AGENCY,
          candidateId: mateusId,
          jobId: cmtecJobId,
          recruiterId: FILIPA,
          stage: "screening",
        })
        .onConflictDoNothing();
    }

    const countRows = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(schema.candidate)
      .where(and(eq(schema.candidate.agencyId, AGENCY), isNull(schema.candidate.deletedAt)));
    const candCount = countRows[0]?.value ?? 0;
    process.stdout.write(
      `[seed-demo] concluído. candidatos ativos IRIS: ${candCount}. mateus ${mateusId ? "enriquecido + ligado à CMTec" : "não encontrado"}.\n`,
    );
  } finally {
    await close();
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`[seed-demo] ERRO: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
