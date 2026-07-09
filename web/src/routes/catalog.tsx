import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { ToolGrid } from "@/components/tool-grid";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import { TOOLS } from "@/lib/tools";

export const Route = createFileRoute("/catalog")({ component: Catalog });

function Catalog() {
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  return (
    <Shell>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
        {TOOLS.length} {t.tools}
      </p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{t.catalog}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t.catalogLead}</p>
      <div className="mt-8">
        <ToolGrid />
      </div>
    </Shell>
  );
}
