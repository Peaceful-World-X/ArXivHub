import { useMemo, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AlertCircle, ArrowDownUp, Check, RotateCcw, Save } from "lucide-react";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import { CATEGORIES, TOOLS, DEFAULT_FAVORITES, PAPER_CATEGORIES, type Tool, type ToolContext } from "@/lib/tools";
import { applyOrder, DEFAULT_TOOL_ORDERS, matchesCategory, type FilterCategory } from "@/lib/tool-order";
import { saveDefaultToolOrder } from "@/lib/dev-order-sync";
import { cn } from "@/lib/utils";
import { ToolCard } from "./tool-card";
import { SortableToolCard } from "./sortable-tool-card";

export function ToolGrid({ ctx, tools = TOOLS, compact = false, initialCategory = "all" }: { ctx?: ToolContext; tools?: Tool[]; compact?: boolean; initialCategory?: FilterCategory }) {
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  const pinned = useHub((s) => s.pinned);
  const toolOrders = useHub((s) => s.toolOrders);
  const setToolOrder = useHub((s) => s.setToolOrder);
  const resetToolOrder = useHub((s) => s.resetToolOrder);
  const [editing, setEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [cat, setCat] = useState<FilterCategory>(initialCategory);
  const [q, setQ] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("discussion");

  const ordered = useMemo(() => applyOrder(applyOrder(tools.filter((tool) => matchesCategory(tool, cat, pinned)), pinned), compact ? [] : toolOrders[cat] ?? DEFAULT_TOOL_ORDERS[cat]), [tools, cat, pinned, compact, toolOrders]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ordered.filter((tool) => `${tool.name} ${tool.nameZh} ${tool.blurb} ${tool.blurbZh}`.toLowerCase().includes(needle));
  }, [ordered, q]);

  function moveTool(from: number, to: number) {
    if (from < 0 || to < 0 || from === to || to >= filtered.length) return;
    setSaveStatus("idle");
    const moved = arrayMove(filtered.map((tool) => tool.id), from, to);
    const visible = new Set(moved);
    let index = 0;
    // Reorder only matching slots when a search filter hides other cards.
    setToolOrder(cat, ordered.map((tool) => visible.has(tool.id) ? moved[index++] : tool.id));
  }

  const filters = [CATEGORIES[0], { id: "favorites" as const, label: "Favorites", labelZh: "收藏" }, ...CATEGORIES.slice(1)]
    .map((category) => ({ ...category, count: tools.filter((tool) => matchesCategory(tool, category.id, pinned)).length }));

  if (compact) {
    const groups = PAPER_CATEGORIES.map((id) => ({
        ...CATEGORIES.find((category) => category.id === id)!,
        tools: applyOrder(filtered.filter((tool) => matchesCategory(tool, id, pinned)), toolOrders[id] ?? DEFAULT_TOOL_ORDERS[id]),
      }))
      .filter((group) => group.tools.length > 0);
    return (
      <section className="paper-tool-layout" data-testid="paper-tools">
        <nav className="paper-tool-outline" aria-label={lang === "zh" ? "论文入口分类" : "Paper tool categories"}>
          {groups.map((group) => (
            <button key={group.id} type="button" aria-label={lang === "zh" ? group.labelZh : group.label} title={`${lang === "zh" ? group.labelZh : group.label} (${group.tools.length})`} aria-pressed={activeGroup === group.id}
              className={cn("flex min-h-11 items-center justify-between gap-1 rounded-lg px-2 py-2 text-left text-sm", activeGroup === group.id ? "bg-surface-2 text-accent" : "text-muted hover:bg-surface-2")}
              onClick={() => {
                setActiveGroup(group.id);
                document.getElementById(`paper-tools-${group.id}`)?.scrollIntoView({ block: "start" });
              }}>
              <span>{lang === "zh" ? group.labelZh : group.label}</span>
              <span data-category-count aria-hidden="true" className="text-xs tabular-nums opacity-70">{group.tools.length}</span>
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-7">
        {groups.map((group) => (
          <div key={group.id} id={`paper-tools-${group.id}`} className="scroll-mt-6">
            <h3 className="mb-2 font-display text-lg text-ink">{lang === "zh" ? group.labelZh : group.label}</h3>
            <div className="border-t border-border">
              {group.tools.map((tool) => <ToolCard key={tool.id} tool={tool} ctx={ctx} compact />)}
            </div>
          </div>
        ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-2 border-b border-border">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {filters.map((c) => (
            <button key={c.id} type="button" data-category={c.id} aria-label={lang === "zh" ? c.labelZh : c.label} title={`${lang === "zh" ? c.labelZh : c.label} (${c.count})`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className="category-tab">
              <span>{lang === "zh" ? c.labelZh : c.label}</span>
              <span data-category-count aria-hidden="true" className="min-w-4 text-center text-xs tabular-nums opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchTools} aria-label={t.searchTools} className="h-9 w-24 shrink-0 rounded-sm border border-border bg-surface px-2 text-center text-sm placeholder:text-subtle focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/20 sm:w-28" />
        {editing ? <button type="button" onClick={() => resetToolOrder(cat)} title={t.resetOrder} aria-label={t.resetOrder} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"><RotateCcw className="size-4" /></button> : null}
        {import.meta.env.DEV && editing ? <button type="button" disabled={saveStatus === "saving"} onClick={() => {
          setSaveStatus("saving");
          void saveDefaultToolOrder().then(() => setSaveStatus("saved"), () => setSaveStatus("error"));
        }} aria-label={t.saveDefaultOrder} title={saveStatus === "saved" ? t.defaultOrderSaved : saveStatus === "error" ? t.defaultOrderFailed : t.saveDefaultOrder} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 disabled:opacity-50">{saveStatus === "saved" ? <Check className="size-4 text-ok" /> : saveStatus === "error" ? <AlertCircle className="size-4 text-accent" /> : <Save className="size-4" />}</button> : null}
        <button type="button" onClick={() => setEditing(!editing)} aria-pressed={editing} title={editing ? t.finishSorting : t.sortTools} aria-label={editing ? t.finishSorting : t.sortTools} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">{editing ? <Check className="size-4 text-ok" /> : <ArrowDownUp className="size-4" />}</button>
      </div>
      {filtered.length === 0 ? <p role="status" className="mt-8 text-sm text-muted">{cat === "favorites" && !q.trim() ? t.noFavorites : t.noTools}</p> : (
        <DndContext key={cat} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over) moveTool(filtered.findIndex((tool) => tool.id === active.id), filtered.findIndex((tool) => tool.id === over.id)); }}>
          <SortableContext items={filtered.map((tool) => tool.id)} strategy={rectSortingStrategy}>
            <div data-tool-grid className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((tool, index) => <SortableToolCard key={tool.id} tool={tool} ctx={ctx} editing={editing} index={index} count={filtered.length} onMove={moveTool} hrefOverride={cat === "favorites" ? DEFAULT_FAVORITES.find((entry) => entry.id === tool.id)?.url : undefined} />)}</div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
