import { is } from "drizzle-orm";
import { getTableConfig, type PgColumn, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../src/schema";

const isPgTable = (v: unknown): v is PgTable => is(v, PgTable);
// `schema` também exporta EMBEDDING_DIM (number) → tipar como unknown[] força o guard limpo.
const allExports: unknown[] = Object.values(schema);
const tables = allExports.filter(isPgTable);

const byName = new Map(tables.map((t) => [getTableConfig(t).name, t]));

function config(name: string) {
  const t = byName.get(name);
  if (!t) throw new Error(`tabela '${name}' não existe no schema`);
  return getTableConfig(t);
}
function cols(name: string): Set<string> {
  return new Set(config(name).columns.map((c) => c.name));
}
function col(name: string, colName: string): PgColumn {
  const c = config(name).columns.find((x) => x.name === colName);
  if (!c) throw new Error(`coluna '${name}.${colName}' não existe`);
  return c;
}

/** As 35 tabelas canónicas (MODELO-DADOS "Migração de arranque"). */
const EXPECTED_TABLES = [
  "agency",
  "recruiter",
  "client",
  "client_memory_fact",
  "client_criteria",
  "job",
  "role_profile",
  "rubric",
  "document",
  "candidate",
  "candidate_memory_fact",
  "candidate_memory_embedding",
  "process",
  "client_verdict",
  "placement_outcome",
  "interview",
  "interview_tick",
  "interview_gap",
  "interview_participant",
  "transcript_chunk",
  "transcript_chunk_embedding",
  "contradiction",
  "report",
  "source_doc",
  "source_doc_embedding",
  "recruiter_memory_fact",
  "recruiter_memory_embedding",
  "assistant_thread",
  "assistant_message",
  "assistant_action",
  "async_job",
  "agenda_event",
  "proactive_task",
  "intake_session",
  "intake_message",
] as const;

describe("schema canónico — contagem e cobertura", () => {
  it("tem exatamente 35 tabelas", () => {
    expect(tables.length).toBe(35);
    expect(EXPECTED_TABLES.length).toBe(35);
  });

  it("é exatamente o conjunto canónico (sem faltas nem extras)", () => {
    expect(new Set(byName.keys())).toEqual(new Set(EXPECTED_TABLES));
  });

  it("tem só as 4 tabelas de embedding (candidate/transcript/source/recruiter)", () => {
    const emb = [...byName.keys()].filter((n) => n.endsWith("_embedding")).sort();
    expect(emb).toEqual([
      "candidate_memory_embedding",
      "recruiter_memory_embedding",
      "source_doc_embedding",
      "transcript_chunk_embedding",
    ]);
    expect(byName.has("client_memory_embedding")).toBe(false);
  });
});

describe("famílias G1/G2 — process_id canónico (sem job_id/candidate_id)", () => {
  it("interview deriva de process: tem process_id, NÃO tem job_id/candidate_id", () => {
    const c = cols("interview");
    expect(c.has("process_id")).toBe(true);
    expect(c.has("job_id")).toBe(false);
    expect(c.has("candidate_id")).toBe(false);
  });

  it("interview.process_id é NULLABLE (entrevista órfã / cold-start §12/§16M)", () => {
    expect(col("interview", "process_id").notNull).toBe(false);
  });

  it("client_verdict e placement_outcome usam process_id (NOT NULL), sem job_id/candidate_id", () => {
    for (const name of ["client_verdict", "placement_outcome"]) {
      const c = cols(name);
      expect(c.has("process_id")).toBe(true);
      expect(c.has("job_id")).toBe(false);
      expect(c.has("candidate_id")).toBe(false);
      expect(col(name, "process_id").notNull).toBe(true);
    }
  });

  it("candidate_memory_fact migra job_id → process_id", () => {
    const c = cols("candidate_memory_fact");
    expect(c.has("process_id")).toBe(true);
    expect(c.has("job_id")).toBe(false);
  });
});

describe("famílias A/F/L — proveniência, requisito canónico, veredito graduado durável", () => {
  it("A: candidate_memory_fact tem source_chunk_id + source_document_id (proveniência dura)", () => {
    const c = cols("candidate_memory_fact");
    expect(c.has("source_chunk_id")).toBe(true);
    expect(c.has("source_document_id")).toBe(true);
  });

  it("F: requisito_id canónico em candidate_memory_fact e contradiction", () => {
    expect(cols("candidate_memory_fact").has("requisito_id")).toBe(true);
    expect(cols("contradiction").has("requisito_id")).toBe(true);
  });

  it("L: veredito graduado durável (rubric_level/confianca/parent_fact_id)", () => {
    const c = cols("candidate_memory_fact");
    expect(c.has("rubric_level")).toBe(true);
    expect(c.has("confianca")).toBe(true);
    expect(c.has("parent_fact_id")).toBe(true);
  });

  it("RGPD §5: classificacao + usar_no_score governam o score", () => {
    const c = cols("candidate_memory_fact");
    expect(c.has("classificacao")).toBe(true);
    expect(c.has("usar_no_score")).toBe(true);
    expect(c.has("estado_prova")).toBe(true);
  });
});

describe("famílias H/I/B/M — destilação, idempotência, ciclo do parecer, role-binding", () => {
  it("H: interview.distilled_at = gate da purga de áudio", () => {
    expect(cols("interview").has("distilled_at")).toBe(true);
  });

  it("I: assistant_action tem idempotency_key + provider_message_id + efeito", () => {
    const c = cols("assistant_action");
    expect(c.has("idempotency_key")).toBe(true);
    expect(c.has("provider_message_id")).toBe(true);
    expect(c.has("efeito")).toBe(true);
  });

  it("B: report.status existe (ciclo de vida durável)", () => {
    expect(cols("report").has("status")).toBe(true);
  });

  it("M: interview_participant faz track→role; contradiction.process_id é nullable (balde órfão)", () => {
    const c = cols("interview_participant");
    expect(c.has("track_id")).toBe(true);
    expect(c.has("speaker_role")).toBe(true);
    expect(col("contradiction", "process_id").notNull).toBe(false);
  });
});

describe("família K + §15.8 — pesquisa robusta + não-repúdio", () => {
  it("K: source_doc tem fetch_status + fetch_cost_usd", () => {
    const c = cols("source_doc");
    expect(c.has("fetch_status")).toBe(true);
    expect(c.has("fetch_cost_usd")).toBe(true);
  });

  it("§15.8: transcript_chunk é tamper-evident (content_hash + prev_hash)", () => {
    const c = cols("transcript_chunk");
    expect(c.has("content_hash")).toBe(true);
    expect(c.has("prev_hash")).toBe(true);
  });
});

describe("pgvector — dimensão e tipo das 4 tabelas de embedding", () => {
  const embTables = [
    "candidate_memory_embedding",
    "transcript_chunk_embedding",
    "source_doc_embedding",
    "recruiter_memory_embedding",
  ];
  it.each(embTables)("%s.embedding é vector(1536) NOT NULL", (name) => {
    const c = col(name, "embedding");
    expect(c.getSQLType()).toBe("vector(1536)");
    expect(c.notNull).toBe(true);
  });
});

describe("defesa-em-profundidade §15.1 — agency_id como predicado", () => {
  // Única exceção: 'agency' (é o próprio tenant — tem 'id', não 'agency_id').
  // Guia consolidação item 9: agency_id em TODAS as outras tabelas (incl. interview_tick/assistant_message).
  const exceptions = new Set(["agency"]);
  it("todas as tabelas de negócio têm agency_id NOT NULL", () => {
    for (const name of EXPECTED_TABLES) {
      if (exceptions.has(name)) continue;
      const agency = config(name).columns.find((c) => c.name === "agency_id");
      expect(agency, `${name} devia ter agency_id`).toBeDefined();
      expect(agency?.notNull, `${name}.agency_id devia ser NOT NULL`).toBe(true);
    }
  });
});
