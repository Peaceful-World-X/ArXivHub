import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dist", { recursive: true });
copyFileSync("dist/index.html", "dist/404.html");
writeFileSync("dist/.nojekyll", "");
console.log("[static] copied index.html to 404.html for GitHub Pages routes");
