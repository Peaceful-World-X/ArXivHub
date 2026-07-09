import { Lexer, type Token } from "marked";

// 只取明确 TLDR 标题下的首段，避免混入原始摘要和贡献列表。
export function parseArxivTldr(text: string): string | null {
  const marker = "Markdown Content:";
  const markdown = text.includes(marker) ? text.slice(text.indexOf(marker) + marker.length) : text;
  const tokens = Lexer.lex(markdown);
  const heading = tokens.findIndex((token) => token.type === "heading" && /^tl;?dr$/i.test(token.text.trim()));
  if (heading < 0) return null;
  const plainText = (token: Token): string => {
    if ("tokens" in token && token.tokens) return token.tokens.map(plainText).join("");
    return token.type === "html" ? "" : "text" in token ? token.text : "";
  };
  for (const token of tokens.slice(heading + 1)) {
    if (token.type === "heading") break;
    if (token.type !== "paragraph") continue;
    const summary = plainText(token).replace(/\s+/g, " ").trim();
    if (!summary || /summarizing paper|generating summary|too many requests/i.test(summary)) return null;
    return summary;
  }
  return null;
}

const cache = new Map<string, { text: string; at: number }>();

export async function fetchArxivTldr(id: string): Promise<string | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.text;
  // Reader 仅转发公开页面，提供 GitHub Pages 所需的跨域读取能力。
  const response = await fetch(`https://r.jina.ai/https://arxivtldr.org/abs/${encodeURIComponent(id)}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`ArXiv TLDR ${response.status}`);
  const summary = parseArxivTldr(await response.text());
  if (summary) cache.set(id, { text: summary, at: Date.now() });
  return summary;
}
