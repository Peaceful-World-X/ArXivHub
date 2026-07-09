import { useEffect, useRef } from "react";
import "katex/dist/katex.min.css";

// 先作为纯文本插入，再交给 KaTeX 排版，避免把外部摘要当作 HTML 执行。
export function MathText({ text, className, inline = false }: { text: string; className?: string; inline?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.textContent = text;
    const element = ref.current;
    let active = true;
    void import("katex/contrib/auto-render").then(({ default: renderMathInElement }) => {
      if (!active) return;
      renderMathInElement(element, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
      trust: false,
      strict: "ignore",
      });
    }).catch(() => { /* 加载失败时保留原始摘要。 */ });
    return () => { active = false; };
  }, [text]);
  const setRef = (node: HTMLElement | null) => { ref.current = node; };
  return inline
    ? <span ref={setRef} className={`paper-math ${className ?? ""}`} />
    : <div ref={setRef} className={`paper-math ${className ?? ""}`} />;
}
