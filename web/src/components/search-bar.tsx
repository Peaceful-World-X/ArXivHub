import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { normalizeArxivId, routeId } from "@/lib/arxiv";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import { Button } from "./ui/button";

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = normalizeArxivId(value);
    if (!id) {
      setError(t.invalid);
      return;
    }
    setError(null);
    void navigate({ to: "/p/$id", params: { id: routeId(id) } });
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <label className="sr-only" htmlFor="arxiv-query">
        {t.placeholder}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            id="arxiv-query"
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={t.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="paper-search-input w-full border border-border bg-surface pl-11 pr-4 font-mono text-sm text-ink placeholder:font-sans placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
        </div>
        <Button type="submit" size="lg" className="paper-search-submit text-base sm:min-w-36">
          {t.go}
          <ArrowRight className="size-4" />
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
