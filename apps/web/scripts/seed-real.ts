/**
 * Seed de DADOS REAIS (demo IRIS Tech) — empresas TECH PORTUGUESAS reais, com logos (icon.horse),
 * perfis fundos (sede/fundação/equipa/stack/LinkedIn), vagas representativas, + factos/critérios/
 * reunião de intake. Idempotente (ids fixos e1000000.. / e2000000..; delete/insert dos factos/critérios).
 *
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev \
 *     pnpm --filter web exec tsx scripts/seed-real.ts
 */
import { createDb, schema } from "@rh/db";
import { eq } from "drizzle-orm";

const AGENCY = "11111111-0000-4000-8000-000000000001";
const FILIPA = "22222222-0000-4000-8000-000000000001";

interface Role {
  title: string;
  must: string[];
  nice: string[];
  contexto: string;
}
interface Company {
  name: string;
  domain: string;
  linkedin: string;
  sector: string;
  location: string;
  founded: string;
  headcount: string;
  tech: string[];
  description: string;
  valoriza: string[];
  naoAceita: string;
  contexto: string;
  reuniao: string;
  roles: Role[];
}

const COMPANIES: Company[] = [
  {
    name: "Feedzai",
    domain: "feedzai.com",
    linkedin: "https://www.linkedin.com/company/feedzai",
    sector: "Fintech · Deteção de fraude (IA)",
    location: "Coimbra & Lisboa, Portugal",
    founded: "2011",
    headcount: "600+",
    tech: ["Java", "Python", "Spark", "Kafka", "Cassandra"],
    description:
      "Plataforma de IA para deteção de fraude e crime financeiro, usada por alguns dos maiores bancos do mundo. Unicórnio português fundado em Coimbra, com forte cultura de engenharia e investigação.",
    valoriza: [
      "Rigor de engenharia e sistemas de alta escala (milhões de transações)",
      "Pensamento de produto e ownership do problema de ponta a ponta",
    ],
    naoAceita: "Não avança com quem trata segurança e fiabilidade como opcional",
    contexto: "Equipa híbrida (Coimbra/Lisboa/remoto). Processo: 3 etapas + case técnico.",
    reuniao:
      '"...o perfil ideal já trabalhou com dados a escala real, não só projetos. Queremos alguém que questione o problema, não só implemente. Híbrido em Coimbra ou Lisboa, mas damos flexibilidade. Time-to-hire: 4 semanas."',
    roles: [
      {
        title: "Senior Data Scientist — Fraude",
        must: ["Python", "Machine Learning", "Spark"],
        nice: ["Kafka", "Streaming"],
        contexto:
          "Modelos de deteção de fraude em tempo real sobre milhões de transações. Forte componente de feature engineering e avaliação rigorosa.",
      },
      {
        title: "Senior Backend Engineer — Java",
        must: ["Java", "Kafka", "Sistemas distribuídos"],
        nice: ["Cassandra", "Spark"],
        contexto:
          "Plataforma de processamento de eventos de baixa latência. Exige experiência sólida em concorrência e sistemas distribuídos.",
      },
    ],
  },
  {
    name: "Talkdesk",
    domain: "talkdesk.com",
    linkedin: "https://www.linkedin.com/company/talkdesk",
    sector: "SaaS · Contact Center na cloud",
    location: "Lisboa, Portugal (global)",
    founded: "2011",
    headcount: "1800+",
    tech: ["Node.js", "React", "TypeScript", "Go", "AWS"],
    description:
      "Plataforma cloud de contact center com IA, fundada por portugueses e presente a nível global. Unicórnio com produto a escala enterprise e forte aposta em IA generativa.",
    valoriza: [
      "Experiência em produto SaaS a escala (multi-tenant, alta disponibilidade)",
      "Autonomia e boa comunicação em equipa distribuída internacional",
    ],
    naoAceita: "Não aceita perfis que precisam de micro-gestão constante",
    contexto: "Equipa global, inglês no dia a dia. Processo: 4 etapas (técnica + system design).",
    reuniao:
      '"...precisamos de seniores que peguem em ambiguidade e tragam clareza. Inglês fluente é obrigatório, a equipa é global. Damos preferência a quem já escalou produto real. Remoto OK dentro da Europa."',
    roles: [
      {
        title: "Senior Frontend Engineer — React",
        must: ["React", "TypeScript", "JavaScript"],
        nice: ["Design systems", "WebRTC"],
        contexto:
          "Aplicação de contact center em tempo real (chamadas, IA, analytics). Foco em performance e experiência do agente.",
      },
      {
        title: "Staff Backend Engineer — Node.js",
        must: ["Node.js", "AWS", "Sistemas distribuídos"],
        nice: ["Go", "Kafka"],
        contexto:
          "Serviços de telefonia e roteamento a escala global. Exige experiência em arquitetura e fiabilidade.",
      },
    ],
  },
  {
    name: "Unbabel",
    domain: "unbabel.com",
    linkedin: "https://www.linkedin.com/company/unbabel",
    sector: "IA · Tradução & Language Operations",
    location: "Lisboa, Portugal",
    founded: "2013",
    headcount: "200+",
    tech: ["Python", "PyTorch", "React", "Kubernetes"],
    description:
      "Plataforma de tradução assistida por IA (human-in-the-loop) para apoio ao cliente e conteúdo multilingue a escala. Forte equipa de investigação em NLP, em Lisboa.",
    valoriza: [
      "Conforto com IA/ML e produtos data-intensive",
      "Curiosidade e vontade de experimentar (cultura de research)",
    ],
    naoAceita: "Não avança com perfis sem bases sólidas em Python/ML para os papéis de IA",
    contexto: "Lisboa, modelo híbrido. Processo: 3 etapas + conversa com a equipa de research.",
    reuniao:
      '"...queremos alguém que goste do problema de linguagem, não só do código. Para o papel de ML, tem de ter posto modelos em produção, não só notebooks. Híbrido em Lisboa, 2 dias no escritório."',
    roles: [
      {
        title: "Machine Learning Engineer — NLP",
        must: ["Python", "PyTorch", "NLP"],
        nice: ["MLOps", "Kubernetes"],
        contexto:
          "Modelos de tradução e qualidade linguística em produção. Pipeline human-in-the-loop com avaliação contínua.",
      },
      {
        title: "Full-Stack Engineer — Python/React",
        must: ["Python", "React", "TypeScript"],
        nice: ["GraphQL", "Kubernetes"],
        contexto:
          "Produto de Language Operations: dashboards, fluxos de revisão humana e integrações. Do front ao back.",
      },
    ],
  },
  {
    name: "OutSystems",
    domain: "outsystems.com",
    linkedin: "https://www.linkedin.com/company/outsystems",
    sector: "Plataforma de desenvolvimento low-code",
    location: "Lisboa, Portugal (global)",
    founded: "2001",
    headcount: "1700+",
    tech: [".NET", "C#", "React", "Kubernetes", "AWS"],
    description:
      "Líder global em desenvolvimento low-code. Unicórnio português que permite às empresas criar aplicações a alta velocidade. Engenharia exigente, produto a escala enterprise.",
    valoriza: [
      "Fundamentos de engenharia fortes (algoritmos, arquitetura)",
      "Qualidade e atenção ao detalhe em produto crítico",
    ],
    naoAceita: "Não aceita código sem testes nem quem ignora performance",
    contexto: "Lisboa (híbrido). Processo: 4 etapas, inclui problema de algoritmia.",
    reuniao:
      '"...procuramos engenheiros com bases muito sólidas, gente que percebe o que faz por baixo da abstração. O produto é crítico para milhares de empresas, a fasquia de qualidade é alta. Híbrido em Lisboa."',
    roles: [
      {
        title: "Senior Software Engineer — .NET",
        must: ["C#", ".NET", "Arquitetura de software"],
        nice: ["React", "Cloud"],
        contexto:
          "Core da plataforma low-code (compilador, runtime). Exige fundamentos fortes e cuidado com performance.",
      },
      {
        title: "Cloud Platform Engineer",
        must: ["Kubernetes", "AWS", "Go"],
        nice: ["Terraform", "Observabilidade"],
        contexto:
          "Infraestrutura cloud que corre as aplicações dos clientes a escala. Fiabilidade e automação no centro.",
      },
    ],
  },
  {
    name: "Sword Health",
    domain: "swordhealth.com",
    linkedin: "https://www.linkedin.com/company/sword-health",
    sector: "Health-tech · Fisioterapia digital (IA)",
    location: "Porto, Portugal",
    founded: "2015",
    headcount: "900+",
    tech: ["Python", "React Native", "AWS", "Go"],
    description:
      "Health-tech de fisioterapia digital com IA e sensores de movimento. Unicórnio fundado no Porto, a tratar dor músculo-esquelética a escala internacional.",
    valoriza: [
      "Impacto e propósito (saúde) — gente que se importa com o utilizador final",
      "Velocidade com qualidade num ambiente de hiper-crescimento",
    ],
    naoAceita: "Não avança com quem não comunica bem em equipa remota/distribuída",
    contexto: "Porto + remoto. Processo: 3 etapas + case prático.",
    reuniao:
      '"...crescemos muito depressa, precisamos de gente que se mexe mas não parte tudo. O produto é clínico, a qualidade importa. Porto ou remoto. Valorizamos quem já trabalhou em saúde ou produto consumer."',
    roles: [
      {
        title: "Senior Backend Engineer — Python",
        must: ["Python", "AWS", "APIs"],
        nice: ["Go", "Health-tech"],
        contexto:
          "Backend do programa clínico (sessões, progresso, alertas). Dados sensíveis, exige rigor e privacidade.",
      },
      {
        title: "Mobile Engineer — React Native",
        must: ["React Native", "TypeScript", "Mobile"],
        nice: ["iOS", "Android"],
        contexto:
          "App do paciente com sensores de movimento em tempo real. Foco em experiência e fiabilidade.",
      },
    ],
  },
  {
    name: "Remote",
    domain: "remote.com",
    linkedin: "https://www.linkedin.com/company/remote-com",
    sector: "HR-tech · Contratação & payroll global",
    location: "Remote-first (raízes em Portugal)",
    founded: "2019",
    headcount: "1400+",
    tech: ["Elixir", "Ruby", "React", "PostgreSQL"],
    description:
      "Plataforma global de RH, contratação e payroll internacional. Empresa remote-first com forte presença portuguesa e cultura de documentação e assincronia.",
    valoriza: [
      "Excelente comunicação escrita (cultura async, 100% remota)",
      "Autonomia e capacidade de trabalhar com pessoas em vários fusos",
    ],
    naoAceita: "Não aceita quem precisa de escritório/supervisão para render",
    contexto: "100% remoto, async. Processo: 3-4 etapas, muito por escrito.",
    reuniao:
      '"...somos 100% remotos e async, por isso a escrita é tudo. Quem comunica mal por escrito não funciona aqui. Elixir é um plus mas ensinamos a quem tem boas bases. Qualquer fuso horário compatível com a equipa."',
    roles: [
      {
        title: "Senior Backend Engineer — Elixir",
        must: ["Elixir", "PostgreSQL", "APIs"],
        nice: ["Ruby", "Phoenix"],
        contexto:
          "Core de payroll e contratação internacional. Domínio complexo (legal/fiscal por país), exige cuidado.",
      },
      {
        title: "Senior Frontend Engineer — React",
        must: ["React", "TypeScript", "JavaScript"],
        nice: ["GraphQL", "Design systems"],
        contexto:
          "Produto self-service de onboarding e gestão de equipas globais. Muitos fluxos, foco em clareza.",
      },
    ],
  },
];

