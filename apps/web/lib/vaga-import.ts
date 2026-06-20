/**
 * Import de vaga por LINK: a Filipa cola um URL (LinkedIn/Google/site) e a Vera vai buscar o texto
 * da página. €0 — só fetch + limpeza de HTML; a extração estruturada é o `extractJobRequirements`
 * (stub sem chave). SEGURANÇA: guard anti-SSRF (só http(s) público; bloqueia localhost/IPs privados).
 */

export type LinkImport =
  | { ok: true; text: string; title: string | null }
  | { ok: false; reason: string };

/** Recusa URLs perigosos (SSRF): protocolo não-http, localhost, IPs privados/link-local. */
function isSafeUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return null;
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) {
    return null;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return null;
  }
  if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd")) {
    return null;
  }
  return u;
}

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
  const url = isSafeUrl(rawUrl);
  if (!url) {
    return { ok: false, reason: "URL inválido ou não permitido (só http/https público)" };
  }
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "VeraBot/1.0 (recrutamento)", accept: "text/html" },
    });
  } catch {
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
