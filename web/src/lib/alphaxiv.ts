import { createPaperMetricCache } from "./paper-metric-cache.ts";

function normalizeId(rawId: string): string {
  const id = rawId.trim().replace(/v\d+$/i, "");
  if (!/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})$/i.test(id)) {
    throw new Error("Invalid arXiv ID");
  }
  return id;
}

export type AlphaXivPreview = Record<string, unknown> & { universal_paper_id: string };
const previewCache = new Map<string, { value: AlphaXivPreview | null; at: number }>();
const previewRequests = new Map<string, Promise<AlphaXivPreview | null>>();

export async function fetchAlphaXivPreview(rawId: string): Promise<AlphaXivPreview | null> {
  const id = normalizeId(rawId);
  const cached = previewCache.get(id);
  const age = cached ? Date.now() - cached.at : Infinity;
  if (cached && age >= 0 && age < (cached.value === null ? 5 : 15) * 60 * 1000) return cached.value;
  let request = previewRequests.get(id);
  if (!request) {
    request = (async () => {
      const response = await fetch(`https://api.alphaxiv.org/papers/v3/${encodeURIComponent(id)}/preview`, {
        credentials: "omit", signal: AbortSignal.timeout(10000),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`alphaXiv ${response.status}`);
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value) || !("universal_paper_id" in value) ||
          typeof value.universal_paper_id !== "string" || normalizeId(value.universal_paper_id) !== id) {
        throw new Error("Invalid alphaXiv paper identity");
      }
      return value as AlphaXivPreview;
    })().then((value) => {
      previewCache.set(id, { value, at: Date.now() });
      return value;
    }).finally(() => previewRequests.delete(id));
    previewRequests.set(id, request);
  }
  return request;
}

export function parseAlphaXivLikes(value: unknown, rawId: string): number | null {
  const id = normalizeId(rawId);
  if (value === null) return null;
  if (!value || typeof value !== "object" || !("universal_paper_id" in value) ||
      typeof value.universal_paper_id !== "string" || normalizeId(value.universal_paper_id) !== id ||
      !("metrics" in value) || !value.metrics || typeof value.metrics !== "object" ||
      !("public_total_votes" in value.metrics)) {
    throw new Error("Invalid alphaXiv paper or like count");
  }
  // This is the visible Like count. total_votes and visits_count are different metrics.
  const likes = value.metrics.public_total_votes;
  if (typeof likes !== "number" || !Number.isSafeInteger(likes) || likes < 0) {
    throw new Error("Invalid alphaXiv like count");
  }
  return likes;
}

export function readCachedAlphaXivLikes(rawId: string) {
  try { return likesCache.peek(normalizeId(rawId)); } catch { return undefined; }
}

export async function fetchAlphaXivLikes(rawId: string): Promise<number | null> {
  const id = normalizeId(rawId);
  return likesCache.get(id, async () => parseAlphaXivLikes(await fetchAlphaXivPreview(id), id));
}

const likesCache = createPaperMetricCache<number>({
  namespace: "alphaxiv-likes:v1", ttl: 15 * 60 * 1000, maxAge: 24 * 60 * 60 * 1000, missingTtl: 5 * 60 * 1000,
  valid: (value): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
});
