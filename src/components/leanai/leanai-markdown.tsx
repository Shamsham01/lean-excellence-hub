import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { safeMarkdownHref } from "@/lib/leanai/safe-markdown-url";
import { cn } from "@/lib/utils";

const DISALLOWED = [
  "img",
  "iframe",
  "object",
  "embed",
  "script",
  "style",
  "form",
  "input",
  "textarea",
  "button",
  "video",
  "audio",
  "svg",
  "math",
] as const;

const components: Components = {
  a: ({ href, children }) => {
    const safe = safeMarkdownHref(typeof href === "string" ? href : null);
    if (!safe) {
      return <span>{children}</span>;
    }
    return (
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
};

export function LeanAiMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 text-sm leading-relaxed break-words text-foreground",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold",
        "[&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_li]:mt-1",
        "[&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_p]:mt-2 [&_p:first-child]:mt-0",
        "[&_pre]:mt-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
      data-testid="leanai-markdown"
    >
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkBreaks]}
        disallowedElements={[...DISALLOWED]}
        urlTransform={(url) => safeMarkdownHref(url) ?? ""}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
