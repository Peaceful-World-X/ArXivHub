import { useState } from "react";
import type { ArxivPaper } from "@/lib/arxiv";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";

const ASSISTANTS = [
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/", mode: "prefill" },
  { id: "claude", name: "Claude", url: "https://claude.ai/new", mode: "prefill" },
  { id: "kimi", name: "Kimi", url: "https://www.kimi.com/", icon: "kimi.jpg", mode: "copy" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com/app", mode: "copy" },
  { id: "grok", name: "Grok", url: "https://grok.com/", mode: "prefill" },
];

export function PaperAiLinks({ id, paper }: { id: string; paper: ArxivPaper | null; tldr?: string | null }) {
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  const [feedback, setFeedback] = useState("");
  const pdfUrl = `https://arxiv.org/pdf/${id}${paper?.versionId.match(/v\d+$/)?.[0] ?? ""}`;
  const question = lang === "zh"
    ? `请你详细介绍一下这篇论文 ${pdfUrl}`
    : `Please explain this paper in detail: ${pdfUrl}`;
  const prefilledUrls: Record<string, string> = {
    chatgpt: `https://chatgpt.com/?prompt=${encodeURIComponent(question)}`,
    claude: `https://claude.ai/new?q=${encodeURIComponent(question)}`,
    grok: `https://grok.com/?q=${encodeURIComponent(question)}`,
  };

  // Kimi/Gemini 先复制完整提示词，再打开各自首页。
  async function copyQuestion() {
    try {
      await navigator.clipboard.writeText(question);
      setFeedback(t.questionCopied);
    } catch {
      setFeedback(t.questionCopyFailed);
    }
  }

  return (
    <section className="min-w-0" aria-label={t.askAi} data-testid="paper-ai-links">
      <div className="flex flex-wrap gap-1">
        {ASSISTANTS.map((assistant) => (
          <a key={assistant.id} href={assistant.mode === "prefill" ? prefilledUrls[assistant.id] : assistant.url} target="_blank" rel="noopener noreferrer"
            onClick={(event) => {
              if (assistant.mode === "copy") {
                event.preventDefault();
                const popup = window.open("about:blank", "_blank");
                void copyQuestion().then(() => {
                  if (popup) popup.location.href = assistant.url;
                  else window.open(assistant.url, "_blank", "noopener,noreferrer");
                });
              }
            }}
            title={`${t.copyQuestion} · ${assistant.name}`}
            aria-label={assistant.name}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface shadow-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent">
            <img src={`${import.meta.env.BASE_URL}icons/assistants/${assistant.icon ?? `${assistant.id}.png`}`} width="24" height="24" className="size-6 rounded-lg object-contain" alt="" />
          </a>
        ))}
      </div>
      {feedback ? <p role="status" className="mt-3 text-xs text-muted">{feedback}</p> : null}
    </section>
  );
}
