import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defaultOrderSync } from "./scripts/dev-order-sync";
import { CATEGORIES, TOOLS } from "./src/lib/tools";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// GitHub Pages 把项目部署在仓库名子路径；本地开发默认使用根路径。
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  publicDir: resolve(projectRoot, "../public"),
  plugins: [tailwindcss(), react(), defaultOrderSync(
    resolve(projectRoot, "src/lib/default-tool-orders.json"),
    Object.fromEntries([
      ...CATEGORIES.map((category) => [category.id, TOOLS.filter((tool) => category.id === "all" || tool.category === category.id || tool.additionalCategories?.includes(category.id)).map((tool) => tool.id)]),
      ["favorites", TOOLS.map((tool) => tool.id)],
    ]),
  )],
  resolve: { alias: { "@": resolve(projectRoot, "src") } },
  server: { host: "0.0.0.0", port: 8080, strictPort: true },
  preview: { host: "0.0.0.0", port: 8081, strictPort: true },
});
