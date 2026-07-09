import { ArrowUpRight, Bookmark, BookmarkCheck, Check, Link2, FileText, Rss, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CARD_COLORS } from "@/lib/card-colors";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import { buildToolUrl, getGitHubRepository, type Tool, type ToolContext } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const ICON_OVERRIDES: Record<string, string> = {
  "arxiv-abs": "https://arxiv.org/favicon.ico",
  "arxiv-pdf": "https://arxiv.org/favicon.ico",
  "arxiv-html": "https://arxiv.org/favicon.ico",
  "arxiv-src": "https://arxiv.org/favicon.ico",
  alphaxiv: "https://www.alphaxiv.org/favicon.ico",
  "papers-cool": "https://papers.cool/static/favicon.ico",
  hjfy: `${import.meta.env.BASE_URL}icons/hjfy.svg`,
  arxivdaily: "https://www.arxivdaily.com/favicon.ico",
  paperdance: "https://paperdance.org/favicon.ico",
  arxivtldr: "https://arxivtldr.org/favicon.ico",
  arxivxplorer: `${import.meta.env.BASE_URL}icons/arxivxplorer.png`,
  "arxiv-bshk": "https://arxiv.bshk.app/favicon.ico",
  scirate: "https://scirate.com/favicon.ico",
  arxivisual: "https://arxivisual.org/icon.png",
  "hf-papers": "https://huggingface.co/favicon.ico",
  ar5iv: "https://ar5iv.labs.arxiv.org/favicon.ico",
  "emergent-mind": `${import.meta.env.BASE_URL}icons/emergent-mind.png`,
  "talk2arxiv": "https://www.talk2arxiv.org/favicon.ico",
  "immersive-translate": "https://app.immersivetranslate.com/favicon.ico",
  "zotero-arxiv-reader": "https://github.com/favicon.ico",
  zotmeta: "https://github.com/favicon.ico",
  xiaohongshu: "https://www.xiaohongshu.com/favicon.ico",
  "x-search": "https://x.com/favicon.ico",
};

function localIcon(tool: Tool): string {
  const label = tool.name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "AR";
  const hue = [...tool.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="hsl(${hue} 78% 94%)"/><text x="32" y="37" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="hsl(${hue} 45% 35%)">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function faviconUrl(tool: Tool): string {
  if (tool.icon) return `${import.meta.env.BASE_URL}${tool.icon}`;
  if (ICON_OVERRIDES[tool.id]) return ICON_OVERRIDES[tool.id];
  try {
    return `${new URL(tool.home).origin}/favicon.ico`;
  } catch {
    return localIcon(tool);
  }
}

export function ToolIcon({ tool }: { tool: Tool }) {
  const primaryIcon = faviconUrl(tool);
  const fallbackIcon = localIcon(tool);
  const [iconSource, setIconSource] = useState(primaryIcon);
  const [loaded, setLoaded] = useState(false);
  const GenericIcon = tool.id === "markxiv" ? FileText : tool.id === "arxiv-rss" ? Rss : null;
  return (
    <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-white shadow-sm" aria-hidden="true">
      {tool.id === "chinarxiv" ? <span className="text-2xl leading-none">🌏</span> : GenericIcon ? <GenericIcon className="size-6 text-accent" /> : <>
      {!loaded ? <img src={fallbackIcon} alt="" width="28" height="28" className="size-7 rounded-lg object-contain" /> : null}
      <img
        src={iconSource}
        alt=""
        width="28"
        height="28"
        loading="eager"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (iconSource !== fallbackIcon) setIconSource(fallbackIcon);
          else setLoaded(true);
        }}
        className={cn("absolute size-7 rounded-lg object-contain", !loaded && "opacity-0")}
      />
      </>}
    </span>
  );
}

function GitHubStars({ href }: { href: string }) {
  const [failed, setFailed] = useState(false);
  const repository = getGitHubRepository(href);
  if (!repository) return null;
  return (
    <img
      src={`https://img.shields.io/github/stars/${repository}?style=flat&label=stars&color=b31b1b`}
      alt={`${repository} GitHub Stars`}
      title={`${repository} GitHub Stars`}
      width="80"
      height="20"
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("inline-block h-5 w-20 shrink-0 object-contain object-left align-middle", failed && "invisible")}
    />
  );
}

