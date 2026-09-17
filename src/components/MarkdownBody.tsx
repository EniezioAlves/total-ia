import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Tone = "light" | "dark";

function markdownComponents(tone: Tone): Components {
  const heading = tone === "dark" ? "text-white" : "text-navy";
  const muted = tone === "dark" ? "text-white/70" : "text-muted";
  const codeBg = tone === "dark" ? "bg-white/15" : "bg-ice";
  const line = tone === "dark" ? "border-white/20" : "border-line";
  const link = tone === "dark" ? "text-white underline" : "text-accent underline";
  return {
    h1: ({ children }) => (
      <h1 className={`mt-3 mb-1 text-base font-semibold first:mt-0 ${heading}`}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className={`mt-3 mb-1 text-base font-semibold first:mt-0 ${heading}`}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className={`mt-2 mb-1 text-sm font-semibold first:mt-0 ${heading}`}>{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h4>
    ),
    p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
    ol: ({ children }) => (
      <ol className="my-1.5 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-6">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    hr: () => <hr className={`my-3 ${line}`} />,
    a: ({ href, children }) => (
      <a href={href} className={link} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className={`rounded px-1 font-mono text-[0.9em] ${codeBg}`}>{children}</code>
    ),
    pre: ({ children }) => (
      <pre className={`my-2 max-w-full overflow-x-auto rounded-lg p-2 text-sm ${codeBg}`}>{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className={`my-2 border-l-2 pl-3 ${line} ${muted}`}>{children}</blockquote>
    ),
    table: ({ children }) => (
      <div className="my-2 max-w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className={tone === "dark" ? "bg-white/10" : "bg-ice"}>{children}</thead>,
    th: ({ children }) => <th className={`border px-2 py-1 font-semibold ${line}`}>{children}</th>,
    td: ({ children }) => <td className={`border px-2 py-1 ${line}`}>{children}</td>,
  };
}

const LIGHT = markdownComponents("light");
const DARK = markdownComponents("dark");

export function previewPlain(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fecha cercas e ênfase ainda abertas para o markdown renderizar durante o stream. */
export function stabilizeStreamingMarkdown(text: string): string {
  if (!text) {
    return text;
  }
  let out = text.replaceAll("\r\n", "\n");

  let inFence = false;
  for (const line of out.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
    }
  }
  if (inFence) {
    out += "\n```";
  }

  const withoutFences = out.replace(/```[\s\S]*?```/g, "");
  if ((withoutFences.match(/`/g) ?? []).length % 2 === 1) {
    out += "`";
  }
  const withoutCode = withoutFences.replace(/`[^`]*`/g, "");
  if ((withoutCode.match(/\*\*/g) ?? []).length % 2 === 1) {
    out += "**";
  }
  return out;
}

export function MarkdownBody({
  text,
  tone = "light",
  streaming = false,
}: {
  text: string;
  tone?: Tone;
  streaming?: boolean;
}) {
  const source = streaming ? stabilizeStreamingMarkdown(text) : text;
  return (
    <div className="max-w-full overflow-hidden break-words text-[15px] leading-6 [overflow-wrap:anywhere]">
      <Markdown remarkPlugins={[remarkGfm]} components={tone === "dark" ? DARK : LIGHT}>
        {source}
      </Markdown>
    </div>
  );
}
