import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

// 确认首页、深链回退页和入口资源齐全，避免发布成功但页面空白。
function verifySite(directory) {
  const html = readFileSync(resolve(directory, "index.html"), "utf8");
  assert.equal(readFileSync(resolve(directory, "404.html"), "utf8"), html, "404.html must match index.html");
  assert.ok(statSync(resolve(directory, ".nojekyll")).isFile(), "Missing .nojekyll");
  const resources = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1]).filter((url) => !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url));
  assert.ok(resources.some((url) => /\.js(?:[?#]|$)/.test(url)), "Missing JavaScript entry");
  for (const url of resources) {
    const path = resolve(directory, `.${decodeURIComponent(new URL(url, "https://arxivhub.github.io/").pathname)}`);
    assert.ok(path.startsWith(directory + sep), `Invalid asset path: ${url}`);
    assert.ok(statSync(path).isFile(), `Missing asset: ${url}`);
  }
  return html;
}

const [sourceArg, targetArg] = process.argv.slice(2);
assert.ok(sourceArg && targetArg, "Usage: node sync-pages.mjs <build-directory> <target-directory>");
const source = resolve(sourceArg);
const target = resolve(targetArg);
assert.notEqual(source, target, "Build and target directories must differ");
const html = verifySite(source);

// 按内容校验：同一秒生成且大小相同的 HTML 也必须更新。
execFileSync("rsync", ["-acv", "--delete", "--exclude=.git", `${source}/`, `${target}/`], { stdio: "inherit" });
assert.equal(verifySite(target), html, "Published HTML differs from the current build");
console.log("[pages] Synced by checksum; HTML and entry assets verified.");
