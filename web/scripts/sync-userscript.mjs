import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import ts from "typescript";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const userscriptPath = resolve(webRoot, "../ArXivHub.user.js");
const publicRoot = resolve(webRoot, "../public");
const begin = "// BEGIN ARXIVHUB SHARED";
const end = "// END ARXIVHUB SHARED";
const modulePath = (name) => JSON.stringify(resolve(webRoot, `src/lib/${name}.ts`));

function objectInitializer(sourceFile, name) {
  const matches = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) matches.push(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (matches.length !== 1 || !matches[0] || !ts.isObjectLiteralExpression(matches[0])) {
    throw new Error(`Expected one literal ${name} object`);
  }
  return matches[0];
}

async function localIconOverrides() {
  const source = await readFile(resolve(webRoot, "src/components/tool-card.tsx"), "utf8");
  const file = ts.createSourceFile("tool-card.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const overrides = new Map();
  for (const property of objectInitializer(file, "ICON_OVERRIDES").properties) {
    if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) continue;
    const value = property.initializer;
    const path = ts.isStringLiteralLike(value) ? value.text : ts.isTemplateExpression(value) &&
      !value.head.text && value.templateSpans.length === 1 &&
      value.templateSpans[0].expression.getText(file).replace(/\s/g, "") === "import.meta.env.BASE_URL"
      ? value.templateSpans[0].literal.text : null;
    if (path?.startsWith("icons/")) overrides.set(property.name.text, path);
  }
  return overrides;
}

function selectIcoFrame(data) {
  const invalid = (detail) => { throw new Error(`Invalid ICO: ${detail}`); };
  if (data.length < 6 || data.readUInt16LE(0) !== 0 || data.readUInt16LE(2) !== 1) invalid("header");
  const count = data.readUInt16LE(4);
  const directoryEnd = 6 + 16 * count;
  if (!count || directoryEnd > data.length) invalid("directory bounds");
  const frames = Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16;
    const width = data[entry] || 256;
    const height = data[entry + 1] || 256;
    const length = data.readUInt32LE(entry + 8);
    const offset = data.readUInt32LE(entry + 12);
    if (data[entry + 3] !== 0 || !length || offset < directoryEnd || offset > data.length || length > data.length - offset) invalid("frame bounds");
    return { entry, width, height, length, offset, size: Math.min(width, height), bits: data.readUInt16LE(entry + 6) };
  });
  const largeEnough = frames.filter((frame) => frame.size >= 48);
  const candidates = largeEnough.length ? largeEnough : frames;
  candidates.sort((a, b) => (largeEnough.length ? a.size - b.size : b.size - a.size) || b.bits - a.bits || a.length - b.length);
  const frame = candidates[0];
  const payload = data.subarray(frame.offset, frame.offset + frame.length);
  if (payload.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    if (payload.length < 33 || payload.readUInt32BE(8) !== 13 || payload.toString("ascii", 12, 16) !== "IHDR" ||
        payload.readUInt32BE(16) !== frame.width || payload.readUInt32BE(20) !== frame.height) invalid("PNG frame metadata");
    return { mime: "image/png", data: payload };
  }
  if (payload.length < 12) invalid("DIB header bounds");
  const headerSize = payload.readUInt32LE(0);
  if (headerSize !== 12 && (headerSize < 40 || headerSize > payload.length)) invalid("DIB header size");
  const width = headerSize === 12 ? payload.readUInt16LE(4) : payload.readInt32LE(4);
  const height = headerSize === 12 ? payload.readUInt16LE(6) : Math.abs(payload.readInt32LE(8));
  const planes = payload.readUInt16LE(headerSize === 12 ? 8 : 12);
  const bits = payload.readUInt16LE(headerSize === 12 ? 10 : 14);
  const entryPlanes = data.readUInt16LE(frame.entry + 4);
  if (width !== frame.width || height !== frame.height * 2 || planes !== 1 || ![1, 4, 8, 16, 24, 32].includes(bits) ||
      (entryPlanes && entryPlanes !== planes) || (frame.bits && frame.bits !== bits)) invalid("DIB frame metadata");
  // Repackage only the existing frame; the pixel payload and directory metadata remain unchanged.
  const header = Buffer.from(data.subarray(0, 6));
  header.writeUInt16LE(1, 4);
  const entry = Buffer.from(data.subarray(frame.entry, frame.entry + 16));
  entry.writeUInt32LE(22, 12);
  return { mime: "image/x-icon", data: Buffer.concat([header, entry, payload]) };
}

