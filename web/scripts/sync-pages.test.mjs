import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("./sync-pages.mjs", import.meta.url));

// 构造同大小、同修改时间而内容不同的两个发布目录，复现 rsync 漏更新。
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "arxivhub-pages-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "build");
  const target = join(root, "target");
  for (const [directory, hash] of [[source, "new11111"], [target, "old22222"]]) {
    mkdirSync(join(directory, "assets"), { recursive: true });
    const html = `<script type="module" src="/assets/index-${hash}.js"></script><link rel="stylesheet" href="/assets/site.css">`;
    for (const name of ["index.html", "404.html"]) {
      writeFileSync(join(directory, name), html);
      utimesSync(join(directory, name), 1791008548, 1791008548);
    }
    writeFileSync(join(directory, ".nojekyll"), "");
    writeFileSync(join(directory, "assets/site.css"), "body { color: red; }");
    writeFileSync(join(directory, `assets/index-${hash}.js`), "document.body.textContent = 'ArXiv Hub';");
  }
  mkdirSync(join(target, ".git"));
  writeFileSync(join(target, ".git/config"), "preserve repository config");
  return { source, target };
}

test("same-second, same-size HTML must update with its renamed JavaScript", (t) => {
  const { source, target } = fixture(t);
  execFileSync("rsync", ["-av", "--delete", "--exclude=.git", `${source}/`, `${target}/`]);
  assert.match(readFileSync(join(target, "index.html"), "utf8"), /old22222/);
  assert.equal(existsSync(join(target, "assets/index-old22222.js")), false);

  execFileSync(process.execPath, [script, source, target]);
  for (const name of ["index.html", "404.html"]) {
    assert.equal(readFileSync(join(target, name), "utf8"), readFileSync(join(source, name), "utf8"));
  }
  assert.equal(existsSync(join(target, "assets/index-new11111.js")), true);
  assert.equal(readFileSync(join(target, ".git/config"), "utf8"), "preserve repository config");
});

test("reject an incomplete build before modifying the published directory", (t) => {
  const { source, target } = fixture(t);
  rmSync(join(source, "assets/index-new11111.js"));
  const result = spawnSync(process.execPath, [script, source, target], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /index-new11111\.js/);
  assert.match(readFileSync(join(target, "index.html"), "utf8"), /old22222/);
  assert.equal(existsSync(join(target, "assets/index-old22222.js")), true);
});

test("reject a stale deep-link fallback page", (t) => {
  const { source, target } = fixture(t);
  writeFileSync(join(source, "404.html"), "outdated page");
  const result = spawnSync(process.execPath, [script, source, target], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /404\.html must match index\.html/);
});
