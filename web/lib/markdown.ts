import { unified, type Plugin } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Element, Root, Text } from "hast";

/**
 * Convert ```mermaid fenced blocks (rendered by remark-rehype as
 * <pre><code class="language-mermaid">…</code></pre>) into bare
 * <pre class="mermaid">…</pre> elements that the client-side mermaid
 * library can pick up via `mermaid.run({ querySelector: 'pre.mermaid' })`.
 *
 * Runs BEFORE rehype-pretty-code so the latter does not syntax-highlight
 * mermaid bodies. Replaces rehype-mermaid (which pulls in playwright via
 * mermaid-isomorphic at module-load time, breaking Next.js builds).
 */
const rehypeMermaidPre: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const child = node.children[0];
      if (
        !child ||
        child.type !== "element" ||
        child.tagName !== "code"
      )
        return;
      const className = child.properties?.className;
      const classes = Array.isArray(className) ? className : [];
      if (!classes.includes("language-mermaid")) return;
      const text = (child.children as Text[])
        .filter((c) => c.type === "text")
        .map((c) => c.value)
        .join("");
      node.properties = { className: ["mermaid"] };
      node.children = [{ type: "text", value: text }];
    });
  };
};

export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeMermaidPre)
    .use(rehypePrettyCode, {
      theme: "github-dark-default",
      keepBackground: false,
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  return String(file);
}
