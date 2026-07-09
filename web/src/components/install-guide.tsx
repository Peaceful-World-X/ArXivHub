import { useEffect, useRef } from "react";
import { ArrowUpRight, Puzzle, X } from "lucide-react";
import { copy } from "@/lib/i18n";
import { useHub } from "@/lib/store";

export function InstallGuide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t = copy[useHub((state) => state.lang)];
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby="install-guide-title" className="install-guide" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="install-guide-title" className="flex items-center gap-2 font-sans text-lg font-semibold"><Puzzle className="size-5 text-accent" />{t.installGuideTitle}</h2>
          <button type="button" onClick={onClose} title={t.closeGuide} aria-label={t.closeGuide} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"><X className="size-5" /></button>
        </div>
        <ol className="mt-5 space-y-6">
          <li className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-medium text-accent" aria-hidden="true">1</span>
            <div className="min-w-0">
              <h3 className="font-sans text-base font-medium">{t.installTampermonkey}</h3>
              <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-accent hover:underline">Tampermonkey<ArrowUpRight className="size-4" /></a>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-medium text-accent" aria-hidden="true">2</span>
            <div className="min-w-0">
              <h3 className="font-sans text-base font-medium">{t.installHubScript}</h3>
              <a href="https://raw.githubusercontent.com/Peaceful-World-X/ArXivHub/main/ArXivHub.user.js" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-accent hover:underline">{t.installScript}<ArrowUpRight className="size-4" /></a>
            </div>
          </li>
        </ol>
      </div>
    </dialog>
  );
}
