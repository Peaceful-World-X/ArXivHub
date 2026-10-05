import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Star } from "lucide-react";
import { Shell } from "@/components/shell";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import { CATEGORIES, TOOLS } from "@/lib/tools";

export const Route = createFileRoute("/about")({ component: About });

const groups = CATEGORIES.filter((category) => category.id !== "all")
  .map((category) => ({
    ...category,
    tools: TOOLS.filter((tool) => tool.category === category.id)
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id)),
  }))
  .filter((group) => group.tools.length > 0);
const numbers = new Map(groups.flatMap((group) => group.tools).map((tool, index) => [tool.id, index + 1]));

function About() {
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  return (
    <Shell>
      <section className="max-w-3xl" data-testid="about-intro">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} width="40" height="40" alt="" className="size-10 shrink-0" />
          <h1 className="font-display text-3xl leading-tight">{t.aboutHeading}</h1>
        </div>
        <p className="mt-4 text-base leading-relaxed text-muted">{t.aboutBody}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted" data-testid="inclusion-policy">{t.inclusionPolicy}</p>
        <aside className="star-support" aria-label={t.supportLabel} data-testid="star-support">
          <Star className="size-5 self-center text-accent" aria-hidden="true" />
          <p className="self-center text-muted"><strong className="font-medium text-ink">{t.supportTitle}</strong> {t.supportBody}</p>
          <a href="https://github.com/Peaceful-World-X/ArXivHub" target="_blank" rel="noreferrer" className="star-support-link inline-flex min-h-11 items-center gap-1.5 font-medium text-muted underline-offset-4 hover:text-accent hover:underline">
            {t.starOnGitHub}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
          </a>
        </aside>
      </section>

      <section className="mt-10" aria-labelledby="directory-heading">
        <div className="flex items-baseline gap-3">
          <h2 id="directory-heading" className="font-display text-2xl">{t.directoryHeading}</h2>
          <span className="text-sm tabular-nums text-subtle">{TOOLS.length}</span>
        </div>
        <nav aria-label={t.categories} className="mt-4 flex flex-wrap gap-2">
          {groups.map((group) => <a key={group.id} href={`#directory-${group.id}`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface-2 px-3 text-sm text-muted hover:text-accent">
            {lang === "zh" ? group.labelZh : group.label}<span className="text-xs tabular-nums">{group.tools.length}</span>
          </a>)}
        </nav>

        <div className="mt-8 space-y-10">
          {groups.map((group) => (
            <section key={group.id} id={`directory-${group.id}`} data-directory-category={group.id} className="scroll-mt-6" aria-labelledby={`directory-heading-${group.id}`}>
              <div className="mb-3 flex items-baseline gap-2">
                <h3 id={`directory-heading-${group.id}`} className="font-display text-xl">{lang === "zh" ? group.labelZh : group.label}</h3>
                <span className="text-xs tabular-nums text-subtle">{group.tools.length}</span>
              </div>
              <table className="directory-table text-left text-sm" aria-labelledby={`directory-heading-${group.id}`}>
                <colgroup><col className="w-12" /><col className="w-1/4" /><col className="w-1/3" /><col /></colgroup>
                <thead className="border-y border-border bg-surface-2/50 text-xs text-muted">
                  <tr>{[t.directoryNumber, t.directoryName, t.directoryUrl, t.directoryDescription].map((label) => <th key={label} scope="col" className="px-2 py-3 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {group.tools.map((tool) => (
                    <tr key={tool.id} data-directory-tool={tool.id} className="border-b border-border">
                      <td className="px-2 py-3 align-top tabular-nums text-subtle">{numbers.get(tool.id)}</td>
                      <td className="px-2 py-3 align-top font-medium text-ink"><a href={tool.home} target="_blank" rel="noreferrer" className="hover:text-accent">{lang === "zh" ? tool.nameZh : tool.name}</a></td>
                      <td className="px-2 py-3 align-top"><a href={tool.home} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent underline-offset-4 hover:underline">{tool.home}</a></td>
                      <td className="px-2 py-3 align-top leading-relaxed text-muted">{lang === "zh" ? tool.blurbZh : tool.blurb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </section>
    </Shell>
  );
}