export function ToolCard({ tool, ctx, compact = false, hrefOverride, reorderControls }: { tool: Tool; ctx?: ToolContext; compact?: boolean; hrefOverride?: string; reorderControls?: ReactNode }) {
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  const pinned = useHub((s) => s.pinned);
  const favoriteHue = useHub((s) => s.favoriteHues[tool.id]);
  const togglePin = useHub((s) => s.togglePin);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [copyColor, setCopyColor] = useState(CARD_COLORS[0]);
  const [copySequence, setCopySequence] = useState(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const href = ctx ? buildToolUrl(tool, ctx) : hrefOverride ?? tool.home;
  const isPinned = pinned.includes(tool.id);
  const name = lang === "zh" ? tool.nameZh : tool.name;
  const blurb = lang === "zh" ? tool.blurbZh : tool.blurb;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(href);
      clearTimeout(copyTimer.current);
      setCopyFailed(false);
      setCopyColor(CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)]);
      setCopySequence((value) => value + 1);
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 620);
    } catch {
      clearTimeout(copyTimer.current);
      setCopied(false);
      setCopyFailed(true);
      copyTimer.current = setTimeout(() => setCopyFailed(false), 1800);
    }
  }

  function pinButton() {
    return (
      <button
        type="button"
        onClick={() => togglePin(tool.id)}
        className="grid size-11 shrink-0 place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-ink"
        aria-label={isPinned ? t.unpin : t.pin}
        aria-pressed={isPinned}
        title={isPinned ? t.unpin : t.pin}
      >
        {isPinned ? <BookmarkCheck className="size-4 text-accent" /> : <Bookmark className="size-4" />}
      </button>
    );
  }

  if (compact) {
    return (
      <div data-tool-id={tool.id} className="flex h-14 items-center gap-3 border-b border-border/70">
        <a href={href} title={name} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3 text-ink no-underline hover:text-accent">
          <ToolIcon tool={tool} />
          <span className="truncate text-sm font-medium">{name}</span>
          <GitHubStars key={href} href={href} />
          <ArrowUpRight className="size-3.5 shrink-0 text-subtle" />
        </a>
        {pinButton()}
      </div>
    );
  }

  return (
    <article data-tool-id={tool.id} data-favorite={isPinned} style={isPinned && favoriteHue !== undefined ? { backgroundColor: `hsl(${favoriteHue} 65% 93%)` } : undefined} className="flex h-full flex-col rounded-sm border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong">
      {reorderControls}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ToolIcon tool={tool} />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="max-w-full break-words font-display text-lg font-medium leading-snug">{name}</h3>
            <GitHubStars key={href} href={href} />
          </div>
        </div>
        {pinButton()}
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{blurb}</p>
      <div className="mt-3 flex items-center gap-2">
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-sm bg-ink px-3 text-sm font-medium text-bg no-underline hover:bg-[color-mix(in_oklab,var(--color-ink)_88%,white)]">
          {t.open}<ArrowUpRight className="size-3.5" />
        </a>
        <Button type="button" variant="secondary" size="sm" className="copy-feedback size-10 rounded-full p-0" style={{ "--copy-color": copyColor } as CSSProperties} data-copied={copied} onClick={() => void copyUrl()} aria-label={copied ? t.copied : copyFailed ? t.copyFailed : t.copyLink} title={copied ? t.copied : copyFailed ? t.copyFailed : t.copyLink}>
          {copied ? <span key={copySequence} className="copy-coin"><Check className="size-6" strokeWidth={3.25} /></span> : copyFailed ? <X className="size-4 text-accent" /> : <Link2 className="size-3.5" />}
        </Button>
      </div>
      <span role="status" className="sr-only">{copied ? t.copied : copyFailed ? t.copyFailed : ""}</span>
    </article>
  );
}
