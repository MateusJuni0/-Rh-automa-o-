import { randomUUID } from "node:crypto";
import { extractCandidateProfile } from "@rh/ai";
import { type CandidateProfile, candidateProfile } from "@rh/core";
import type { DbHandle } from "@rh/db";
import { schema } from "@rh/db";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { aiOptions } from "./ai";
import { heuristicProfile } from "./cv-heuristics";

type Db = DbHandle["db"];

export interface NewCandidato {
  name: string;
  linkedinUrl?: string;
  /** Email explícito (chave de dedup §12); se ausente, é extraído do CV. */
  email?: string;
  /** Texto do CV — o cérebro extrai o perfil estruturado. */
  cvText: string;
}

export interface CreatedCandidato {
  id: string;
  profile: CandidateProfile;
  /** `true` se resolveu para um candidato JÁ EXISTENTE (dedup §12) em vez de criar um novo. */
  deduped: boolean;
}

/** Perfil de fallback (sem chave de IA): deteção determinística por palavra-chave do CV. */
function stubProfile(input: NewCandidato): CandidateProfile {
  return heuristicProfile(input.cvText);
}

/** Normaliza o nome (sem acentos, minúsculas) para dedup/resolução de entidade (§12). */
function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Resolução de entidade (§12 ALTO5): procura um candidato existente na agência por chaves FORTES
 * (linkedinUrl, email). O nome NÃO entra — homónimos dariam falsos positivos. Candidatos anonimizados
 * têm estas chaves a NULL (RGPD #5b) → nunca são re-encontrados.
 */
async function findCandidateByKeys(
  db: Db,
  agencyId: string,
  keys: { linkedinUrl: string | null; email: string | null },
): Promise<{ id: string; profile: unknown } | null> {
  const keyConds = [
    ...(keys.linkedinUrl ? [eq(schema.candidate.linkedinUrl, keys.linkedinUrl)] : []),
    ...(keys.email ? [eq(schema.candidate.email, keys.email)] : []),
  ];
  if (keyConds.length === 0) {
    return null;
  }
  const [row] = await db
    .select({ id: schema.candidate.id, profile: schema.candidate.profile })
    .from(schema.candidate)
    .where(
      and(
        eq(schema.candidate.agencyId, agencyId),
        isNull(schema.candidate.deletedAt),
        or(...keyConds),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Cria um candidato GLOBAL, extraindo o perfil do CV via `@rh/ai` (real com chave; stub sem). Antes
 * de criar, faz DEDUP por chaves fortes (§12): se já existe um candidato com o mesmo linkedinUrl/email
 * na agência, devolve-o (`deduped:true`) em vez de duplicar o talent pool. Persiste email/phone
 * (extraídos do CV) nas colunas — são as chaves de resolução de entidade.
 */
export async function createCandidato(
  db: Db,
  agencyId: string,
  input: NewCandidato,
): Promise<CreatedCandidato> {
  const contact = extractContact(input.cvText);
  const email = (input.email ?? contact.email)?.toLowerCase() ?? null;
  const linkedinUrl = input.linkedinUrl ?? null;

  const existing = await findCandidateByKeys(db, agencyId, { linkedinUrl, email });
  if (existing) {
    const parsed = candidateProfile.safeParse(existing.profile);
    return {
      id: existing.id,
      profile: parsed.success ? parsed.data : EMPTY_PROFILE,
      deduped: true,
    };
  }

  const profile = await extractCandidateProfile(input.cvText, aiOptions(stubProfile(input)));
  const id = randomUUID();
  await db.insert(schema.candidate).values({
    id,
    agencyId,
    name: input.name,
    linkedinUrl,
    email,
    phone: contact.phone,
    nameNormalized: normalizeName(input.name),
    profile,
  });
  // Guarda o texto bruto do CV para poder mostrá-lo no perfil sem re-upload.
  if (input.cvText.length > 0) {
    await db.insert(schema.sourceDoc).values({
      id: randomUUID(),
      agencyId,
      kind: "cv",
      candidateId: id,
      rawText: input.cvText,
      title: `CV — ${input.name}`,
    });
  }
  return { id, profile, deduped: false };
}

export interface CandidatoRow {
  id: string;
  name: string;
  /** Skills declaradas (extraídas do perfil) — para pesquisa e chips de filtro na lista. */
  skills: string[];
  /** Anos de experiência (do perfil), ou null se n/d — para ordenar a lista. */
  anos: number | null;
}

const EMPTY_PROFILE: CandidateProfile = {
  skillsDeclaradas: [],
  experienciaAnos: null,
  gapsCv: [],
  resumo: "",
};

export async function listCandidatos(db: Db, agencyId: string): Promise<CandidatoRow[]> {
  const rows = await db
    .select({
      id: schema.candidate.id,
      name: schema.candidate.name,
      profile: schema.candidate.profile,
    })
    .from(schema.candidate)
    .where(and(eq(schema.candidate.agencyId, agencyId), isNull(schema.candidate.deletedAt)))
    .orderBy(desc(schema.candidate.createdAt));
  // O `profile` é JSONB — valida na fronteira (não confia no shape da DB), tal como `getCandidato`.
  return rows.map((r) => {
    const parsed = candidateProfile.safeParse(r.profile);
    const profile = parsed.success ? parsed.data : EMPTY_PROFILE;
    return {
      id: r.id,
      name: r.name,
      skills: profile.skillsDeclaradas,
      anos: profile.experienciaAnos,
    };
  });
}

/** Facto do candidato extraído de uma ENTREVISTA (transcrição) — com prova e nível de rubric. */
export interface CandidatoFacto {
  competencia: string;
  factText: string;
  evidenceQuote: string | null;
  evidenceTs: string | null;
  rubricLevel: string | null; // fraco | ok | forte
  factType: string; // statement | skill_demo | gap
}

export interface CandidatoDetail {
  id: string;
  name: string;
  linkedinUrl: string | null;
  profile: CandidateProfile;
  cvText: string | null;
  /** Contacto extraído do CV (para links clicáveis). */
  email: string | null;
  phone: string | null;
  /** O que sabemos das entrevistas (factos com prova) — atualizado pelas transcrições. */
  factos: CandidatoFacto[];
}

/** Extrai email + telefone do texto do CV (para mailto:/tel:). Determinístico, sem IA. */
function extractContact(cv: string | null): { email: string | null; phone: string | null } {
  if (!cv) {
    return { email: null, phone: null };
  }
  const email = cv.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? null;
  const phone = cv.match(/(\+\d{2,3}[\s.-]?)?\d{3}[\s.-]?\d{3}[\s.-]?\d{3}/)?.[0]?.trim() ?? null;
  return { email, phone };
}

export interface ProcessoAtivo {
  processId: string;
  jobId: string;
  jobTitle: string;
  clientName: string | null;
  stage: string;
}

/** Processos ativos de um candidato — vagas em que está e em que fase (para o detalhe do candidato). */
export async function getCandidatoProcessos(
  db: Db,
  agencyId: string,
  candidateId: string,
): Promise<ProcessoAtivo[]> {
  return db
    .select({
      processId: schema.process.id,
      jobId: schema.job.id,
      jobTitle: schema.job.title,
      clientName: schema.client.name,
      stage: schema.process.stage,
    })
    .from(schema.process)
    .innerJoin(schema.job, eq(schema.job.id, schema.process.jobId))
    .leftJoin(schema.client, eq(schema.client.id, schema.job.clientId))
    .where(
      and(
        eq(schema.process.candidateId, candidateId),
        eq(schema.process.agencyId, agencyId),
        isNull(schema.process.deletedAt),
        isNull(schema.job.deletedAt),
      ),
    )
    .orderBy(desc(schema.process.createdAt));
}

/** Detalhe do candidato (Tela 4): valida o perfil JSONB na fronteira (não confia no shape da DB). */
export async function getCandidato(
  db: Db,
  agencyId: string,
  id: string,
): Promise<CandidatoDetail | null> {
  const [[row], cvRows, factRows] = await Promise.all([
    db
      .select({
        id: schema.candidate.id,
        name: schema.candidate.name,
        linkedinUrl: schema.candidate.linkedinUrl,
        profile: schema.candidate.profile,
      })
      .from(schema.candidate)
      .where(
        and(
          eq(schema.candidate.id, id),
          eq(schema.candidate.agencyId, agencyId),
          isNull(schema.candidate.deletedAt),
        ),
      ),
    db
      .select({ rawText: schema.sourceDoc.rawText })
      .from(schema.sourceDoc)
      .where(and(eq(schema.sourceDoc.candidateId, id), eq(schema.sourceDoc.kind, "cv")))
      .orderBy(desc(schema.sourceDoc.fetchedAt))
      .limit(1),
    db
      .select({
        competencia: schema.candidateMemoryFact.competencia,
        factText: schema.candidateMemoryFact.factText,
        evidenceQuote: schema.candidateMemoryFact.evidenceQuote,
        evidenceTs: schema.candidateMemoryFact.evidenceTs,
        rubricLevel: schema.candidateMemoryFact.rubricLevel,
        factType: schema.candidateMemoryFact.factType,
      })
      .from(schema.candidateMemoryFact)
      .where(
        and(
          eq(schema.candidateMemoryFact.candidateId, id),
          eq(schema.candidateMemoryFact.agencyId, agencyId),
        ),
      )
      .orderBy(desc(schema.candidateMemoryFact.createdAt))
      .limit(24),
  ]);
  if (!row) {
    return null;
  }
  const parsed = candidateProfile.safeParse(row.profile);
  const cvText = cvRows[0]?.rawText ?? null;
  const { email, phone } = extractContact(cvText);
  return {
    id: row.id,
    name: row.name,
    linkedinUrl: row.linkedinUrl,
    profile: parsed.success ? parsed.data : EMPTY_PROFILE,
    cvText,
    email,
    phone,
    factos: factRows,
  };
}
