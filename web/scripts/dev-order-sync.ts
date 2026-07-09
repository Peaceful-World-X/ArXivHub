import { readFile, rename, writeFile } from "node:fs/promises";
import type { Plugin } from "vite";

export function defaultOrderSync(file: string, allowed: Record<string, string[]>): Plugin {
  let queue = Promise.resolve();
  return {
    name: "local-default-order-sync",
    apply: "serve",
    configureServer(server) {
      server.ws.on("arxiv-hub:save-default-order", (data, client) => {
        queue = queue.then(async () => {
          try {
            if (!data || typeof data.requestId !== "string" || data.requestId.length > 80 || !data.orders || typeof data.orders !== "object" || Array.isArray(data.orders)) throw new Error("Invalid snapshot");
            if (Object.keys(data.orders).length !== Object.keys(allowed).length) throw new Error("Incomplete snapshot");
            const orders: Record<string, string[]> = {};
            for (const [category, ids] of Object.entries(allowed)) {
              const incoming = data.orders[category];
              if (!Array.isArray(incoming) || incoming.length > ids.length || (category !== "favorites" && incoming.length !== ids.length)) throw new Error("Invalid category order");
              if (new Set(incoming).size !== incoming.length || incoming.some((id) => typeof id !== "string" || !ids.includes(id))) throw new Error("Invalid tool ID");
              orders[category] = incoming;
            }
            const content = JSON.stringify(orders, null, 2) + "\n";
            const previous = await readFile(file, "utf8").catch(() => "");
            if (previous !== content) {
              await writeFile(`${file}.tmp`, content, "utf8");
              await rename(`${file}.tmp`, file);
              server.config.logger.info(`[ArXiv Hub] Saved release order: ${orders.all.length} entries, ${Object.keys(orders).length} lists.`);
            }
            client.send("arxiv-hub:default-order-saved", { requestId: data.requestId, ok: true });
          } catch {
            client.send("arxiv-hub:default-order-saved", { requestId: data?.requestId, ok: false });
          }
        });
      });
    },
  };
}