async function localIconData(path) {
  if (!path) return null;
  const file = resolve(publicRoot, path);
  if (relative(publicRoot, file).startsWith("..")) throw new Error(`Icon must be inside public/: ${path}`);
  const mime = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".ico": "image/x-icon", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif" }[extname(file).toLowerCase()];
  if (!mime) return null;
  try {
    const data = await readFile(file);
    const icon = extname(file).toLowerCase() === ".ico" ? selectIcoFrame(data) : { mime, data };
    return `data:${icon.mime};base64,${icon.data.toString("base64")}`;
  }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function fallbackIcon(id, label) {
  const initials = label.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "AR";
  const hue = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="hsl(${hue} 78% 94%)"/><text x="32" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="hsl(${hue} 45% 35%)">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function syncBookmarkIcons(source) {
  const file = ts.createSourceFile("ArXivHub.user.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const initializer = objectInitializer(file, "BOOKMARK_ICONS");
  const existing = new Map();
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ||
        !ts.isStringLiteralLike(property.initializer)) throw new Error("BOOKMARK_ICONS must contain literal string entries");
    const value = property.initializer.text;
    if (/^data:image\/(?:png|jpe?g|gif|webp|avif|x-icon|vnd\.microsoft\.icon|svg\+xml)(?:;charset=[^;,]+)?(?:;base64)?,\S/i.test(value)) {
      existing.set(property.name.text, value);
    }
  }
  const overrides = await localIconOverrides();
  const icons = {};
  for (const id of new Set(["hub", ...PAPER_QUICK_IDS, ...PAPER_SOCIAL_IDS])) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Invalid icon ID: ${id}`);
    const tool = TOOLS.find((item) => item.id === id);
    const path = id === "hub" ? "favicon.svg" : tool?.icon?.startsWith("icons/") ? tool.icon : overrides.get(id);
    icons[id] = await localIconData(path) ?? existing.get(id) ?? fallbackIcon(id, tool?.name || id);
  }
  const start = initializer.getStart(file);
  const indent = source.slice(source.lastIndexOf("\n", start) + 1, start).match(/^[\t ]*/)[0];
  const data = JSON.stringify(icons, null, 4).replaceAll("\n", `\n${indent}`);
  return source.slice(0, start) + data + source.slice(initializer.end);
}

let check = false;
let outputPath;
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  if (args[index] === "--check") check = true;
  else if (args[index] === "--output" && args[index + 1] && !args[index + 1].startsWith("--")) outputPath = resolve(args[++index]);
  else throw new Error(`Unknown argument: ${args[index]}`);
}
if (check && outputPath) throw new Error("--check cannot be combined with --output");

async function bundleEntry(source, output) {
  const entry = "\0arxivhub-shared-entry";
  const bundle = await rolldown({
    cwd: webRoot,
    input: entry,
    plugins: [{
      name: "arxivhub-shared-entry",
      resolveId: (id) => id === entry ? entry : null,
      load: (id) => id === entry ? source : null,
    }],
  });
  try {
    const generated = await bundle.generate({ ...output, sourcemap: false, comments: false });
    if (generated.output.length !== 1 || generated.output[0].type !== "chunk") throw new Error("Expected one self-contained shared bundle");
    return generated.output[0].code.trim();
  } finally { await bundle.close(); }
}

// Read the trusted TypeScript configuration through the existing bundler, without a TS loader dependency.
const configuration = await bundleEntry(`
export { TOOLS } from ${modulePath("tools")};
export { PAPER_QUICK_IDS, PAPER_SOCIAL_IDS } from ${modulePath("paper-navigation")};
`, { format: "es" });
const { TOOLS, PAPER_QUICK_IDS, PAPER_SOCIAL_IDS } = await import(`data:text/javascript;base64,${Buffer.from(configuration).toString("base64")}`);
const sites = [...new Set([...PAPER_QUICK_IDS, ...PAPER_SOCIAL_IDS])].map((id) => {
  const tool = TOOLS.find((item) => item.id === id);
  if (!tool) throw new Error(`Unknown paper navigation tool: ${id}`);
  return { id, label: tool.nameZh, labelEn: tool.name, urlTemplate: tool.url, home: tool.home };
});

const runtime = await bundleEntry(`
export { fetchPaperCitations, readCachedPaperCitations, citationPageUrl } from ${modulePath("paper-citations")};
export { fetchAlphaXivLikes, readCachedAlphaXivLikes } from ${modulePath("alphaxiv")};
import { PAPER_QUICK_IDS, PAPER_SOCIAL_IDS, DOCUMENT_ACTIONS, documentLinkUrl, paperDoi } from ${modulePath("paper-navigation")};
export { PAPER_QUICK_IDS, PAPER_SOCIAL_IDS, DOCUMENT_ACTIONS, documentLinkUrl, paperDoi };
import { buildToolUrl } from ${modulePath("paper-navigation")};
export { buildToolUrl };
const sites = ${JSON.stringify(sites)};
export const quickSites = PAPER_QUICK_IDS.map(id => sites.find(site => site.id === id));
export const socialSites = PAPER_SOCIAL_IDS.map(id => sites.find(site => site.id === id));
export function getSiteUrl(id, ctx) {
  const site = sites.find(site => site.id === id);
  if (!site) throw new Error("Unknown paper navigation tool: " + id);
  return buildToolUrl({ id: site.id, home: site.home, url: site.urlTemplate }, ctx);
}
`, { format: "iife", name: "ArxivHubShared", exports: "named", minify: true });
if (/\b(?:globalThis|window)\.(?:fetch|localStorage)\b/.test(runtime)) {
  throw new Error("Shared runtime must use the injected fetch/storage adapters");
}
const block = `    ${begin}
    // Generated by web/scripts/sync-userscript.mjs; edit the shared web/src/lib sources.
    function createSharedPaperServices(fetch, localStorage) {
${runtime.split("\n").map((line) => `        ${line}`).join("\n")}
        return ArxivHubShared;
    }
    ${end}`;

if (outputPath) {
  await writeFile(outputPath, `${block}\n`);
  console.log(`[userscript] wrote shared block to ${outputPath}`);
} else {
  const source = await readFile(userscriptPath, "utf8");
  const region = new RegExp(`^[\\t ]*${begin}\\r?\\n[\\s\\S]*?^[\\t ]*${end}[^\\S\\r\\n]*`, "gm");
  const matches = [...source.matchAll(region)];
  if (matches.length !== 1) throw new Error("Userscript must contain exactly one BEGIN/END ARXIVHUB SHARED block");
  const updated = (await syncBookmarkIcons(source)).replace(region, () => block);
  if (check) {
    if (updated !== source) {
      console.error("[userscript] shared runtime or icons are outdated; run npm run sync:userscript");
      process.exitCode = 1;
    } else console.log("[userscript] shared runtime and icons are current");
  } else if (updated !== source) {
    await writeFile(userscriptPath, updated);
    console.log("[userscript] synchronized shared paper services, navigation, and icons");
  } else console.log("[userscript] shared runtime and icons are current");
}
