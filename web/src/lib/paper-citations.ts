import { type MetricSnapshot } from "./paper-metric-cache.ts";
import { fetchSemanticScholarCitations, readCachedCitations, type PaperCitations } from "./semantic-scholar.ts";
import { fetchSemanticScholarPage, readCachedSemanticScholarPage, semanticScholarPageUrl, type ScholarPageContext } from "./semantic-scholar-page.ts";
import { fetchOpenAlexCitations, readCachedOpenAlexCitations } from "./openalex-citations.ts";

export type CitationResult = { citationCount: number; url: string; source: "Semantic Scholar" | "OpenAlex" };
export type CitationContext = ScholarPageContext;

function knownPaperId(ctx: CitationContext): string | undefined {
  return semanticScholarPageUrl(ctx).match(/\/([a-f0-9]{40})(?:[?#]|$)/i)?.[1];
}

function scholarResult(ctx: CitationContext, value: PaperCitations): CitationResult {
  return { citationCount: value.citationCount,
    url: semanticScholarPageUrl({ ...ctx, paperId: value.paperId }), source: "Semantic Scholar" };
}

function readScholar(ctx: CitationContext): MetricSnapshot<CitationResult> | undefined {
  const entries = [readCachedCitations(ctx.id, ctx.doi, knownPaperId(ctx)), readCachedSemanticScholarPage(ctx.id)]
    .filter((entry) => entry?.value).sort((a, b) => b!.at - a!.at);
  const cached = entries[0];
  return cached?.value ? { ...cached, value: scholarResult(ctx, cached.value) } : undefined;
}

export function readCachedPaperCitations(ctx: CitationContext): MetricSnapshot<CitationResult> | undefined {
  const scholar = readScholar(ctx);
  if (scholar) return scholar;
  const openalex = readCachedOpenAlexCitations(ctx.id);
  return openalex?.value ? { ...openalex, value: { ...openalex.value, source: "OpenAlex" } } : undefined;
}

export function citationPageUrl(ctx: CitationContext): string {
  return readCachedPaperCitations(ctx)?.value?.url ?? semanticScholarPageUrl(ctx);
}

export async function fetchPaperCitations(ctx: CitationContext): Promise<CitationResult | null> {
  const cached = readCachedPaperCitations(ctx);
  if (cached?.value?.source === "Semantic Scholar" && !cached.stale) return cached.value;
  let failure: unknown;
  const paperId = knownPaperId(ctx) ?? readCachedCitations(ctx.id, ctx.doi)?.value?.paperId;
  // Prefer Semantic Scholar for every paper, even when an older OpenAlex cache exists.
  for (const load of [
    () => fetchSemanticScholarPage({ ...ctx, paperId }),
    () => fetchSemanticScholarCitations(ctx.id, ctx.doi, paperId),
  ]) {
    try {
      const value = await load();
      if (value) return scholarResult(ctx, value);
    } catch (error) { failure = error; }
  }
  if (cached?.value?.source === "Semantic Scholar") throw failure ?? new Error("Could not refresh cached citations");
  if (cached?.value && !cached.stale) return cached.value;
  try {
    const value = await fetchOpenAlexCitations(ctx);
    if (value) return { ...value, source: "OpenAlex" };
  } catch (error) { failure = error; }
  if (cached?.value) throw failure ?? new Error("Could not refresh cached citations");
  if (failure) throw failure;
  return null;
}
