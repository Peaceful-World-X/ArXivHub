import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UserRound,
  Tag,
  CalendarDays,
  History,
  Layers,
  RefreshCw,
  Puzzle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { ToolGrid } from "@/components/tool-grid";
import { ToolIcon } from "@/components/tool-card";
import { Button } from "@/components/ui/button";
import {
  bibtexFor,
  arxivDoi,
  formatDate,
  fromRouteId,
  fetchArxivPaper,
  type ArxivPaper,
} from "@/lib/arxiv";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import { EXAMPLE_PAPERS, EXTRAS, PAPER_TOOLS, TOOLS, buildToolUrl } from "@/lib/tools";
import { MathText } from "@/components/math-text";
import { fetchArxivTldr } from "@/lib/arxiv-tldr";
import { PaperAiLinks } from "@/components/paper-ai-links";
import { InstallGuide } from "@/components/install-guide";
import { PaperMetrics } from "@/components/paper-metrics";

export const Route = createFileRoute("/p/$id")({ component: PaperPage });

const QUICK_TOOLS = [
  "alphaxiv", "paperlayer", "hjfy", "papers-cool", "pith",
  "pwc", "catalyzex", "pubpeer", "openreview", "emergent-mind",
].map((id) => TOOLS.find((tool) => tool.id === id)!);
const SOCIAL_TOOLS = ["xiaohongshu", "x-search", "reddit-search", "zhihu-search", "hf-papers", "google-scholar"].map((id) => TOOLS.find((tool) => tool.id === id)!);
const quickLinkClass = "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent";

