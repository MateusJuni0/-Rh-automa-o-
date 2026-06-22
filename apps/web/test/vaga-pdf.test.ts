import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { importVagaFromPdf, titleFromPdfText } from "../lib/vaga-pdf";

/** Gera um PDF mínimo VÁLIDO (xref com offsets corretos) com `text` numa linha — fixture sem ficheiros. */
function makePdf(text: string): Uint8Array {
  const stream = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets[i] = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const DOCX_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK..

describe("vaga-pdf — titleFromPdfText (puro)", () => {
  it("devolve a 1ª linha de jeito (o cargo no topo)", () => {
    expect(titleFromPdfText("Senior React Engineer\nLisboa · Remoto\n…")).toBe(
      "Senior React Engineer",
    );
  });

  it("salta linhas vazias e fragmentos curtos", () => {
    expect(titleFromPdfText("\n   \nok\nDesigner de Produto")).toBe("Designer de Produto");
  });

  it("ignora parágrafos longos (>120) e cai na linha seguinte curta", () => {
    const longo = "x".repeat(130);
    expect(titleFromPdfText(`${longo}\nGestor de Projeto`)).toBe("Gestor de Projeto");
  });

  it("ignora linhas decorativas / só-números (sem letras)", () => {
    expect(titleFromPdfText("------\n12\nGestor de Produto")).toBe("Gestor de Produto");
  });

  it("sem nenhuma linha aproveitável → null", () => {
    expect(titleFromPdfText("\n  \n")).toBeNull();
  });
});

describe("vaga-pdf — importVagaFromPdf (extração real via unpdf)", () => {
  it("extrai o texto de um PDF válido e infere o título", async () => {
    const r = await importVagaFromPdf({
      bytes: makePdf("Senior React Engineer Lisboa Remoto"),
      filename: "vaga.pdf",
      mime: "application/pdf",
      agencyId: randomUUID(),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain("Senior React Engineer");
      expect(r.title).not.toBeNull();
      expect(r.title).toContain("Senior React");
    }
  });
});

describe("vaga-pdf — importVagaFromPdf (rejeições, sem tocar no unpdf)", () => {
  it("conteúdo não-PDF disfarçado de .pdf → rejeitado pelos magic-bytes", async () => {
    const r = await importVagaFromPdf({
      bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 1, 2, 3]), // GIF8…
      filename: "vaga.pdf",
      mime: "application/pdf",
      agencyId: randomUUID(),
    });
    expect(r.ok).toBe(false);
  });

  it("DOCX (válido p/ CV) é recusado aqui — só lemos PDF", async () => {
    const r = await importVagaFromPdf({
      bytes: new Uint8Array([...DOCX_MAGIC, 0, 0, 0, 0, 9, 9]),
      filename: "vaga.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      agencyId: randomUUID(),
    });
    expect(r).toEqual({ ok: false, reason: "para já só lemos PDF — cola o texto para DOC/DOCX" });
  });

  it("agência inválida (não-UUID) → rejeitado antes de tudo", async () => {
    const r = await importVagaFromPdf({
      bytes: new Uint8Array([...PDF_MAGIC, 0, 0, 0, 0]),
      filename: "vaga.pdf",
      mime: "application/pdf",
      agencyId: "not-a-uuid",
    });
    expect(r).toEqual({ ok: false, reason: "agência inválida" });
  });
});