const hex = (n: number, len: number): string => String(n).padStart(len, "0");

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("falta DATABASE_URL");
  }
  const { db, close } = createDb(databaseUrl);
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-PT");
    let ci = 0;
    let vagas = 0;
    for (const co of COMPANIES) {
      ci += 1;
      const clientId = `e1000000-0000-4000-8000-${hex(ci, 12)}`;
      const profile = {
        sector: co.sector,
        website: `https://${co.domain}`,
        description: co.description,
        logoUrl: `https://icon.horse/icon/${co.domain}`,
        location: co.location,
        founded: co.founded,
        headcount: co.headcount,
        linkedinUrl: co.linkedin,
        techStack: co.tech,
      };
      await db
        .insert(schema.client)
        .values({ id: clientId, agencyId: AGENCY, name: co.name, ...profile })
        .onConflictDoNothing();
      await db
        .update(schema.client)
        .set({ name: co.name, ...profile })
        .where(eq(schema.client.id, clientId));

      await db.delete(schema.job).where(eq(schema.job.clientId, clientId));
      let ji = 0;
      for (const role of co.roles) {
        ji += 1;
        vagas += 1;
        const jobId = `e2000000-0000-4000-8000-${hex(ci, 6)}${hex(ji, 6)}`;
        const slug = role.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "_")
          .slice(0, 40);
        const nivel = /senior|sénior|staff|lead|principal/.test(role.title.toLowerCase())
          ? "senior"
          : "pleno";
        await db
          .insert(schema.job)
          .values({
            id: jobId,
            agencyId: AGENCY,
            clientId,
            recruiterId: FILIPA,
            title: role.title,
            roleTypeSlug: slug,
            requirements: {
              roleType: slug,
              nivel,
              skills: { must: role.must, nice: role.nice },
              contexto: role.contexto,
            },
          })
          .onConflictDoNothing();
      }

      await db.delete(schema.clientMemoryFact).where(eq(schema.clientMemoryFact.clientId, clientId));
      const facts: Array<{ t: string; text: string; ref?: string; snippet?: string }> = [
        ...co.valoriza.map((text) => ({ t: "preference", text })),
        { t: "rejection_reason", text: co.naoAceita },
        { t: "context", text: co.contexto },
        {
          t: "meeting",
          text: "Reunião de intake — alinhamento do perfil e prioridades de contratação",
          ref: `Intake • ${dateStr}`,
          snippet: co.reuniao,
        },
      ];
      await db.insert(schema.clientMemoryFact).values(
        facts.map((f) => ({
          agencyId: AGENCY,
          clientId,
          factText: f.text,
          factType: f.t,
          sourceType: f.t === "meeting" ? "intake_doc" : "client_verdict",
          sourceRef: f.ref ?? null,
          sourceSnippet: f.snippet ?? null,
          confirmedAt: now,
        })),
      );

      await db.delete(schema.clientCriteria).where(eq(schema.clientCriteria.clientId, clientId));
      const crit: Array<{ criterio: string; peso: string }> = [
        ...co.tech.slice(0, 2).map((c) => ({ criterio: c, peso: "must" })),
        ...co.tech.slice(2, 4).map((c) => ({ criterio: c, peso: "nice" })),
        { criterio: "Comunicação forte e ownership", peso: "must" },
      ];
      await db.insert(schema.clientCriteria).values(
        crit.map((c) => ({
          agencyId: AGENCY,
          clientId,
          criterio: c.criterio,
          peso: c.peso,
          origem: "setup",
        })),
      );
    }
    // Liga candidatos de demo às vagas PT reais → os funis das empresas reais ganham vida.
    const ptJob = (c: number, j: number): string =>
      `e2000000-0000-4000-8000-${hex(c, 6)}${hex(j, 6)}`;
    const K = {
      sofia: "d2000000-0000-4000-8000-000000000001",
      bruno: "d2000000-0000-4000-8000-000000000002",
      carla: "d2000000-0000-4000-8000-000000000003",
      tiago: "d2000000-0000-4000-8000-000000000004",
      ines: "d2000000-0000-4000-8000-000000000005",
    };
    const existing = new Set(
      (
        await db
          .select({ id: schema.candidate.id })
          .from(schema.candidate)
          .where(eq(schema.candidate.agencyId, AGENCY))
      ).map((r) => r.id),
    );
    const procs = [
      { n: 1, cand: K.sofia, job: ptJob(2, 1), stage: "submitted" }, // Talkdesk Frontend React
      { n: 2, cand: K.carla, job: ptJob(2, 2), stage: "interview" }, // Talkdesk Backend Node
      { n: 3, cand: K.bruno, job: ptJob(5, 1), stage: "screening" }, // Sword Backend Python
      { n: 4, cand: K.ines, job: ptJob(3, 1), stage: "sourced" }, // Unbabel ML
      { n: 5, cand: K.tiago, job: ptJob(4, 2), stage: "client_iv" }, // OutSystems Cloud
      { n: 6, cand: K.sofia, job: ptJob(6, 2), stage: "screening" }, // Remote Frontend React
    ].filter((p) => existing.has(p.cand));
    if (procs.length > 0) {
      await db
        .insert(schema.process)
        .values(
          procs.map((p) => ({
            id: `e4000000-0000-4000-8000-${hex(p.n, 12)}`,
            agencyId: AGENCY,
            candidateId: p.cand,
            jobId: p.job,
            recruiterId: FILIPA,
            stage: p.stage,
          })),
        )
        .onConflictDoNothing();
    }

    process.stdout.write(
      `[seed-real] concluído. ${ci} empresas PT reais, ${vagas} vagas, ${procs.length} candidatos ligados.\n`,
    );
  } finally {
    await close();
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`[seed-real] ERRO: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
