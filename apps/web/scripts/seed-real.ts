/**
 * Seed de DADOS REAIS (demo IRIS Tech) — empresas reais com logos, vagas reais (Remotive),
 * + factos/critérios/reunião de intake sintetizados de forma plausível. Fixture: scripts/real-jobs.json
 * (gerado de https://remotive.com/api/remote-jobs). Idempotente (ids fixos + delete/insert dos factos).
 *
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vera_dev \
 *     pnpm --filter web exec tsx scripts/seed-real.ts
 */
import { readFileSync } from "node:fs";
import { createDb, schema } from "@rh/db";
import { eq } from "drizzle-orm";

const AGENCY = "11111111-0000-4000-8000-000000000001";
const FILIPA = "22222222-0000-4000-8000-000000000001";

interface RealJob {
  title: string;
  requirements: string;
  tags: string[];
}
interface RealCompany {
  company: string;
  logo: string;
  sector: string;
  location: string;
  jobs: RealJob[];
}

const WEBSITE: Record<string, string> = {
  EverAI: "https://ever.ai",
  "A.Team": "https://a.team",
  "Quinncia Inc": "https://quinncia.io",
  "Mitre Media": "https://mitremedia.com",
  "Lemon.io": "https://lemon.io",
  nooro: "https://nooro.com",
};
const DESCRIPTION: Record<string, string> = {
  EverAI:
    "Plataforma de IA generativa para criação de vídeo cinematográfico. Equipa global, produto consumer com forte componente de IA.",
  "A.Team":
    "Rede de talento tech sénior independente — liga engenheiros e arquitetos de topo a projetos exigentes.",
  "Quinncia Inc":
    "Produto de carreira e recrutamento assistido por IA. Equipa pequena, totalmente remota.",
  "Mitre Media":
    "Media e produtos digitais na área financeira, construídos em Rails. Plataformas de conteúdo a escala.",
  "Lemon.io":
    "Marketplace que liga programadores a startups por todo o mundo. Crescimento rápido e cultura de produto.",
  nooro:
    "Health-tech com app móvel (iOS) para gestão de dor e bem-estar. Produto consumer no mercado dos EUA.",
};

function nivelFor(title: string): string {
  const t = title.toLowerCase();
  if (/(head|lead|principal|staff|director)/.test(t)) return "lead";
  if (/(senior|sénior|sr\.)/.test(t)) return "senior";
  if (/(junior|júnior|jr\.)/.test(t)) return "junior";
  return "pleno";
}
const hex = (n: number, len: number): string => String(n).padStart(len, "0");

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("falta DATABASE_URL");
  }
  const companies: RealCompany[] = JSON.parse(
    readFileSync(new URL("./real-jobs.json", import.meta.url), "utf8"),
  );
  const { db, close } = createDb(databaseUrl);
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-PT");
    let ci = 0;
    let vagas = 0;
    for (const co of companies) {
      ci += 1;
      const clientId = `e1000000-0000-4000-8000-${hex(ci, 12)}`;
      const profile = {
        sector: co.sector,
        website: WEBSITE[co.company] ?? null,
        description: DESCRIPTION[co.company] ?? `${co.sector}. Equipa remota (${co.location}).`,
        logoUrl: co.logo,
      };
      await db
        .insert(schema.client)
        .values({
          id: clientId,
          agencyId: AGENCY,
          name: co.company,
          notes: `Remoto • ${co.location}`,
          ...profile,
        })
        .onConflictDoNothing();
      await db.update(schema.client).set(profile).where(eq(schema.client.id, clientId));

      const allTags: string[] = [];
      let ji = 0;
      for (const job of co.jobs) {
        ji += 1;
        vagas += 1;
        const jobId = `e2000000-0000-4000-8000-${hex(ci, 6)}${hex(ji, 6)}`;
        const tags = job.tags.length > 0 ? job.tags : ["Software"];
        allTags.push(...tags);
        const slug = job.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .slice(0, 40);
        await db
          .insert(schema.job)
          .values({
            id: jobId,
            agencyId: AGENCY,
            clientId,
            recruiterId: FILIPA,
            title: job.title,
            roleTypeSlug: slug,
            requirements: {
              roleType: slug,
              nivel: nivelFor(job.title),
              skills: { must: tags.slice(0, 3), nice: tags.slice(3, 5) },
              contexto: job.requirements.slice(0, 400),
            },
          })
          .onConflictDoNothing();
      }

      const topTags = [...new Set(allTags)].slice(0, 4);
      await db.delete(schema.clientMemoryFact).where(eq(schema.clientMemoryFact.clientId, clientId));
      const facts: Array<{ t: string; text: string; ref?: string; snippet?: string }> = [
        {
          t: "preference",
          text: `Valoriza experiência sólida em ${topTags.slice(0, 2).join(" e ") || "tecnologia"}`,
        },
        { t: "preference", text: "Quer autonomia e à-vontade para trabalhar remoto sem supervisão" },
        {
          t: "rejection_reason",
          text: `Não avança com perfis sem experiência prática em ${topTags[0] ?? "tecnologia"}`,
        },
        {
          t: "context",
          text: `Equipa 100% remota (${co.location}). Processo rápido, 2 a 3 etapas.`,
        },
        {
          t: "meeting",
          text: "Reunião de intake — alinhamento do perfil e prioridades de contratação",
          ref: `Intake • ${dateStr}`,
          snippet: `"...precisamos de alguém forte em ${topTags[0] ?? "produto"}, que pegue no problema de ponta a ponta. Remoto é OK, mas tem de comunicar muito bem por escrito. Time-to-hire ideal: 3 semanas."`,
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
        ...topTags.slice(0, 2).map((c) => ({ criterio: c, peso: "must" })),
        ...topTags.slice(2, 4).map((c) => ({ criterio: c, peso: "nice" })),
        { criterio: "Comunicação escrita forte (equipa remota)", peso: "must" },
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
    process.stdout.write(`[seed-real] concluído. ${ci} empresas reais, ${vagas} vagas.\n`);
  } finally {
    await close();
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`[seed-real] ERRO: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
