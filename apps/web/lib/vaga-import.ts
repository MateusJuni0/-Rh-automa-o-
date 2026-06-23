/**
 * Import de vaga por LINK: a Filipa cola um URL (LinkedIn/Google/site) e a Vera vai buscar o texto
 * da página. €0 — só fetch + limpeza de HTML; a extração estruturada é o `extractJobRequirements`
 * (stub sem chave). SEGURANÇA: guard anti-SSRF (só http(s) público; bloqueia localhost/IPs privados).
 */

import { guardedFetch, SsrfBlockedError } from "./net/guarded-fetch";

export type LinkImport =
  | { ok: true; text: string; title: string | null }
  | { ok: false; reason: string };

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);
}

function extractTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) {
    return decodeEntities(og[1]).trim().slice(0, 140);
  }
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t?.[1] ? decodeEntities(t[1]).trim().slice(0, 140) : null;
}

const MAX_BYTES = 1_500_000;

/** Vai buscar o texto da página da vaga. Server-side apenas (fetch de URL externo). */
export async function importVagaFromLink(rawUrl: string): Promise<LinkImport> {
  let res: Response;
  try {
    // Funil anti-SSRF único: valida esquema/host e re-valida cada redirect (anti 30x→IP interno).
    res = await guardedFetch(rawUrl, {
      timeoutMs: 8000,
      headers: { "user-agent": "VeraBot/1.0 (recrutamento)", accept: "text/html" },
    });
  } catch (e) {
    if (e instanceof SsrfBlockedError) {
      return { ok: false, reason: "URL inválido ou não permitido (só http/https público)" };
    }
    return { ok: false, reason: "não consegui aceder a esse link (timeout ou rede)" };
  }
  if (!res.ok) {
    return { ok: false, reason: `a página respondeu ${res.status}` };
  }
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("html") && !ctype.includes("text")) {
    return { ok: false, reason: "o link não é uma página de texto/HTML" };
  }
  const html = (await res.text()).slice(0, MAX_BYTES);
  const text = htmlToText(html);
  if (text.length < 40) {
    return { ok: false, reason: "não consegui extrair texto útil dessa página" };
  }
  return { ok: true, text, title: extractTitle(html) };
}
