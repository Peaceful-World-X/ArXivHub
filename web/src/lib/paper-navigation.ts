import type { Tool, ToolContext } from "./tools.ts";

export const PAPER_QUICK_IDS = [
  "alphaxiv", "paperlayer", "hjfy", "papers-cool", "pith",
  "pwc", "gist-science", "arxivmax", "openreview", "emergent-mind",
] as const;

export const PAPER_SOCIAL_IDS = [
  "xiaohongshu", "x-search", "reddit-search", "zhihu-search", "hf-papers", "google-scholar",
] as const;

export const DOCUMENT_ACTIONS = [
  { id: "pdf", label: "PDF" },
  { id: "html", label: "HTML" },
  { id: "md", label: "MD" },
  { id: "src", label: "TeX" },
  { id: "tb", label: "TB" },
  { id: "doi", label: "DOI" },
  { id: "bibtex", label: "BibTex" },
] as const;

export type DocumentActionId = typeof DOCUMENT_ACTIONS[number]["id"];

export function paperDoi(ctx: ToolContext): string {
  const fallback = `10.48550/arXiv.${ctx.id.replace(/v\d+$/i, "")}`;
  let doi = ctx.doi?.trim().replace(/^doi:\s*/i, "") ?? "";
  if (/^https?:\/\//i.test(doi)) {
    try {
      const url = new URL(doi);
      doi = /^(?:dx\.)?doi\.org$/i.test(url.hostname) ? decodeURIComponent(url.pathname.slice(1)) : "";
    } catch { return fallback; }
  }
  return /^10\.\d{4,9}\/\S+$/.test(doi) && !/^10\.48550\/arxiv\./i.test(doi) ? doi : fallback;
}

export function documentLinkUrl(action: DocumentActionId, ctx: ToolContext): string | null {
  const path = encodeURIComponent(ctx.id).replaceAll("%2F", "/");
  switch (action) {
    case "pdf":
    case "html":
    case "src": return `https://arxiv.org/${action}/${path}`;
    case "md": return `https://www.arxiv2md.org/api/markdown?url=${encodeURIComponent(ctx.id)}`;
    case "tb": return `https://arxiv.org/tb/${path.replace(/v\d+$/i, "")}`;
    case "doi": return `https://doi.org/${encodeURIComponent(paperDoi(ctx)).replaceAll("%2F", "/")}`;
    case "bibtex": return null;
  }
}

export function catalyzeXSlug(title: string): string {
  let slug = title.replace(/\\[a-zA-Z]+/g, "").toLowerCase().normalize("NFKD")
    .replace(/[^\p{ASCII}]/gu, "").replace(/\./g, "-").replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length > 45) {
    const atWordBoundary = slug[45] === "-";
    slug = slug.slice(0, 45);
    if (!atWordBoundary) {
      const lastDash = slug.lastIndexOf("-");
      slug = lastDash > 0 ? slug.slice(0, lastDash) : "";
    }
  }
  return slug;
}

export function buildToolUrl(tool: Tool, ctx: ToolContext): string {
  if (tool.id === "catalyzex") {
    const slug = catalyzeXSlug(ctx.title ?? "");
    return slug ? tool.url.replace("{titleSlug}", slug) : `${tool.home}s/${encodeURIComponent(ctx.title?.trim() || ctx.id)}`;
  }
  // Moonlight 使用标题路径；清理 LaTeX 命令和标点，无标题时保留检索入口。
  if (tool.id === "moonlight") {
    const slug = (ctx.title ?? "")
      .replace(/\\[a-zA-Z]+/g, "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/[\s-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug ? tool.url.replace("{titleSlug}", slug) : `${tool.home}/explore`;
  }
  const titleEnc = encodeURIComponent(ctx.title || ctx.id);
  return tool.url
    .replaceAll("{id}", ctx.id)
    .replaceAll("{titleEnc}", titleEnc)
    .replaceAll("{doi}", ctx.doi ?? `10.48550/arXiv.${ctx.id}`);
}
