import defaults from "./default-tool-orders.json";
import { CATEGORIES, TOOLS, type Tool, type ToolCategory } from "./tools";

export type FilterCategory = ToolCategory | "all" | "favorites";
export const DEFAULT_TOOL_ORDERS: Record<string, string[]> = defaults;

export function applyOrder(tools: Tool[], ids: string[] = []): Tool[] {
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return [...tools].sort((a, b) => (ranks.get(a.id) ?? ids.length) - (ranks.get(b.id) ?? ids.length));
}

export function matchesCategory(tool: Tool, category: FilterCategory, favorites: string[]): boolean {
  if (category === "all") return true;
  if (category === "favorites") return favorites.includes(tool.id);
  return tool.category === category || Boolean(tool.additionalCategories?.includes(category));
}

export function snapshotToolOrders(pinned: string[], orders: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries([...CATEGORIES.map((category) => category.id), "favorites" as const].map((category) => [
    category,
    applyOrder(applyOrder(TOOLS.filter((tool) => matchesCategory(tool, category, pinned)), pinned), orders[category] ?? DEFAULT_TOOL_ORDERS[category]).map((tool) => tool.id),
  ]));
}
