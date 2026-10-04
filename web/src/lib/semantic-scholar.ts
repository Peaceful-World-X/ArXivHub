import { createPaperMetricCache, type MetricSnapshot } from "./paper-metric-cache.ts";

export type PaperCitations = { paperId: string; citationCount: number };

const RETRY_KEY = "arxivhub:semantic-scholar:retry-at";
const DAY = 24 * 60 * 60 * 1000;
let retryAt = 0;
let nextRequestAt = 0;

class RateLimitError extends Error {}

export function normalizePublishedDoi(raw?: string): string | null {
  const doi = raw?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase();
  // arXiv's own DOI points to the same ARXIV lookup, not a second publication.
  return doi && /^10\.\d{4,9}\/\S+$/.test(doi) && !/^10\.48550\/arxiv\./.test(doi) ? doi : null;
}

export function validCitations(value: unknown): value is PaperCitations {
  if (!value || typeof value !== "object") return false;
  return "paperId" in value && typeof value.paperId === "string" && /^[a-f0-9]{40}$/i.test(value.paperId) &&
    "citationCount" in value && typeof value.citationCount === "number" &&
    Number.isSafeInteger(value.citationCount) && value.citationCount >= 0;
}

const cache = createPaperMetricCache<PaperCitations>({
  namespace: "semantic-scholar:v1", ttl: DAY, maxAge: 7 * DAY, missingTtl: DAY / 24, valid: validCitations,
});

// Match the requested identifier as well as the count; never infer citations from a title search.
export function parseSemanticScholarCitations(value: unknown, identifier: string): PaperCitations {
  if (/^[a-f0-9]{40}$/i.test(identifier)) {
    if (!validCitations(value) || value.paperId.toLowerCase() !== identifier.toLowerCase()) throw new Error("Invalid Semantic Scholar paper ID");
    return { paperId: value.paperId, citationCount: value.citationCount };
  }
  const isDoi = identifier.startsWith("DOI:");
  const expected = identifier.replace(/^(?:ARXIV|DOI):/, "");
  const field = isDoi ? "DOI" : "ArXiv";
  const normalize = (text: string) => (isDoi ? text : text.replace(/v\d+$/i, "")).toLowerCase();
  if (!validCitations(value) || !("externalIds" in value) || !value.externalIds ||
      typeof value.externalIds !== "object" || !(field in value.externalIds) ||
      typeof (value.externalIds as Record<string, unknown>)[field] !== "string" ||
      normalize((value.externalIds as Record<string, string>)[field]) !== normalize(expected)) {
    throw new Error("Invalid Semantic Scholar paper or citation count");
  }
  return { paperId: value.paperId, citationCount: value.citationCount };
}

function checkCooldown() {
  try { retryAt = Math.max(retryAt, Number(localStorage.getItem(RETRY_KEY)) || 0); } catch { /* Optional storage. */ }
  if (retryAt > Date.now()) throw new RateLimitError("Semantic Scholar rate limited");
}

async function waitForRequestSlot() {
  checkCooldown();
  // Citation Tally also spaces anonymous requests by at least three seconds.
  const startAt = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = startAt + 3000;
  const delay = startAt - Date.now();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  checkCooldown();
}

function rateLimited(retryAfter: string | null = null): never {
  const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0;
  const date = retryAfter && !seconds ? Date.parse(retryAfter) : 0;
  retryAt = Math.max(Date.now() + 60000, seconds ? Date.now() + seconds : date || 0);
  try { localStorage.setItem(RETRY_KEY, String(retryAt)); } catch { /* Optional storage. */ }
  throw new RateLimitError("Semantic Scholar rate limited");
}

export function parseSemanticScholarReader(text: string, identifier: string): PaperCitations | null {
  // Reader can return HTTP 200 while the source API returned an error.
  if (/Target URL returned error 429|Too Many Requests/i.test(text)) rateLimited();
  const marker = "Markdown Content:";
  const body = (text.includes(marker) ? text.slice(text.indexOf(marker) + marker.length) : text).trim();
  const value: unknown = JSON.parse(body);
  const paperId = /^(?:ARXIV|DOI):|^[a-f0-9]{40}$/i.test(identifier) ? identifier : `ARXIV:${identifier}`;
  if (value && typeof value === "object" && "error" in value &&
      value.error === `Paper with id ${paperId} not found`) return null;
  if (/Target URL returned error [45]\d\d/i.test(text)) throw new Error("Semantic Scholar source unavailable");
  return parseSemanticScholarCitations(value, identifier);
}

async function loadCitations(identifier: string): Promise<PaperCitations | null> {
  const separator = identifier.indexOf(":");
  const path = separator < 0 ? identifier : `${identifier.slice(0, separator)}:${encodeURIComponent(identifier.slice(separator + 1))}`;
  const endpoint = `https://api.semanticscholar.org/graph/v1/paper/${path}?fields=citationCount,externalIds`;
  await waitForRequestSlot();
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (response.status === 429) rateLimited(response.headers.get("retry-after"));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Semantic Scholar ${response.status}`);
    return parseSemanticScholarCitations(await response.json(), identifier);
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    // Some API responses lack CORS headers. Read the same official JSON through Reader.
  }
  await waitForRequestSlot();
  const response = await fetch(`https://r.jina.ai/${endpoint}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 429) rateLimited(response.headers.get("retry-after"));
  if (!response.ok) throw new Error(`Semantic Scholar Reader ${response.status}`);
  return parseSemanticScholarReader(await response.text(), identifier);
}

async function fetchByIdentifier(id: string): Promise<PaperCitations | null> {
  return cache.get(id, () => loadCitations(id));
}

export function readCachedCitations(rawId: string, rawDoi?: string, paperId?: string): MetricSnapshot<PaperCitations> | undefined {
  const id = rawId.replace(/v\d+$/i, "");
  const arxiv = cache.peek(`ARXIV:${id}`);
  const doi = normalizePublishedDoi(rawDoi);
  const publication = doi ? cache.peek(`DOI:${doi}`) : undefined;
  const canonical = paperId && /^[a-f0-9]{40}$/i.test(paperId) ? cache.peek(paperId) : undefined;
  const entries = [canonical, arxiv, publication].filter((entry): entry is MetricSnapshot<PaperCitations> => Boolean(entry));
  return entries.filter((entry) => entry.value).sort((a, b) => b.at - a.at)[0] ?? entries[0];
}

export async function fetchSemanticScholarCitations(rawId: string, rawDoi?: string, paperId?: string): Promise<PaperCitations | null> {
  const id = rawId.replace(/v\d+$/i, "");
  if (!/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})$/i.test(id)) throw new Error("Invalid arXiv ID");
  const cached = readCachedCitations(id, rawDoi, paperId);
  if (cached?.value && !cached.stale) return cached.value;
  if (paperId && /^[a-f0-9]{40}$/i.test(paperId)) {
    const canonical = await fetchByIdentifier(paperId);
    if (canonical) return canonical;
  }
  const value = await fetchByIdentifier(`ARXIV:${id}`);
  const doi = normalizePublishedDoi(rawDoi);
  // Only an explicit 404 warrants a DOI lookup. A rate limit must not trigger more requests.
  return value === null && doi ? fetchByIdentifier(`DOI:${doi}`) : value;
}
