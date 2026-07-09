import { Link } from "@tanstack/react-router";
import { Bookmark, Github, Info, MessageSquare, Puzzle, Star, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";
import { Button } from "./ui/button";
import { ConfettiOverlay } from "./confetti-overlay";
import { InstallGuide } from "./install-guide";

const REPOSITORY_URL = "https://github.com/Peaceful-World-X/ArXivHub";
const ISSUES_URL = `${REPOSITORY_URL}/issues/new?title=ArXiv%20Hub%20反馈`;
const VISITOR_BADGE_URL =
  "https://visitor-badge.laobi.icu/badge?page_id=Peaceful-World-X.ArXivHub&left_color=%236B5B52&right_color=%23D97757";

export function Shell({ children }: { children: React.ReactNode }) {
  const lang = useHub((s) => s.lang);
  const setLang = useHub((s) => s.setLang);
  const t = i18n[lang];
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const closeInstallGuide = useCallback(() => setShowInstallGuide(false), []);
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; }, [lang]);
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const bookmarkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(bookmarkTimer.current), []);
  const dismissBookmarkMessage = useCallback(() => {
    clearTimeout(bookmarkTimer.current);
    setBookmarkMessage(null);
  }, []);
  const [celebration, setCelebration] = useState<{ id: number; kind: "realistic" | "stars" } | null>(null);
  const closeCelebration = useCallback(() => setCelebration(null), []);

  async function bookmarkPage() {
    clearTimeout(bookmarkTimer.current);
    setCelebration((value) => ({ id: (value?.id ?? 0) + 1, kind: "stars" }));
    const external = window.external as { AddFavorite?: (url: string, title: string) => void };
    try {
      if (typeof external?.AddFavorite === "function") {
        external.AddFavorite(window.location.href, document.title);
        setBookmarkMessage(t.bookmark);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setBookmarkMessage(t.bookmarkHint);
      }
    } catch {
      setBookmarkMessage(t.bookmarkFallback);
    }
    bookmarkTimer.current = setTimeout(dismissBookmarkMessage, 3200);
  }

  return (
    <div className="min-h-dvh">
      <div className="h-[3px] bg-accent" />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link
            to="/"
            aria-label={t.app}
            title={t.app}
            className="flex min-w-0 items-center gap-2.5 text-ink no-underline"
          >
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 rounded-sm border border-border bg-surface" />
            <span className="truncate font-display text-base font-medium sm:text-xl">
              <span className="hidden sm:inline">{t.app}</span>
              <span className="sm:hidden">{t.shortApp}</span>
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <Link
              to="/about"
              aria-label={t.about}
              title={t.about}
              className="inline-flex items-center gap-1.5 rounded-sm px-2 py-2 text-xs text-muted no-underline hover:bg-surface-2 hover:text-ink sm:px-3 sm:text-sm"
            >
              <Info className="size-4" aria-hidden="true" /><span className="about-nav-label">{t.about}</span>
            </Link>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-sm px-2 py-2 text-xs text-muted no-underline hover:bg-surface-2 hover:text-ink sm:inline-flex sm:px-3 sm:text-sm"
              aria-label={t.github}
            >
              <Github className="size-4" />
              <span className="hidden sm:inline">{t.github}</span>
            </a>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm px-2 py-2 text-xs font-medium text-muted no-underline hover:bg-surface-2 hover:text-accent sm:px-3 sm:text-sm"
              aria-label={t.star}
            >
              <Star aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">{t.star}</span>
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              aria-label="Toggle language"
              title={lang === "zh" ? "Switch to English" : "切换为中文"}
              className="shrink-0 gap-1.5 px-2"
            >
              <span lang="zh-CN" className={lang === "zh" ? "font-semibold text-ink" : "text-subtle"}>中文</span>
              <span aria-hidden="true" className="text-subtle">/</span>
              <span lang="en" className={lang === "en" ? "font-semibold text-ink" : "text-subtle"}>EN</span>
            </Button>
            <button type="button" onClick={() => setShowInstallGuide(true)} aria-label={t.installGuideTitle} title={t.installGuideTitle} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-2 text-sm text-muted hover:bg-surface-2 hover:text-accent">
              <Puzzle className="size-4" aria-hidden="true" /><span className="hidden sm:inline">{t.installEntry}</span>
            </button>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8">{children}</div>
      <footer className="border-t border-border py-7">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 overflow-x-auto whitespace-nowrap px-4" data-testid="footer-row">
          <nav aria-label={t.friendLinks} className="flex shrink-0 items-center gap-3 text-xs text-muted">
            <a href="https://peaceful-world-x.github.io/Action-Chunking-Survey/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-accent"><img src={`${import.meta.env.BASE_URL}icons/action-chunking-survey.png`} alt="" width="24" height="24" className="size-6 object-contain" />Action-Chunking-Survey</a>
            <a href="https://peaceful-world-x.github.io/LeRobot_TraceLab/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-accent"><img src={`${import.meta.env.BASE_URL}icons/lerobot-tracelab.png`} alt="" width="24" height="24" className="size-6 object-contain" />LeRobot_TraceLab</a>
          </nav>
            <button type="button" onClick={() => setCelebration((value) => ({ id: (value?.id ?? 0) + 1, kind: "realistic" }))} title={t.celebration} className="shrink-0 text-xs text-subtle hover:text-accent">
              © 2026 耗不尽的先生 | Peaceful-World-X
            </button>
          <div className="flex shrink-0 items-center justify-end gap-2" data-testid="footer-actions">
            <button
              type="button"
              onClick={() => void bookmarkPage()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 text-xs text-muted transition-colors hover:border-[#d7a329] hover:bg-[#fff8df] hover:text-[#755415]"
              title={t.bookmarkHint}
            >
              <Bookmark className="size-3.5" />
              {t.bookmark}
            </button>
            <a
              href={ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 text-xs text-muted no-underline transition-colors hover:border-accent hover:bg-surface-2 hover:text-accent"
            >
              <MessageSquare className="size-3.5" />
              {t.feedback}
            </a>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label={t.visitors}>
              <img src={VISITOR_BADGE_URL} alt={t.visitors} className="h-5 w-auto" />
            </a>
          </div>
        </div>
      </footer>
      {bookmarkMessage ? (
        <div className="bookmark-notification-position">
          <div role="status" data-testid="bookmark-notification" className="bookmark-notification flex w-full max-w-lg items-center gap-3 rounded-lg border border-notice-border bg-notice px-4 py-3 text-notice-ink shadow-soft">
            <Bookmark className="size-5 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 font-sans text-sm leading-relaxed">{bookmarkMessage}</p>
            <button type="button" onClick={dismissBookmarkMessage} aria-label={t.dismissNotification} title={t.dismissNotification} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-notice-ink/10"><X className="size-4" /></button>
          </div>
        </div>
      ) : null}
      {celebration ? <ConfettiOverlay key={celebration.id} kind={celebration.kind} onClose={closeCelebration} /> : null}
      {showInstallGuide ? <InstallGuide onClose={closeInstallGuide} /> : null}
    </div>
  );
}
