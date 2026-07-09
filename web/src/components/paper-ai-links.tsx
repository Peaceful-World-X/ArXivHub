import { useState } from "react";
import type { ArxivPaper } from "@/lib/arxiv";
import { copy as i18n } from "@/lib/i18n";
import { useHub } from "@/lib/store";

const ASSISTANTS = [
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "claude", name: "Claude", url: "https://claude.ai/new" },
  { id: "kimi", name: "Kimi", url: "https://www.kimi.com/", icon: "kimi.jpg" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com/app" },
  { id: "grok", name: "Grok", url: "https://grok.com/" },
];

export function PaperAiLinks({ id, paper, tldr }: { id: string; paper: ArxivPaper | null; tldr: string | null }) {
  const lang = useHub((s) => s.lang);
  const t = i18n[lang];
  const [feedback, setFeedback] = useState("");
  const question = [
    lang === "zh"
      ? "请分析这篇论文的研究问题、核心方法、实验结果与局限；未核实的内容请明确说明，不要编造结果。"
      : "Analyze this paper's research question, methods, results and limitations. Clearly identify unverified claims; do not invent results.",
    paper?.title,
    `https://arxiv.org/abs/${id}`,
    tldr ? `ArXiv TLDR: ${tldr}` : "",
  ].filter((line): line is string => Boolean(line)).map((line) => line.replace(/\s+/g, " ").trim()).join("\n");

  // 在外链打开前发起复制，问题仅含提问、题目、链接和 TLDR。
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
          <a key={assistant.id} href={assistant.url} target="_blank" rel="noopener noreferrer"
            onClick={() => { void copyQuestion(); }}
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
