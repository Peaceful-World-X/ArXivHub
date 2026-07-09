import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react";
import { copy } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import type { Tool, ToolContext } from "@/lib/tools";
import { ToolCard } from "./tool-card";

export function SortableToolCard({ tool, ctx, hrefOverride, editing, index, count, onMove }: {
  tool: Tool; ctx?: ToolContext; hrefOverride?: string; editing: boolean;
  index: number; count: number; onMove: (from: number, to: number) => void;
}) {
  const t = copy[useHub((s) => s.lang)];
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: tool.id, disabled: !editing });
  return (
    <div ref={setNodeRef} className="min-w-0" style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined, opacity: isDragging ? .8 : 1 }}>
      <ToolCard tool={tool} ctx={ctx} hrefOverride={hrefOverride} reorderControls={editing ? (
        <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
          <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={t.dragTool} title={t.dragTool} className="grid size-11 touch-none place-items-center rounded-full text-muted hover:bg-surface-2 active:cursor-grabbing"><GripVertical className="size-4" /></button>
          <div className="flex">
            <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={t.moveEarlier} title={t.moveEarlier} className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 disabled:opacity-25"><ArrowLeft className="size-4" /></button>
            <button type="button" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={t.moveLater} title={t.moveLater} className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 disabled:opacity-25"><ArrowRight className="size-4" /></button>
          </div>
        </div>
      ) : undefined} />
    </div>
  );
}
