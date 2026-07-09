import { createFileRoute, Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { SearchBar } from "@/components/search-bar";
import { Shell } from "@/components/shell";
import { ToolGrid } from "@/components/tool-grid";
import { routeId } from "@/lib/arxiv";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import { EXAMPLE_PAPERS, TOOLS } from "@/lib/tools";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  const toolCount = TOOLS.filter((tool) => tool.category === "agent" || tool.category === "zotero").length;
  const introRef = useRef<HTMLElement>(null);
  const toolsRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const intro = introRef.current;
    const toolsSection = toolsRef.current;
    if (!intro || !toolsSection) return;
    let frame = 0;
    const fitTwoRows = () => {
      const current = parseFloat(intro.style.getPropertyValue('--home-extra-space')) || 0;
      const cards = toolsSection.querySelectorAll<HTMLElement>('[data-tool-grid] article');
      let extra = 0;
      if (window.innerWidth >= 1024 && cards.length >= 6) {
        const secondRowBottom = Math.max(...Array.from(cards).slice(3, 6).map((card) => card.getBoundingClientRect().bottom)) + window.scrollY;
        // Subtract our existing padding so repeated measurements remain stable.
        extra = Math.max(0, Math.round(window.innerHeight - 8 - (secondRowBottom - current)));
      }
      if (Math.abs(extra - current) > 0.5) intro.style.setProperty('--home-extra-space', `${extra}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fitTwoRows); };
    const observer = new ResizeObserver(schedule);
    observer.observe(intro);
    observer.observe(toolsSection);
    window.addEventListener('resize', schedule);
    fitTwoRows();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [lang]);

  return (
    <Shell>
      <section ref={introRef} className="home-intro mx-auto max-w-4xl text-center">
        <p data-testid="home-stats" className="font-mono text-xs text-muted">
          {TOOLS.length - toolCount} {t.websites}
          <span className="mx-2 text-subtle">·</span>
          {toolCount} {t.repositoryTools}
        </p>
        <h1 className="home-title font-display">
          {t.tagline}
        </h1>
        <p className="home-subtitle mx-auto max-w-xl text-muted">
          {t.deck}
        </p>
        <div className="home-search mx-auto max-w-3xl text-left">
          <SearchBar />
        </div>
        <div className="example-links">
          <span className="shrink-0 text-subtle">{t.try}</span>
          <ul className="inline">
          {EXAMPLE_PAPERS.map((p) => <li key={p.id}>
            {p.href ? (
              <a
                href={p.href}
                target="_blank"
                rel="noreferrer"
                title={`${p.title} · ${p.id}`}
                className="text-ink"
              >
                {p.title}
                <span className="ml-1.5 hidden font-mono text-subtle lg:inline">{p.id}</span>
              </a>
            ) : (
              <Link
                to="/p/$id"
                params={{ id: routeId(p.id) }}
                title={`${p.title} · ${p.id}`}
                className="text-ink"
              >
                {p.title}
                <span className="ml-1.5 hidden font-mono text-subtle lg:inline">{p.id}</span>
              </Link>
            )}
          </li>)}
          </ul>
        </div>
      </section>

      <section ref={toolsRef} className="mt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-sans text-xs text-accent">
              {lang === "zh" ? "推荐入口" : "Featured doorways"}
            </p>
            <h2 className="tool-section-title mt-2 font-display">
              {lang === "zh" ? "从原文到发现，一站跳转" : "From source to discovery"}
            </h2>
          </div>
        </div>
        <ToolGrid />
      </section>

    </Shell>
  );
}
