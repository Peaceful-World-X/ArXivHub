import { createPaperMetricCache, type MetricSnapshot } from "./paper-metric-cache.ts";
import { validCitations, type PaperCitations } from "./semantic-scholar.ts";

export type ScholarPageContext = { id: string; title?: string; doi?: string; paperId?: string };

const ORIGIN = "https://www.semanticscholar.org";
const DAY = 24 * 60 * 60 * 1000;
const HASH = /^[a-f0-9]{40}$/i;
// These identities were supplied and checked against the original paper pages.
// Counts always come from the source; they are never part of this mapping.
const KNOWN_PAPERS: Record<string, { title: string; paperId: string }> = {
  "1706.03762": { title: "Attention is All you Need", paperId: "204e3073870fae3d05bcbc2f6a8e263d9b72e776" },
  "2303.08774": { title: "GPT-4 Technical Report", paperId: "163b4d6a79a5b19af88b8585456363340d9efd04" },
  "2608.05594": { title: "JTA: Joint Testability Architecture for Scenario-Based Validation of Safety-Critical Software", paperId: "a5641fd9bbe87d5da393ea06817a9bd325acd07b" },
};
const RETRY_KEY = "arxivhub:semantic-scholar-page:retry-at";
let retryAt = 0;

const cache = createPaperMetricCache<PaperCitations>({
  namespace: "semantic-scholar-page:v1", ttl: DAY, maxAge: 7 * DAY, missingTtl: 5 * 60 * 1000,
  valid: validCitations,
});

function normalizeId(id: string): string {
  return id.trim().replace(/v\d+$/i, "").toLowerCase();
}

function normalizeTitle(title: string): string {
  return title.normalize("NFKC").replace(/&amp;/gi, "&").replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'").replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/[*_`]/g, "").replace(/[’‘]/g, "'").replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeDoi(raw = ""): string {
  return raw.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase();
}

function sourceUrl(text: string): URL {
  const source = text.match(/^URL Source:\s*(https?:\/\/\S+)\s*$/m)?.[1];
  if (!source) throw new Error("Semantic Scholar Reader source is missing");
  const url = new URL(source);
  if (url.origin !== ORIGIN || url.username || url.password) throw new Error("Untrusted Semantic Scholar source");
  return url;
}

function paperIdFromUrl(url: URL): string | undefined {
  return url.origin === ORIGIN ? url.pathname.match(/^\/paper\/(?:[^/]+\/)?([a-f0-9]{40})\/?$/i)?.[1].toLowerCase() : undefined;
}

function readerBody(text: string): string {
  const marker = "Markdown Content:";
  const index = text.indexOf(marker);
  if (index < 0 || /Target URL returned error [45]\d\d/i.test(text.slice(0, index))) {
    throw new Error("Semantic Scholar source unavailable");
  }
  const body = text.slice(index + marker.length).trim();
  if (!body) throw new Error("Semantic Scholar source is empty");
  return body;
}

function links(text: string): URL[] {
  return Array.from(text.matchAll(/\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g), (match) => {
    try { return new URL(match[1]); } catch { return null; }
  }).filter((url): url is URL => url !== null);
}

class IdentityMismatchError extends Error {}
class MissingCitationTotalError extends Error {}