function PaperPage() {
  const { id: routeValue } = Route.useParams();
  const id = fromRouteId(routeValue);
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  const pushHistory = useHub((s) => s.pushHistory);
  const [paper, setPaper] = useState<ArxivPaper | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tldr, setTldr] = useState<string | null>(null);
  const [tldrLoading, setTldrLoading] = useState(true);
  const [tldrError, setTldrError] = useState(false);
  const [tldrAttempt, setTldrAttempt] = useState(0);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPaper(null);
    setError(null);
    setLoading(true);
    void fetchArxivPaper(id)
      .then((value) => active && setPaper(value))
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "fetch failed");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    setTldrLoading(true);
    setTldr(null);
    setTldrError(false);
    void fetchArxivTldr(id)
      .then((text) => {
        if (active) setTldr(text);
      })
      .catch(() => { if (active) setTldrError(true); })
      .finally(() => active && setTldrLoading(false));
    return () => {
      active = false;
    };
  }, [id, tldrAttempt]);

  useEffect(() => {
    const fallbackTitle = EXAMPLE_PAPERS.find((paperItem) => paperItem.id === id)?.title;
    pushHistory({ id, title: paper?.title ?? fallbackTitle ?? id });
  }, [id, paper?.title, pushHistory]);

  const ctx = useMemo(
    () => ({
      id,
      title: paper?.title,
      doi: paper?.doi,
    }),
    [id, paper],
  );

  const extras = EXTRAS.filter((e) => e.paperId === id);
  const doi = paper?.doi?.trim() || arxivDoi(id.replace(/v\d+$/i, ""));
  const doiUrl = `https://doi.org/${encodeURIComponent(doi).replaceAll("%2F", "/")}`;
  const version = paper?.versionId.match(/v(\d+)$/)?.[1];
  const authorText = paper
    ? paper.authors.length > 1
      ? `${paper.authors[0]?.name ?? ""} · ${lang === "zh" ? "等" : "et al."}`
      : paper.authors[0]?.name ?? ""
    : "";

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFlash(label);
      window.setTimeout(() => setFlash(null), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <Shell>
      <Link
        to="/"
        className="text-sm text-muted no-underline hover:text-ink"
      >
        ← {t.app}
      </Link>

      <header className="mt-5 rounded-[28px] border border-border bg-surface p-5 shadow-soft sm:p-8">
        <div className="paper-quick-bar" data-testid="paper-quick-bar">
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-3" data-testid="paper-document-actions">
            <a href={`https://arxiv.org/abs/${id}`} target="_blank" rel="noreferrer" className="shrink-0 font-sans text-base font-bold text-accent no-underline sm:text-lg">arXiv:{id}</a>
            <div className="flex max-w-full min-w-0 items-center gap-1 overflow-x-auto">
              <a href={`https://arxiv.org/pdf/${id}`} target="_blank" rel="noreferrer" aria-label={t.pdf} title={t.pdf} className={quickLinkClass}><span className="font-sans text-xs font-bold">PDF</span></a>
              <a href={`https://arxiv.org/html/${id}`} target="_blank" rel="noreferrer" aria-label={t.html} title={t.html} className={quickLinkClass}><span className="font-sans text-xs font-bold">HTML</span></a>
              <a href={`https://www.arxiv2md.org/api/markdown?url=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer" aria-label={t.markdown} title={t.markdown} className={quickLinkClass}><span className="font-sans text-xs font-bold">MD</span></a>
              <a href={`https://arxiv.org/src/${id}`} target="_blank" rel="noreferrer" aria-label={t.texSource} title={t.texSource} className={quickLinkClass}><span className="font-sans text-xs font-bold">TeX</span></a>
              <a href={`https://arxiv.org/tb/${id}`} target="_blank" rel="noreferrer" aria-label={t.trackbacks} title={t.trackbacks} className={quickLinkClass}><span className="font-sans text-xs font-bold">TB</span></a>
              <a href={doiUrl} target="_blank" rel="noopener noreferrer" aria-label="DOI" title={`DOI: ${doi}`} className={quickLinkClass}><span className="font-sans text-xs font-bold">DOI</span></a>
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full" title={t.copyBib} aria-label={t.copyBib} disabled={!paper} onClick={() => paper && void copyText(bibtexFor(paper), t.copied)}><span className="font-sans text-xs font-bold">BibTex</span></Button>
            </div>
          </div>
          <nav aria-label={t.quickLinks} className="ml-auto flex max-w-full min-w-0 items-center gap-1 overflow-x-auto py-1">
            {QUICK_TOOLS.map((tool) => {
              const name = lang === "zh" ? tool.nameZh : tool.name;
              return (
                <a key={tool.id} data-quick-tool={tool.id} href={buildToolUrl(tool, ctx)} target="_blank" rel="noreferrer" aria-label={name} title={name} className={quickLinkClass}>
                  <ToolIcon tool={tool} />
                </a>
              );
            })}
          </nav>
        </div>
        {flash ? <p role="status" className="mt-2 text-xs text-ok">{flash}</p> : null}
        <h1 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
          <a href={`https://arxiv.org/abs/${id}`} target="_blank" rel="noreferrer" className="text-ink no-underline hover:text-accent"><MathText inline text={paper?.title ?? id} className="paper-title-math" /></a>
        </h1>
        <div className="paper-metadata-line" data-testid="paper-metadata">
          {authorText ? <span className="paper-meta-block" data-testid="paper-authors" title={authorText}><UserRound className="size-3.5 shrink-0" aria-hidden="true" />{authorText}</span> : null}
          {paper?.primaryCategory ? (
            <span className="paper-meta-block" title={t.categories}>
              <Tag className="size-3.5 shrink-0" aria-hidden="true" />
              {paper.primaryCategory}
            </span>
          ) : null}
          {paper?.published ? (
            <span className="paper-meta-block" data-testid="paper-submitted">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              {t.published} <time dateTime={paper.published}>{formatDate(paper.published)}</time>
            </span>
          ) : null}
          {paper && ((paper.updated && paper.updated !== paper.published) || Number(version) > 1) ? (
            <span className="paper-meta-block" data-testid="paper-updated">
              <History className="size-3.5 shrink-0" aria-hidden="true" />
              {t.updated} {paper.updated ? <time dateTime={paper.updated}>{formatDate(paper.updated)}</time> : <span>{t.dateUnavailable}</span>}
            </span>
          ) : null}
          {version ? (
            <span className="paper-meta-block" data-testid="paper-version" title={t.version}>
              <Layers className="size-3.5 shrink-0" aria-hidden="true" />v{version}
            </span>
          ) : null}
          <PaperMetrics key={id} id={id} doi={paper?.doi} title={paper?.title} metadataLoading={loading} />
        </div>
        {error ? (
          <p className="mt-4 text-sm text-accent">{t.loadError}</p>
        ) : null}
        {loading ? (
          <p className="mt-4 text-sm text-muted">{t.loading}</p>
        ) : null}
        <section className="mt-5 border-y border-border py-4" data-testid="paper-tldr" aria-busy={tldrLoading}>
          <h2 className="font-display text-lg"><a href={`https://arxivtldr.org/abs/${id}`} target="_blank" rel="noopener noreferrer" title={t.viewOriginal} className="text-inherit no-underline hover:text-accent">ArXiv TLDR</a></h2>
          <MathText className="mt-2 text-sm leading-relaxed text-muted" text={tldrLoading ? t.arxivTldrLoading : tldr ?? (tldrError ? t.arxivTldrFailed : t.arxivTldrUnavailable)} />
          {!tldrLoading && !tldr ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setTldrAttempt((value) => value + 1)} title={t.retry} aria-label={t.retry} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-accent"><RefreshCw className="size-4" /></button>
              {tldrError ? <button type="button" onClick={() => setShowInstallGuide(true)} className="inline-flex min-h-9 items-center gap-1.5 text-sm text-accent"><Puzzle className="size-4" />{t.arxivTldrScript}</button> : null}
            </div>
          ) : null}
        </section>
        {showInstallGuide ? <InstallGuide onClose={() => setShowInstallGuide(false)} /> : null}

        {paper?.summary ? (
          <section className="mt-5" aria-labelledby="paper-abstract-heading">
            <h2 id="paper-abstract-heading" className="font-display text-xl">{t.abstract}</h2>
            <div id="paper-abstract">
              <MathText text={paper.summary} className="mt-3 w-full text-base leading-relaxed text-ink" />
            </div>
          </section>
        ) : null}

        <div className="paper-bottom-actions" data-testid="paper-bottom-actions">
          <PaperAiLinks key={id} id={id} paper={paper} tldr={tldr} />
          <nav aria-label={lang === "zh" ? "论文讨论与检索" : "Paper discussion and search"} className="flex max-w-full min-w-0 items-center gap-1 overflow-x-auto py-1 justify-self-end">
            {SOCIAL_TOOLS.map((tool) => {
              const name = lang === "zh" ? tool.nameZh : tool.name;
              return <a key={tool.id} data-social-tool={tool.id} href={buildToolUrl(tool, ctx)} target="_blank" rel="noopener noreferrer" aria-label={name} title={name} className={quickLinkClass}><ToolIcon tool={tool} /></a>;
            })}
          </nav>
        </div>
      </header>

      {extras.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl">{t.extras}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {extras.map((ex) => (
              <a
                key={ex.url}
                href={ex.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-[22px] border border-border bg-surface p-4 text-ink no-underline shadow-soft hover:border-border-strong"
              >
                <p className="font-display text-base">
                  {lang === "zh" ? ex.nameZh : ex.name}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {lang === "zh" ? ex.blurbZh : ex.blurb}
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl">{t.paperTools}</h2>
        <ToolGrid ctx={ctx} tools={PAPER_TOOLS} compact />
      </section>


    </Shell>
  );
}
