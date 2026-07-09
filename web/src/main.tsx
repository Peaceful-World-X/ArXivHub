import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("ArXiv Hub root element is missing");

if (import.meta.env.DEV && !navigator.webdriver) {
  void import("./lib/dev-order-sync").then(({ startDefaultOrderSync }) => startDefaultOrderSync());
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={getRouter()} />
  </StrictMode>,
);