function validatePaperIdentity(title: string | undefined, mainLinks: URL[], ctx: ScholarPageContext, paperId: string, allowTrustedId = true) {
  const id = normalizeId(ctx.id);
  const known = KNOWN_PAPERS[id];
  const expectedTitle = ctx.title?.trim() || known?.title;
  if (!title) throw new Error("Semantic Scholar paper title is missing");
  if (expectedTitle && normalizeTitle(title) !== normalizeTitle(expectedTitle)) {
    throw new IdentityMismatchError("Semantic Scholar paper title does not match");
  }

  const arxivIds = mainLinks.filter((url) => /^(?:www\.)?arxiv\.org$/i.test(url.hostname))
    .map((url) => url.pathname.match(/^\/(?:abs|pdf)\/(.+)$/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeId(decodeURIComponent(value).replace(/\.pdf$/i, "")));
  const doi = normalizeDoi(ctx.doi);
  const dois = mainLinks.filter((url) => /^(?:dx\.)?doi\.org$/i.test(url.hostname))
    .map((url) => normalizeDoi(decodeURIComponent(url.pathname.slice(1))));
  const arxivDoi = `10.48550/arxiv.${id}`;
  const sourceArxivDois = dois.filter((value) => value.startsWith("10.48550/arxiv."));
  const arxivMatches = arxivIds.includes(id) || sourceArxivDois.includes(arxivDoi);
  const trustedId = allowTrustedId && (known?.paperId === paperId.toLowerCase() || ctx.paperId?.toLowerCase() === paperId.toLowerCase());
  if ((arxivIds.length > 0 && !arxivIds.includes(id)) ||
      (sourceArxivDois.length > 0 && !sourceArxivDois.includes(arxivDoi)) ||
      (doi && dois.length > 0 && !dois.includes(doi) && !arxivMatches) ||
      (!arxivMatches && !(doi && dois.includes(doi)) && !trustedId)) {
    throw new IdentityMismatchError("Semantic Scholar external identifiers do not match");
  }
}

/** Read only the primary paper's total, before citation/reference result lists. */
export function parseSemanticScholarPage(text: string, ctx: ScholarPageContext, paperId: string): PaperCitations {
  if (!HASH.test(paperId) || paperIdFromUrl(sourceUrl(text)) !== paperId.toLowerCase()) {
    throw new IdentityMismatchError("Semantic Scholar paper URL does not match");
  }
  const body = readerBody(text);
  const main = body.split(/^##\s/m, 1)[0];
  validatePaperIdentity(main.match(/^#\s+(.+)$/m)?.[1], links(main), ctx, paperId);
  const totalLines = Array.from(main.matchAll(/^([\d,]+) Citations?\s*$/gm), (match) => match[1]);
  const sectionLines = Array.from(body.matchAll(/^## ([\d,]+) Citations?\s*$/gm), (match) => match[1]);
  if (!totalLines.length && !sectionLines.length) {
    // The site hides zero totals in its rendered page. This is not evidence of zero.
    throw new MissingCitationTotalError("Missing Semantic Scholar citation total");
  }
  const numbers = [...totalLines, ...sectionLines].map((value) =>
    /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value) ? Number(value.replaceAll(",", "")) : NaN);
  if (!totalLines.length || !numbers.every((value) => Number.isSafeInteger(value) && value >= 0 && value === numbers[0])) {
    throw new Error("Missing or inconsistent Semantic Scholar citation total");
  }
  return { paperId: paperId.toLowerCase(), citationCount: numbers[0] };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Inspect the official page's serialized data without executing any page script. */
export function parseSemanticScholarHtml(html: string, ctx: ScholarPageContext, paperId: string): PaperCitations {
  const payloads = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1].match(/^\s*var\s+DATA\s*=\s*'([A-Za-z0-9+/=]+)';?\s*$/)?.[1])
    .filter((value): value is string => Boolean(value));
  if (!HASH.test(paperId) || payloads.length !== 1) throw new Error("Invalid Semantic Scholar page data");
  const data: unknown = JSON.parse(decodeURIComponent(atob(payloads[0])));
  if (!Array.isArray(data)) throw new Error("Invalid Semantic Scholar page data");
  const details = data.map(object).filter((row) => row.actionType === "API_REQUEST_COMPLETE" && row.requestType === "PAPER_DETAIL");
  const detail = details[0];
  const expectedId = paperId.toLowerCase();
  const paper = object(object(detail?.resultData).paper);
  if (details.length !== 1 || detail.responseStatus !== 200 || object(detail.pathParams).paperId !== expectedId || paper.id !== expectedId) {
    throw new IdentityMismatchError("Semantic Scholar page data identity does not match");
  }
  const title = object(paper.title).text;
  const primaryLink = object(paper.primaryPaperLink).url;
  if (typeof title !== "string" || typeof primaryLink !== "string") throw new Error("Missing Semantic Scholar page identity");
  validatePaperIdentity(title, [new URL(primaryLink)], ctx, paperId, false);
  const citationCount = object(paper.citationStats).numCitations;
  if (typeof citationCount !== "number" || !Number.isSafeInteger(citationCount) || citationCount < 0) {
    throw new Error("Invalid Semantic Scholar page citation total");
  }
  return { paperId: expectedId, citationCount };
}

function searchUrl(title: string): string {
  const url = new URL("/search", ORIGIN);
  url.searchParams.set("q", title.trim());
  url.searchParams.set("sort", "relevance");
  return url.href;
}

export function readCachedSemanticScholarPage(id: string): MetricSnapshot<PaperCitations> | undefined {
  return cache.peek(normalizeId(id));
}

export function semanticScholarPageUrl(ctx: ScholarPageContext): string {
  const id = normalizeId(ctx.id);
  const paperId = ctx.paperId && HASH.test(ctx.paperId) ? ctx.paperId :
    readCachedSemanticScholarPage(id)?.value?.paperId || KNOWN_PAPERS[id]?.paperId;
  return paperId ? `${ORIGIN}/paper/${paperId.toLowerCase()}` : ctx.title?.trim() ? searchUrl(ctx.title) : `${ORIGIN}/`;
}

function rateLimited(retryAfter: string | null = null): never {
  const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0;
  const date = retryAfter && !seconds ? Date.parse(retryAfter) : 0;
  retryAt = Math.max(Date.now() + 60000, seconds ? Date.now() + seconds : date || 0);
  try { localStorage.setItem(RETRY_KEY, String(retryAt)); } catch { /* Optional storage. */ }
  throw new Error("Semantic Scholar Reader rate limited");
}

async function readPage(url: string, html = false): Promise<string | null> {
  try { retryAt = Math.max(retryAt, Number(localStorage.getItem(RETRY_KEY)) || 0); } catch { /* Optional storage. */ }
  if (retryAt > Date.now()) throw new Error("Semantic Scholar Reader rate limited");
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: html ? { Accept: "text/html", "X-Return-Format": "html" } : { Accept: "text/plain" },
    signal: AbortSignal.timeout(html ? 20000 : 12000),
  });
  if (response.status === 429) rateLimited(response.headers.get("retry-after"));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Semantic Scholar Reader ${response.status}`);
  const text = await response.text();
  const header = text.slice(0, Math.max(0, text.indexOf("Markdown Content:")));
  if (/Target URL returned error 429/i.test(header)) rateLimited();
  if (/Target URL returned error 404/i.test(header)) return null;
  return text;
}

async function loadPaperPage(ctx: ScholarPageContext, paperId: string): Promise<PaperCitations | null> {
  const url = `${ORIGIN}/paper/${paperId}`;
  const text = await readPage(url);
  if (text === null) return null;
  try {
    return parseSemanticScholarPage(text, ctx, paperId);
  } catch (error) {
    // This exception is raised only after the Markdown paper identity is verified.
    if (!(error instanceof MissingCitationTotalError)) throw error;
    const html = await readPage(url, true);
    if (html === null) throw new Error("Semantic Scholar page data unavailable");
    return parseSemanticScholarHtml(html, ctx, paperId);
  }
}

async function discoverPaper(ctx: ScholarPageContext): Promise<PaperCitations | null> {
  const title = ctx.title!.trim();
  const text = await readPage(searchUrl(title));
  if (text === null) return null;
  const source = sourceUrl(text);
  if (source.pathname !== "/search" || normalizeTitle(source.searchParams.get("q") || "") !== normalizeTitle(title)) {
    throw new Error("Semantic Scholar search source does not match");
  }
  const candidates = [...new Set(links(readerBody(text)).map(paperIdFromUrl).filter((id): id is string => Boolean(id)))].slice(0, 3);
  let failure: unknown;
  for (const paperId of candidates) {
    try {
      const result = await loadPaperPage(ctx, paperId);
      if (result !== null) return result;
    } catch (error) {
      if (!(error instanceof IdentityMismatchError)) failure = error;
      if (retryAt > Date.now()) throw error;
    }
  }
  if (failure) throw failure;
  return null;
}

export async function fetchSemanticScholarPage(ctx: ScholarPageContext): Promise<PaperCitations | null> {
  const id = normalizeId(ctx.id);
  if (!/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})$/i.test(id)) throw new Error("Invalid arXiv ID");
  const saved = readCachedSemanticScholarPage(id);
  if (saved?.value && !saved.stale) return saved.value;
  const paperId = ctx.paperId && HASH.test(ctx.paperId) ? ctx.paperId.toLowerCase() :
    saved?.value?.paperId || KNOWN_PAPERS[id]?.paperId;
  // Metadata often arrives after the ID. Do not cache that temporary absence.
  if (!paperId && !ctx.title?.trim()) return null;
  const context = { ...ctx, id, paperId };
  // Misses depend on lookup context; a title/DOI arriving later must be retried.
  const attemptKey = `${id}:lookup:${paperId || JSON.stringify([normalizeTitle(ctx.title || ""), normalizeDoi(ctx.doi)])}`;
  const result = await cache.get(attemptKey, async () => {
    if (!paperId) return discoverPaper(context);
    return loadPaperPage(context, paperId);
  });
  return result === null ? null : cache.get(id, async () => result);
}
