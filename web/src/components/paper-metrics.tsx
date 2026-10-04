import { Quote, ThumbsUp, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { copy as i18n } from "@/lib/i18n";
import { citationPageUrl, fetchPaperCitations, readCachedPaperCitations } from "@/lib/paper-citations";
import { fetchAlphaXivLikes, readCachedAlphaXivLikes } from "@/lib/alphaxiv";
import { type MetricSnapshot } from "@/lib/paper-metric-cache";
import { useHub } from "@/lib/store";

type Snapshot = MetricSnapshot<number> & { href: string; source?: string };
type Metric = { read: () => Snapshot | undefined; load: () => Promise<unknown>; href: string; source: string };

function PaperMetric({ metric, label, testId, Icon, linkWhenUnavailable = false }: {
  metric: Metric; label: string; testId: string; Icon: LucideIcon; linkWhenUnavailable?: boolean;
}) {
  const lang = useHub((state) => state.lang);
  const t = i18n[lang];
  const [attempt, setAttempt] = useState(0);
  // Read synchronously: refreshing a page paints the cached number immediately.
  const [state, setState] = useState(() => {
    const snapshot = metric.read();
    return { snapshot, loading: !snapshot || snapshot.stale, error: false };
  });
  useEffect(() => {
    let active = true;
    const cached = metric.read();
    setState({ snapshot: cached, loading: !cached || cached.stale, error: false });
    void metric.load().then(
      () => { if (active) setState({ snapshot: metric.read(), loading: false, error: false }); },
      () => { if (active) setState({ snapshot: metric.read() ?? cached, loading: false, error: true }); },
    );
    return () => { active = false; };
  }, [metric, attempt]);

  const { snapshot, loading, error } = state;
  const value = snapshot?.value;
  const resolvedSource = snapshot?.source ?? metric.source;
  const hasValue = value !== null && value !== undefined;
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  let title = `${resolvedSource} · ${loading ? t.metricLoading : error && !linkWhenUnavailable ? t.metricFailed : t.metricUnavailable}`;
  if (hasValue && snapshot) {
    title = `${resolvedSource} · ${t.metricRetrieved} ${new Date(snapshot.at).toLocaleString(locale)}`;
    if (error) title += ` · ${t.metricCached}`;
    else if (loading) title += ` · ${t.metricRefreshing}`;
  }
  const content = <><Icon className="size-3.5 shrink-0" aria-hidden="true" />{label} <span className="tabular-nums">{hasValue ? value.toLocaleString(locale) : "-"}</span></>;
  const props = { className: "paper-meta-block no-underline hover:border-border-strong", "data-testid": testId, "data-metric-source": resolvedSource, "aria-busy": loading, title };
  if (!hasValue && loading && !linkWhenUnavailable) return <span {...props}>{content}</span>;
  if (!hasValue && error && !linkWhenUnavailable) return <button {...props} type="button" aria-label={title} onClick={() => setAttempt((value) => value + 1)}>{content}</button>;
  return <a {...props} href={snapshot?.href ?? metric.href} target="_blank" rel="noopener noreferrer">{content}</a>;
}

export function PaperMetrics({ id, doi, title, metadataLoading = false }: { id: string; doi?: string; title?: string; metadataLoading?: boolean }) {
  const lang = useHub((state) => state.lang);
  const t = i18n[lang];
  const citations = useMemo<Metric>(() => {
    const ctx = { id, doi, title };
    const href = citationPageUrl(ctx);
    return {
      href,
      source: href.startsWith("https://openalex.org/") ? "OpenAlex" : "Semantic Scholar",
      read: () => {
        const cached = readCachedPaperCitations(ctx);
        return cached ? { ...cached, value: cached.value?.citationCount ?? null,
          href: cached.value?.url ?? href, source: cached.value?.source } : undefined;
      },
      load: () => metadataLoading && !title && !href.startsWith("https://www.semanticscholar.org/paper/")
        ? Promise.resolve(null) : fetchPaperCitations(ctx),
    };
  }, [id, doi, title, metadataLoading]);
  const likes = useMemo<Metric>(() => {
    const href = `https://www.alphaxiv.org/abs/${id}`;
    return { href, source: "alphaXiv", read: () => {
      const cached = readCachedAlphaXivLikes(id);
      return cached ? { ...cached, href } : undefined;
    }, load: () => fetchAlphaXivLikes(id) };
  }, [id]);
  return <>
    <PaperMetric metric={citations} label={t.citations} testId="paper-citations" Icon={Quote} linkWhenUnavailable />
    <PaperMetric metric={likes} label={t.likes} testId="paper-likes" Icon={ThumbsUp} />
  </>;
}
