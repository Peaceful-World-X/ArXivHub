export const ARXIV_ID_RE =
  /(?:arXiv:)?(\d{4}\.\d{4,5})(?:v\d+)?/i;
export const ARXIV_OLD_RE =
  /(?:arXiv:)?((?:[a-z-]+)(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?/i;

const HOST_PATH_PATTERNS: RegExp[] = [
  /(?:www\.)?arxiv\.org\/(?:abs|pdf|html|format|src|e-print|ps)\/([^\s?#]+)/i,
  /(?:www\.)?alphaxiv\.org\/(?:abs|overview|pdf)\/([^\s?#]+)/i,
  /papers\.cool\/arxiv\/([^\s?#]+)/i,
  /hjfy\.top\/arxiv\/([^\s?#]+)/i,
  /(?:www\.)?arxivtldr\.org\/abs\/([^\s?#]+)/i,
  /(?:www\.)?arxivisual\.org\/abs\/([^\s?#]+)/i,
  /(?:www\.)?huggingface\.co\/papers\/([^\s?#]+)/i,
  /hf\.co\/papers\/([^\s?#]+)/i,
  /ar5iv\.labs\.arxiv\.org\/html\/([^\s?#]+)/i,
  /(?:www\.)?emergentmind\.com\/papers\/([^\s?#]+)/i,
  /(?:www\.)?scirate\.com\/arxiv\/([^\s?#]+)/i,
  /(?:www\.)?catalyzex\.com\/paper\/arxiv[:.]([^\s?#]+)/i,
  /doi\.org\/10\.48550\/arXiv\.([^\s?#]+)/i,
  /export\.arxiv\.org\/api\/query\?id_list=([^\s&#]+)/i,
];

export function stripVersion(id: string): string {
  return id.replace(/v\d+$/i, "").replace(/\.pdf$/i, "").replace(/\/+$/, "");
}

export function normalizeArxivId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  for (const re of HOST_PATH_PATTERNS) {
    const m = trimmed.match(re);
    if (m?.[1]) {
      let inner: string;
      try {
        inner = decodeURIComponent(m[1]);
      } catch {
        return null;
      }
      return canonicalize(inner.replace(/\.pdf$/i, ""));
    }
  }

  return canonicalize(trimmed);
}

function canonicalize(value: string): string | null {
  const cleaned = value.replace(/^arXiv:/i, "").trim();
  const modern = cleaned.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/i);
  if (modern?.[1]) return modern[1];
  const old = cleaned.match(
    /^([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i,
  );
  if (old?.[1]) return old[1];
  const embedded = cleaned.match(ARXIV_ID_RE);
  if (embedded?.[1]) return embedded[1];
  const embeddedOld = cleaned.match(ARXIV_OLD_RE);
  if (embeddedOld?.[1]) return embeddedOld[1];
  return null;
}

export function isLikelyArxivInput(value: string): boolean {
  return normalizeArxivId(value) !== null;
}

export function routeId(id: string): string {
  return id.replaceAll("/", "~");
}

export function fromRouteId(id: string): string {
  return id.replaceAll("~", "/");
}

export function arxivDoi(id: string): string {
  return `10.48550/arXiv.${id}`;
}

export type ArxivAuthor = { name: string };

export type ArxivPaper = {
  id: string;
  versionId: string;
  title: string;
  summary: string;
  published: string;
  updated: string;
  authors: ArxivAuthor[];
  categories: string[];
  primaryCategory: string;
  comment?: string;
  doi?: string;
  pdfUrl: string;
  absUrl: string;
};

function tag(xml: string, name: string): string {
  const re = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,
    "i",
  );
  const m = xml.match(re);
  return decodeXml(m?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function tags(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push(decodeXml(m[1] ?? "").replace(/\s+/g, " ").trim());
  }
  return out;
}

function attrTags(xml: string, name: string, attr: string): string[] {
  const re = new RegExp(`<${name}\\b([^>]*)/?>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const am = m[1]?.match(new RegExp(`${attr}="([^"]+)"`, "i"));
    if (am?.[1]) out.push(am[1]);
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseArxivAtom(xml: string): ArxivPaper | null {
  const entryStart = xml.indexOf("<entry");
  if (entryStart < 0) return null;
  const entryEnd = xml.indexOf("</entry>", entryStart);
  const entry = xml.slice(entryStart, entryEnd + 8);
  const idUrl = tag(entry, "id");
  const versionId = stripVersion(
    idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//i, "").replace(/^.*\/abs\//, ""),
  );
  const id = stripVersion(versionId);
  if (!id) return null;
  const pdfHref =
    entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/i)?.[1] ??
    entry.match(/<link[^>]*href="([^"]+)"[^>]*title="pdf"/i)?.[1] ??
    `https://arxiv.org/pdf/${id}`;
  const cats = attrTags(entry, "category", "term");
  const primary =
    entry.match(/primary_category[^>]*term="([^"]+)"/i)?.[1] ?? cats[0] ?? "";
  const authors = tags(entry, "name")
    .filter(Boolean)
    .map((name) => ({ name }));
  const doi = tag(entry, "arxiv:doi") || arxivDoi(id);
  return {
    id,
    versionId,
    title: tag(entry, "title"),
    summary: tag(entry, "summary"),
    published: tag(entry, "published"),
    updated: tag(entry, "updated"),
    authors,
    categories: cats,
    primaryCategory: primary,
    comment: tag(entry, "arxiv:comment") || undefined,
    doi,
    pdfUrl: pdfHref.replace("http://", "https://"),
    absUrl: `https://arxiv.org/abs/${id}`,
  };
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(/^[A-Za-z]+ \d{1,2}, \d{4}$/.test(iso.trim()) ? `${iso} UTC` : iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function bibtexFor(paper: ArxivPaper): string {
  const year = paper.published.slice(0, 4) || "n.d.";
  const first = paper.authors[0]?.name.split(" ").pop() ?? "arxiv";
  const key = `${first}${year}${paper.id.replaceAll(/[./]/g, "")}`;
  const authors = paper.authors.map((a) => a.name).join(" and ");
  return `@article{${key},
  title={${paper.title}},
  author={${authors}},
  year={${year}},
  eprint={${paper.id}},
  archivePrefix={arXiv},
  primaryClass={${paper.primaryCategory}},
  url={${paper.absUrl}},
  doi={${paper.doi ?? arxivDoi(paper.id)}}
}`;
}

// DataCite supports browser CORS; use the TXT proxy only when DOI metadata is unavailable.
export async function fetchArxivPaper(id: string): Promise<ArxivPaper> {
  const dataCite = await fetchDataCite(id).catch(() => null);
  const registeredPaper = parseDataCitePaper(dataCite, id);
  if (registeredPaper) return registeredPaper;

  const url = `https://r.jina.ai/http://www.arxiv-txt.org/abs/${encodeURIComponent(id)}`;
  const historyPromise = fetchArxivSubmissionHistory(id, dataCite).catch(() => null);
  const response = await fetch(url, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`arXiv TXT ${response.status}`);
  const paper = parseArxivTxt(await response.text(), id);
  if (!paper) throw new Error("Paper not found on arXiv TXT");
  const history = await historyPromise;
  const textVersion = Number(paper.versionId.match(/v(\d+)$/)?.[1] ?? 0);
  return history && history.version >= textVersion
    ? { ...paper, published: history.published, updated: history.updated, versionId: `${id}v${history.version}` }
    : paper;
}

function markdownSection(text: string, heading: string, nextHeadings: string[]): string {
  const next = nextHeadings.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const match = text.match(new RegExp(`(?:^|\\n)# ${heading}\\s*\\n([\\s\\S]*?)(?=\\n# (?:${next})\\b|$)`, "i"));
  return match?.[1]?.trim() ?? "";
}

// 保留文本字段的换行，防止日期吞并下一行的版本号。
export function parseArxivTxt(text: string, id: string): ArxivPaper | null {
  const title = markdownSection(text, "Title", ["Authors", "Abstract", "Categories"]);
  if (!title) return null;
  const authors = markdownSection(text, "Authors", ["Abstract", "Categories", "Publication Details"])
    .split(/,\s*/)
    .filter(Boolean)
    .map((name) => ({ name }));
  const summary = markdownSection(text, "Abstract", ["Categories", "Publication Details", "BibTeX"]);
  const categories = markdownSection(text, "Categories", ["Publication Details", "BibTeX"])
    .split(/,\s*/)
    .filter(Boolean);
  const publication = markdownSection(text, "Publication Details", ["BibTeX"]);
  const published = formatDate(publication.match(/Published:[ \t]*([^\n]+)/i)?.[1]?.trim() ?? "");
  const updated = formatDate(publication.match(/(?:Last Updated|Updated):[ \t]*([^\n]+)/i)?.[1]?.trim() ?? "");
  const versionId = publication.match(/arXiv ID:[ \t]*([^\n]+)/i)?.[1]?.trim() ?? id;
  return {
    id,
    versionId,
    title,
    summary,
    published,
    updated: updated !== published ? updated : "",
    authors,
    categories,
    primaryCategory: categories[0] ?? "",
    doi: arxivDoi(id),
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    absUrl: `https://arxiv.org/abs/${id}`,
  };
}

// TXT 通常只有 Published；真实更新时间以 arXiv 的版本历史为准。
export function parseSubmissionHistory(text: string): PaperHistory | null {
  const section = text.match(/(?:^|\n)#{1,6}\s+Submission history\s*\n([\s\S]*?)(?=\n#{1,6}\s|$)/i)?.[1];
  if (!section) return null;
  const versions = section.split("\n").flatMap((line) => {
    const version = line.match(/\[v(\d+)\]/)?.[1];
    const date = line.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:UTC|GMT)\b/)?.[0];
    const stamp = date ? Date.parse(date) : NaN;
    return version && Number.isFinite(stamp) ? [{ version: Number(version), stamp }] : [];
  });
  return historyFromVersions(versions);
}

type PaperHistory = { published: string; updated: string; version: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dataCiteAttributes(value: unknown, id: string): Record<string, unknown> | null {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.data.attributes)) return null;
  const attrs = value.data.attributes;
  return String(attrs.doi).toLowerCase() === arxivDoi(id).toLowerCase() ? attrs : null;
}

export function parseDataCitePaper(value: unknown, id: string): ArxivPaper | null {
  const attrs = dataCiteAttributes(value, id);
  if (!attrs) return null;
  const records = (key: string) => Array.isArray(attrs[key]) ? attrs[key].filter(isRecord) : [];
  const title = records("titles").find((item) => typeof item.title === "string")?.title;
  const summary = records("descriptions").find((item) => item.descriptionType === "Abstract")?.description;
  if (typeof title !== "string" || !title.trim() || typeof summary !== "string" || !summary.trim()) return null;
  const authors = records("creators").flatMap((creator) => {
    const name = typeof creator.givenName === "string" && typeof creator.familyName === "string"
      ? `${creator.givenName} ${creator.familyName}` : creator.name;
    return typeof name === "string" && name.trim() ? [{ name: name.trim() }] : [];
  });
  const categories = records("subjects").flatMap((item) => {
    if (item.subjectScheme !== "arXiv" || typeof item.subject !== "string") return [];
    const category = item.subject.match(/\(([^()]+)\)$/)?.[1] ?? item.subject;
    return category ? [category] : [];
  });
  const history = parseDataCiteHistory(value, id);
  const version = String(attrs.version ?? "").match(/^[1-9]\d*$/)?.[0];
  return {
    id,
    versionId: version ? `${id}v${version}` : id,
    title: title.trim(),
    summary: summary.trim(),
    authors,
    categories,
    primaryCategory: categories[0] ?? "",
    published: history?.published ?? "",
    updated: history?.updated ?? "",
    doi: arxivDoi(id),
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    absUrl: `https://arxiv.org/abs/${id}`,
  };
}

function historyFromVersions(versions: { version: number; stamp: number }[]): PaperHistory | null {
  versions.sort((a, b) => a.version - b.version);
  if (versions[0]?.version !== 1) return null;
  const first = versions[0];
  const latest = versions[versions.length - 1];
  return {
    published: new Date(first.stamp).toISOString(),
    updated: latest.version > 1 ? new Date(latest.stamp).toISOString() : "",
    version: latest.version,
  };
}

// DataCite 的顶层 updated 是注册记录修改时间，不能当作论文更新时间。
// 只接受对应 arXiv DOI 的 Submitted/vN 日期，和 arXiv Submission history 保持一致。
export function parseDataCiteHistory(value: unknown, id: string): PaperHistory | null {
  const attrs = dataCiteAttributes(value, id);
  if (!attrs) return null;
  if (!("dates" in attrs) || !Array.isArray(attrs.dates)) return null;
  const versions = attrs.dates.flatMap((date: unknown) => {
    if (!date || typeof date !== "object" || !("dateType" in date) || date.dateType !== "Submitted") return [];
    if (!("dateInformation" in date) || !("date" in date)) return [];
    const version = String(date.dateInformation).match(/^v([1-9]\d*)$/)?.[1];
    const stamp = Date.parse(String(date.date));
    return version && Number.isFinite(stamp) ? [{ version: Number(version), stamp }] : [];
  });
  const history = historyFromVersions(versions);
  if (history && "version" in attrs && Number(attrs.version) > history.version) return null;
  return history;
}

async function fetchDataCite(id: string): Promise<unknown> {
  const response = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(arxivDoi(id))}`, {
    signal: AbortSignal.timeout(6000),
  });
  return response.ok ? response.json() : null;
}

async function fetchArxivSubmissionHistory(id: string, dataCite: unknown) {
  const history = parseDataCiteHistory(dataCite, id);
  if (history) return history;
  const response = await fetch(`https://r.jina.ai/https://arxiv.org/abs/${encodeURIComponent(id)}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return parseSubmissionHistory(await response.text());
}
