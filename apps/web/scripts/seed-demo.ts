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
    cvText: `Sofia Marques
sofia.marques@email.com | +351 912 345 678 | linkedin.com/in/sofiamarques
Lisboa, Portugal

RESUMO
Frontend engineer com 5 anos de experiência em desenvolvimento de produtos SaaS B2B.
Especializada em React, TypeScript e design systems. Forte orientação para experiência
do utilizador e performance.

EXPERIÊNCIA

Frontend Engineer Sénior — Cloudly SaaS (2022–presente)
• Liderou a migração de CRA para Next.js 14 (App Router), reduzindo LCP em 40%.
• Construiu design system interno com 80+ componentes (Radix + Tailwind).
• Responsável pela acessibilidade WCAG 2.1 AA em toda a plataforma.
• Tech stack: React 18, TypeScript, Next.js, Tailwind CSS, Storybook.

Frontend Engineer — DevBox (2020–2022)
• Desenvolveu dashboard de analytics em tempo real com WebSockets.
• Implementou internacionalização (PT/EN/ES) com i18next.
• Tech stack: React, JavaScript, Redux, Styled Components.

FORMAÇÃO
Licenciatura em Engenharia Informática — FCUL (2016–2020)

SKILLS
React · TypeScript · Next.js · Tailwind CSS · JavaScript · Radix UI
Storybook · Vitest · Playwright · Git · Figma
`,
  },
  {
    id: K_BRUNO,
    name: "Bruno Costa",
    skills: ["Python", "Django", "PostgreSQL", "Docker", "AWS"],
    anos: 7,
    gaps: ["Sem experiência declarada em frontend"],
    resumo: "Backend engineer (Python/Django) com 7 anos em fintech e APIs de alto tráfego.",
    cvText: `Bruno Costa
bruno.costa@email.com | +351 963 456 789
Porto, Portugal

RESUMO
Backend engineer sénior com 7 anos de experiência em Python e Django.
Especializado em APIs de alto tráfego e infraestrutura fintech. Proficiente em
PostgreSQL, Docker e AWS. Historial comprovado de sistemas a processar +10M
transações/dia.

EXPERIÊNCIA

Backend Engineer Sénior — FinBank Tech (2019–presente)
• Arquitetou sistema de pagamentos SEPA com Django REST Framework e Celery.
• Otimizou queries PostgreSQL reduzindo p95 de 800ms para 45ms.
• Migrou serviços monolíticos para microserviços Docker/Kubernetes.
• Implementou PCI-DSS compliance em toda a pipeline de pagamentos.
• Tech stack: Python 3.11, Django, PostgreSQL, Docker, AWS (ECS, RDS, SQS).

Backend Engineer — WebPay (2017–2019)
• Desenvolveu integrações com Stripe e MBWay via webhooks.
• Criou sistema de reconciliação financeira automatizada.
• Tech stack: Python, Flask, MySQL, Redis.

FORMAÇÃO
Mestrado em Engenharia de Software — FEUP (2015–2017)

SKILLS
Python · Django · FastAPI · PostgreSQL · Docker · Kubernetes
AWS (ECS/RDS/SQS/Lambda) · Redis · Celery · Git
`,
  },
  {
    id: K_CARLA,
    name: "Carla Mendes",
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "GraphQL"],
    anos: 4,
    gaps: ["Pouca experiência em testes E2E"],
    resumo: "Fullstack (TypeScript) com 4 anos. Gosta de produto, do front ao back.",
    cvText: `Carla Mendes
carla.mendes@email.com | +351 934 567 890
Lisboa, Portugal

RESUMO
Fullstack developer com 4 anos em TypeScript, do frontend React ao backend Node.js.
Gosto de produto — não só da tecnologia. Experiência em startups de rápido crescimento,
desde o zero ao primeiro €1M ARR. Forte em GraphQL e PostgreSQL.

EXPERIÊNCIA

Fullstack Engineer — GrowthApp (2021–presente)
• Construiu de raiz o dashboard de analytics (React + GraphQL + Node.js).
• Redesenhou a API GraphQL, eliminando N+1 queries com DataLoader.
• Implementou feature flags e A/B testing com PostHog.
• Tech stack: TypeScript, React, Node.js, GraphQL, PostgreSQL, Prisma.

Junior Fullstack — AgênciaDigital (2020–2021)
• Desenvolveu landing pages e back-offices para clientes de e-commerce.
• Tech stack: React, Express.js, MySQL.

FORMAÇÃO
Bootcamp Fullstack — Le Wagon Lisboa (2020)
Licenciatura em Design de Comunicação — ESAD (2016–2019)

SKILLS
TypeScript · React · Node.js · GraphQL · PostgreSQL · Prisma
Next.js · Tailwind CSS · Docker · Git
`,
  },
  {
    id: K_TIAGO,
    name: "Tiago Reis",
    skills: ["Docker", "Kubernetes", "AWS", "Terraform", "Linux", "CI/CD"],
    anos: 6,
    gaps: [] as string[],
    resumo: "DevOps/SRE com 6 anos. Infra como código, observabilidade e fiabilidade.",
    cvText: `Tiago Reis
tiago.reis@email.com | +351 915 678 901
Braga, Portugal

RESUMO
DevOps / SRE com 6 anos de experiência. Especialista em Kubernetes, Terraform e
observabilidade. Construí e mantive infra para plataformas com 99.95% uptime
e picos de 50k req/s. Certificado AWS Solutions Architect (Professional).

EXPERIÊNCIA

SRE Lead — ScaleUp Platform (2020–presente)
• Migrou infraestrutura de VMs para Kubernetes (EKS), reduzindo custos em 35%.
• Implementou observabilidade completa: Prometheus, Grafana, OpenTelemetry.
• Criou pipelines CI/CD multi-ambiente com GitHub Actions e ArgoCD.
• Geriu incidentes P1 (MTTD < 5min, MTTR < 30min) com on-call rotation.
• Tech stack: Kubernetes, Terraform, AWS (EKS/ECS/RDS), Docker, Helm, Linux.

DevOps Engineer — MicroCloud (2018–2020)
• Automatizou provisionamento de infra com Terraform (500+ recursos).
• Configurou alertas e dashboards Grafana para 20+ serviços.
• Tech stack: AWS, Docker, Ansible, Jenkins.

FORMAÇÃO
Licenciatura em Redes e Sistemas — UM (2014–2018)

CERTIFICAÇÕES
AWS Solutions Architect – Professional (2022)
Certified Kubernetes Administrator – CKA (2021)

SKILLS
Kubernetes · Docker · Terraform · AWS · Helm · ArgoCD
Prometheus · Grafana · GitHub Actions · Linux · Python · Bash
`,
  },
  {
    id: K_INES,
    name: "Inês Lopes",
    skills: ["Python", "PyTorch", "TensorFlow", "Machine Learning", "PostgreSQL"],
    anos: 3,
    gaps: ["Experiência sobretudo académica (pouca produção)"],
    resumo: "Data/ML engineer com 3 anos. Modelos em produção e pipelines de dados.",
    cvText: `Inês Lopes
ines.lopes@email.com | +351 926 789 012
Coimbra, Portugal

RESUMO
Data / ML Engineer com 3 anos de experiência. Especializada em PyTorch e TensorFlow
para modelos de NLP e visão computacional. Experiência em colocar modelos em produção
(FastAPI + Docker). Background académico forte (MSc Ciência de Dados, UC).

EXPERIÊNCIA

ML Engineer — AIDataCo (2022–presente)
• Treinou e deployou modelos de classificação de texto (BERT fine-tuned) em produção.
• Construiu pipeline de dados de 10TB/semana com Apache Airflow + PostgreSQL.
• Reduziu custo de inferência em 60% com quantização de modelos (INT8).
• Tech stack: Python, PyTorch, TensorFlow, FastAPI, Docker, PostgreSQL, Airflow.

Research Assistant — CISUC (2021–2022)
• Investigação em NLP: modelos de sumarização e extração de entidades.
• Publicou 2 artigos em conferências (ACL 2022, EACL 2022).
• Tech stack: Python, PyTorch, HuggingFace Transformers, scikit-learn.

FORMAÇÃO
MSc Ciência de Dados — Universidade de Coimbra (2019–2021) — Média: 18/20
Licenciatura em Matemática — UC (2016–2019)

SKILLS
Python · PyTorch · TensorFlow · HuggingFace · scikit-learn
FastAPI · Docker · PostgreSQL · Apache Airflow · pandas · NumPy
`,
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

    // Reuniões/intake SIMULADOS: o que cada cliente valoriza / não aceita / contexto.
    const [cmtecCli] = await db
      .select({ id: schema.client.id })
      .from(schema.client)
      .where(
        and(
          eq(schema.client.agencyId, AGENCY),
          eq(schema.client.name, "CMTecnologia"),
          isNull(schema.client.deletedAt),
        ),
      )
      .limit(1);
    const FACTS: { clientId: string; items: { t: string; text: string }[] }[] = [
      {
        clientId: C_ACME,
        items: [
          { t: "preference", text: "Valoriza autonomia e ownership do início ao fim" },
          { t: "preference", text: "Código limpo, testes e boas práticas" },
          { t: "rejection_reason", text: "Não aceita quem só executa sem questionar" },
          { t: "context", text: "Equipa distribuída, comunicação assíncrona" },
        ],
      },
      {
        clientId: C_FINPAY,
        items: [
          { t: "preference", text: "Fiabilidade e rigor acima de velocidade" },
          { t: "rejection_reason", text: "Não aceita atalhos em segurança ou compliance" },
          { t: "context", text: "Ambiente regulado (fintech) — PCI-DSS" },
        ],
      },
      ...(cmtecCli
        ? [
            {
              clientId: cmtecCli.id,
              items: [
                { t: "preference", text: "Estética premium (Linear/Stripe), atenção ao detalhe" },
                { t: "preference", text: "Conforto com IA/LLM e automação" },
                { t: "rejection_reason", text: "Não aceita código desleixado nem 'AI slop'" },
                { t: "context", text: "Operação 100% IA, entregas em tempo recorde" },
              ],
            },
          ]
        : []),
    ];
    for (const f of FACTS) {
      await db
        .delete(schema.clientMemoryFact)
        .where(eq(schema.clientMemoryFact.clientId, f.clientId));
      await db.insert(schema.clientMemoryFact).values(
        f.items.map((it) => ({
          agencyId: AGENCY,
          clientId: f.clientId,
          factText: it.text,
          factType: it.t,
          sourceType: "intake_doc",
          confirmedAt: now,
        })),
      );
    }

    // 3) candidatos demo (perfis completos + CV texto para o visor inline).
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

    // source_doc: CV texto de cada candidato (idempotente: apaga e re-insere).
    for (const c of CANDIDATES) {
      await db
        .delete(schema.sourceDoc)
        .where(and(eq(schema.sourceDoc.candidateId, c.id), eq(schema.sourceDoc.kind, "cv")));
    }
    await db.insert(schema.sourceDoc).values(
      CANDIDATES.map((c) => ({
        agencyId: AGENCY,
        kind: "cv",
        candidateId: c.id,
        rawText: c.cvText,
        title: `CV — ${c.name}`,
      })),
    );

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

    // CV do mateus (o upload real foi feito antes de existir o guardar-CV). onConflictDoNothing +
    // id fixo → idempotente e NÃO clobbera um futuro re-upload real (esse tem fetchedAt mais recente).
    if (mateusId) {
      await db
        .insert(schema.sourceDoc)
        .values({
          id: "d6000000-0000-4000-8000-000000000001",
          agencyId: AGENCY,
          kind: "cv",
          candidateId: mateusId,
          title: "CV — Mateus Oliveira",
          rawText: `Mateus Oliveira
mateus@email.com | Lisboa, Portugal | linkedin.com/in/mateusoliveira

RESUMO
AI / LLM Engineer e Full-Stack (TypeScript / Python) com 6 anos de experiência. Construiu e
operou sistemas LLM e produtos web em produção, do frontend à infraestrutura. Começou como
frontend developer e cresceu para arquitetura de sistemas de IA.

EXPERIÊNCIA

AI / LLM Engineer — CMTecnologia (2022—presente)
• Arquitetou copilotos de IA e agentes (tool-calling, RAG com pgvector) em produção.
• Construiu produtos web premium em Next.js 15 + Supabase + TypeScript estrito.
• Pipelines de automação (n8n) e integração de modelos (OpenRouter, embeddings).
• Stack: TypeScript, Python, React, Next.js, Node.js, PostgreSQL, LLM.

Full-Stack Developer (2019—2022)
• Desenvolveu plataformas SaaS e e-commerce de alta performance.
• Frontend React/Next.js + backend Node.js/Python.

FORMAÇÃO
Engenharia Informática

SKILLS
TypeScript · Python · React · Next.js · Node.js · LLM · RAG · PostgreSQL · Supabase
`,
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
