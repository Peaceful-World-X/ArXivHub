import defaults from "./default-tool-orders.json";
import { CATEGORIES, TOOLS, type Tool, type ToolCategory } from "./tools";

export type FilterCategory = ToolCategory | "all" | "favorites";
export const DEFAULT_TOOL_ORDERS: Record<string, string[]> = defaults;

// 分类拆分后读取旧版本的排序，避免用户原来的 AIChat/发现顺序丢失。
export function savedOrder(category: string, orders: Record<string, string[]>): string[] {
  const base = orders[category]
    ?? ((category === "ai-summary" || category === "ai-chat") ? orders.ai : undefined)
    ?? (category === "subscribe" ? orders.discover : undefined)
    ?? DEFAULT_TOOL_ORDERS[category]
    ?? [];

  // 新分类默认按名称排序；保留用户保存的分类顺序，同时把收藏顺序放到前面。
  // 收藏列表是用户可拖动的独立顺序，因此同一批收藏在所有分类中保持一致。
  const favoriteOrder = orders.favorites ?? DEFAULT_TOOL_ORDERS.favorites ?? [];
  if (category === "favorites") return base;
  const favoriteIds = new Set(favoriteOrder);
  return [
    ...favoriteOrder.filter((id) => base.includes(id)),
    ...base.filter((id) => !favoriteIds.has(id)),
  ];
}

// 收藏始终置顶，收藏与未收藏各自保留已保存的顺序。
export function applyOrder(tools: Tool[], ids: string[] = [], favorites: string[] = [], favoriteOrder: string[] = favorites): Tool[] {
  const pinned = new Set(favorites);
  // The Favorites view itself is user-sortable; every other view follows the
  // shared pinned order so a newly starred card appears at the front everywhere.
  const favoritesOnly = tools.length > 0 && tools.every((tool) => pinned.has(tool.id));
  const orderedPinned = favoritesOnly ? ids : [
    ...favorites.filter((id) => !favoriteOrder.includes(id)),
    ...favoriteOrder.filter((id) => pinned.has(id)),
  ];
  const favoriteRanks = new Map(orderedPinned.map((id, index) => [id, index]));
  const orderRanks = new Map(ids.map((id, index) => [id, index]));
  return [...tools].sort((a, b) => {
    const aPinned = pinned.has(a.id);
    const bPinned = pinned.has(b.id);
    if (aPinned !== bPinned) return Number(bPinned) - Number(aPinned);
    const ranks = aPinned ? favoriteRanks : orderRanks;
    const fallback = ranks.size;
    const rankA = ranks.get(a.id);
    const rankB = ranks.get(b.id);
    if (rankA === undefined && rankB === undefined) {
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id);
    }
    return (rankA ?? fallback) - (rankB ?? fallback);
  });
}

export function matchesCategory(tool: Tool, category: FilterCategory, favorites: string[]): boolean {
  if (category === "all") return true;
  if (category === "favorites") return favorites.includes(tool.id);
  return tool.category === category || Boolean(tool.additionalCategories?.includes(category));
}

export function snapshotToolOrders(pinned: string[], orders: Record<string, string[]>): Record<string, string[]> {
  const favoriteOrder = savedOrder("favorites", orders);
  return Object.fromEntries([...CATEGORIES.map((category) => category.id), "favorites" as const].map((category) => [
    category,
    applyOrder(TOOLS.filter((tool) => matchesCategory(tool, category, pinned)), savedOrder(category, orders), pinned, favoriteOrder).map((tool) => tool.id),
  ]));
}
