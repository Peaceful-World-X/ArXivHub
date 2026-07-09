import { createBrowserHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function basePath(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base || "/";
}

export function getRouter() {
  return createRouter({
    routeTree,
    basepath: basePath(),
    history: createBrowserHistory(),
    defaultPreload: "intent",
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
