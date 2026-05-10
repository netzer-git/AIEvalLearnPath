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
import type { Element, ElementContent, Root, Text } from "hast";

/**
 * Slug derived from H2 text content. Used as a stable per-section ID
 * for completion tracking (server-side route + storage key).
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

type Walkable = { type?: string; value?: string; children?: unknown[] };
function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Walkable;
  if (n.type === "text" && typeof n.value === "string") return n.value;
  if (Array.isArray(n.children)) {
    return n.children.map(nodeText).join("");
  }
  return "";
}

/**
 * Wrap each H2 + everything until the next H2 in a <details> element so
 * sections can collapse natively, with a slug-bearing button in the
 * summary for per-section completion tracking. The summary contains the
 * original H2 (so h2 styling still applies) plus a `.section-check`
 * button that the client-side SectionTracker hooks into.
 *
 * Content before the first H2 (e.g. the lesson body's H1) stays at the
 * top-level — it's not wrapped.
 */
const rehypeWrapSections: Plugin<[], Root> = () => {
  return (tree) => {
    if (tree.type !== "root") return;
    const out: ElementContent[] = [];
    let currentSection: Element | null = null;
    let buffer: ElementContent[] = [];

    const flush = () => {
      if (currentSection) {
        currentSection.children = [...currentSection.children, ...buffer];
        out.push(currentSection);
        currentSection = null;
        buffer = [];
      }
    };

    for (const child of tree.children) {
      if (
        child.type === "element" &&
        (child as Element).tagName === "h2"
      ) {
        flush();
        const h2 = child as Element;
        const slug = slugify(nodeText(h2));
        currentSection = {
          type: "element",
          tagName: "details",
          properties: {
            className: ["lesson-section"],
            "data-section-slug": slug,
            open: true,
          },
          children: [
            {
              type: "element",
              tagName: "summary",
              properties: { className: ["lesson-section-summary"] },
              children: [
                {
                  type: "element",
                  tagName: "h2",
                  properties: { ...(h2.properties || {}) },
                  children: h2.children,
                },
                {
                  type: "element",
                  tagName: "span",
                  properties: { className: ["lesson-section-badge"] },
                  children: [{ type: "text", value: "read ✓" }],
                },
                {
                  type: "element",
                  tagName: "button",
                  properties: {
                    type: "button",
                    className: ["section-check"],
                    "data-section-slug": slug,
                    "aria-label": "Toggle section completion",
                  },
                  children: [],
                },
              ],
            },
          ],
        };
      } else if (currentSection) {
        buffer.push(child as ElementContent);
      } else {
        out.push(child as ElementContent);
      }
    }
    flush();

    // After all sections are assembled, append a "Mark section read"
    // footer button to each one. We do this in a second pass so the
    // button lands at the very end of each section's child list — the
    // primary forward-flow action a reader takes when they finish a
    // section. The summary's `.section-check` (added above) stays as
    // the badge + un-mark toggle.
    for (const node of out) {
      if (
        node.type !== "element" ||
        (node as Element).tagName !== "details"
      )
        continue;
      const detailsEl = node as Element;
      const props = detailsEl.properties as Record<string, unknown> | undefined;
      const slug = props?.["data-section-slug"];
      if (typeof slug !== "string") continue;
      const footer: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["section-footer"] },
        children: [
          {
            type: "element",
            tagName: "button",
            properties: {
              type: "button",
              className: ["section-mark-read"],
              "data-section-slug": slug,
              "aria-label": "Mark section as read",
            },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["section-mark-read-icon"] },
                children: [{ type: "text", value: "✓" }],
              },
              {
                type: "element",
                tagName: "span",
                properties: { className: ["section-mark-read-label"] },
                children: [{ type: "text", value: "Mark section read" }],
              },
            ],
          },
        ],
      };
      detailsEl.children = [...detailsEl.children, footer];
    }

    tree.children = out;
  };
};

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
    .use(rehypeWrapSections)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  return String(file);
}
