#!/usr/bin/env node
/**
 * link-day-references.mjs
 *
 * One-shot transformation: rewrite every cross-day reference in
 * `learning-plan/lessons/d01..d28-*.md` to the uniform markdown-link
 * form `[D-N](/lesson/N)` where N ∈ 1..28.
 *
 * The script normalises three surface forms in *writable* regions:
 *   - "Day 12"   → "[D-12](/lesson/12)"
 *   - "D-12"     → "[D-12](/lesson/12)"
 *   - "D12"      → "[D-12](/lesson/12)"
 *
 * It also rewrites the glossary annotation specifically:
 *   - "[introduced D-1]"                    → "[introduced D-1](/lesson/1)"
 *   - "[introduced D-6 · reused]"           → "[introduced D-6 · reused](/lesson/6)"
 *   - "[introduced D-1 · used here]"        → "[introduced D-1 · used here](/lesson/1)"
 *
 * Protected regions (never rewritten):
 *   - YAML frontmatter at the top of the file (between leading --- fences)
 *   - Fenced code blocks (``` ... ```), including mermaid fences
 *   - Inline code spans (`...`)
 *   - Block math ($$ ... $$) and inline math ($...$)
 *   - The body of any existing markdown link "[...](...)" — only the
 *     visible label is examined, never the URL; and a label that
 *     already reads exactly "D-N" pointing at "/lesson/N" is skipped
 *     (idempotency).
 *
 * LF line endings are preserved (per AGENTS.md Windows note).
 *
 * Usage:
 *   node web/scripts/link-day-references.mjs --check        # dry run
 *   node web/scripts/link-day-references.mjs --day 1        # one file
 *   node web/scripts/link-day-references.mjs                # rewrite all
 *   node web/scripts/link-day-references.mjs --check --day 1
 *
 * Exit code 0 on success; 1 if a file would change under --check.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LESSONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "learning-plan",
  "lessons",
);

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const dayArgIdx = args.indexOf("--day");
const onlyDay =
  dayArgIdx >= 0 ? Number.parseInt(args[dayArgIdx + 1], 10) : null;

// ---------- region splitter ----------

/**
 * Walk the body and partition into an ordered list of segments, each
 * either { kind: "writable", text } or { kind: "protected", text }.
 * Only writable segments get the link rewrite.
 *
 * The walker is a single pass with hand-rolled state, because the
 * protected regions overlap with markdown-link-label parsing and a
 * naive regex pipeline produces double-rewrites at the boundaries
 * (e.g. inline math inside a `## Heading` line, fenced code inside a
 * ⏵ Check yourself <details> block).
 */
function partition(body) {
  const segments = [];
  let buf = "";
  let i = 0;
  const flush = (kind) => {
    if (buf.length > 0) {
      segments.push({ kind, text: buf });
      buf = "";
    }
  };
  const n = body.length;

  while (i < n) {
    const rest = body.slice(i);

    // Fenced code block: ```lang\n...\n```
    // Matches at line start. Closing fence is ``` at line start.
    if (
      (i === 0 || body[i - 1] === "\n") &&
      rest.startsWith("```")
    ) {
      flush("writable");
      // capture the entire fence including trailing newline if present
      const closeIdx = body.indexOf("\n```", i + 3);
      let end;
      if (closeIdx === -1) {
        end = n;
      } else {
        // include the closing ``` and the newline after it (if any)
        end = closeIdx + 4;
        if (end < n && body[end] === "\n") end += 1;
      }
      segments.push({ kind: "protected", text: body.slice(i, end) });
      i = end;
      continue;
    }

    // Block math: $$ ... $$ (multi-line allowed)
    if (rest.startsWith("$$")) {
      flush("writable");
      const close = body.indexOf("$$", i + 2);
      const end = close === -1 ? n : close + 2;
      segments.push({ kind: "protected", text: body.slice(i, end) });
      i = end;
      continue;
    }

    // Inline math: $...$ (single-line, non-empty body)
    // Avoid matching $ at end-of-line or as a currency sign by requiring
    // a non-whitespace char immediately after the opening $ and a non-
    // whitespace char immediately before the closing $.
    if (
      body[i] === "$" &&
      i + 1 < n &&
      body[i + 1] !== "$" &&
      body[i + 1] !== " " &&
      body[i + 1] !== "\n" &&
      body[i + 1] !== "\t"
    ) {
      // search for closing $ on same line that isn't escaped
      let j = i + 1;
      let found = -1;
      while (j < n) {
        const c = body[j];
        if (c === "\n") break;
        if (c === "$" && body[j - 1] !== "\\") {
          found = j;
          break;
        }
        j += 1;
      }
      if (found !== -1 && found > i + 1) {
        // require non-space before the closing $
        if (body[found - 1] !== " " && body[found - 1] !== "\t") {
          flush("writable");
          segments.push({
            kind: "protected",
            text: body.slice(i, found + 1),
          });
          i = found + 1;
          continue;
        }
      }
    }

    // Inline code: `...` (single backtick spans only; the fenced case is
    // handled above so a triple-backtick line will never reach here).
    if (body[i] === "`") {
      const close = body.indexOf("`", i + 1);
      if (close !== -1) {
        flush("writable");
        segments.push({
          kind: "protected",
          text: body.slice(i, close + 1),
        });
        i = close + 1;
        continue;
      }
    }

    // H1 title line: "# Day N — Title" — protect the entire line because
    // the day number is the lesson's own identifier, not a cross-ref.
    // Only fires at start-of-line and only for the top-level "# " H1
    // (not "## " or deeper). Matches both "Day N" and "DN" forms.
    if (
      body[i] === "#" &&
      (i === 0 || body[i - 1] === "\n") &&
      body[i + 1] === " " &&
      /^#\s+(Day\s+|D[-\u2011]?)\d{1,2}\b/.test(rest)
    ) {
      flush("writable");
      const eol = body.indexOf("\n", i);
      const end = eol === -1 ? n : eol + 1;
      segments.push({ kind: "protected", text: body.slice(i, end) });
      i = end;
      continue;
    }

    // Existing markdown links: "[label](url)" — protect the entire
    // unit (both label and url) so that idempotent re-runs don't
    // double-wrap "[D-12](/lesson/12)" labels, and so that arbitrary
    // link labels (e.g. citation text) are never mutated. This must
    // run before the bracket-only and URL-only protectors below; the
    // glossary post-pass on the recombined body still wraps bare
    // "[introduced D-N …]" annotations because they have no "(".
    if (body[i] === "[") {
      const closeBracket = body.indexOf("]", i + 1);
      if (
        closeBracket !== -1 &&
        body[closeBracket + 1] === "("
      ) {
        const closeParen = body.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          flush("writable");
          segments.push({
            kind: "protected",
            text: body.slice(i, closeParen + 1),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Glossary annotation: "[introduced D-N · …]" — protect the whole
    // bracketed unit so the writable-token pass doesn't rewrite the
    // inner "D-N" to "[D-N](/lesson/N)" and produce nested brackets.
    // The glossary post-pass (rewriteGlossary, applied to the recombined
    // body) wraps these annotations with "(/lesson/N)".
    if (
      body[i] === "[" &&
      /^\[introduced\s+D-\d{1,2}[^\]]*\](?!\()/.test(rest)
    ) {
      flush("writable");
      const close = body.indexOf("]", i + 1);
      const end = close + 1;
      segments.push({ kind: "protected", text: body.slice(i, end) });
      i = end;
      continue;
    }

    buf += body[i];
    i += 1;
  }
  flush("writable");
  return segments;
}

// ---------- writable-segment rewriter ----------

/**
 * Rewrite "Day N", "D-N", and "DN" tokens in a writable segment to
 * "[D-N](/lesson/N)" when N ∈ 1..28. Tokens inside existing markdown
 * links and glossary annotations are already in protected segments
 * (see partition()) so no per-token idempotency check is needed here.
 *
 * The regex is anchored at word boundaries so that "D1" matches but
 * "Day1" (no space) and "AID-1" do not. The first capture is the
 * surface form, the second is the day number string.
 */
const TOKEN_RE = /\b(Day\s+|D[-\u2011]?)(\d{1,2})\b/g;

function rewriteWritable(text) {
  return text.replace(TOKEN_RE, (match, prefix, numStr) => {
    const n = Number.parseInt(numStr, 10);
    if (!Number.isInteger(n) || n < 1 || n > 28) return match;
    return `[D-${n}](/lesson/${n})`;
  });
}

// ---------- glossary-annotation pass ----------

/**
 * After the writable-segment rewrite, also rewrite the bare
 * "[introduced D-N]" / "[introduced D-N · reused]" annotations into
 * proper markdown links pointing at /lesson/N. This runs on the *whole
 * file* (after segment-recombine) because the annotation crosses the
 * "]" boundary that partition() treats as a label/url split.
 *
 * Idempotency: skip if the annotation is already followed by
 * "(/lesson/N)".
 */
const GLOSSARY_RE = /\[introduced D-(\d{1,2})([^\]]*)\](?!\()/g;

function rewriteGlossary(text) {
  return text.replace(GLOSSARY_RE, (match, numStr, suffix) => {
    const n = Number.parseInt(numStr, 10);
    if (!Number.isInteger(n) || n < 1 || n > 28) return match;
    // suffix may include " · reused", " · used here", " · …" etc.
    return `[introduced D-${n}${suffix}](/lesson/${n})`;
  });
}

// ---------- top-level transform ----------

function transformBody(body) {
  // Split off the YAML frontmatter so the prerequisites list and other
  // structured fields are never touched.
  let frontmatter = "";
  let rest = body;
  if (body.startsWith("---\n")) {
    const close = body.indexOf("\n---\n", 4);
    if (close !== -1) {
      frontmatter = body.slice(0, close + 5);
      rest = body.slice(close + 5);
    }
  }

  const segments = partition(rest);
  const rewritten = segments
    .map((seg) =>
      seg.kind === "writable" ? rewriteWritable(seg.text) : seg.text,
    )
    .join("");

  // Glossary-annotation pass on the recombined body.
  const final = rewriteGlossary(rewritten);

  return frontmatter + final;
}

// ---------- driver ----------

async function listLessonFiles() {
  const entries = await fs.readdir(LESSONS_DIR);
  return entries
    .filter((f) => /^d\d{2}-.+\.md$/.test(f))
    .sort()
    .map((f) => ({
      file: f,
      day: Number.parseInt(f.slice(1, 3), 10),
    }));
}

async function run() {
  const files = await listLessonFiles();
  const target = onlyDay
    ? files.filter((f) => f.day === onlyDay)
    : files;
  if (target.length === 0) {
    console.error(
      onlyDay
        ? `no lesson file found for --day ${onlyDay}`
        : "no lesson files found",
    );
    process.exit(2);
  }

  let changedCount = 0;
  for (const { file, day } of target) {
    const fullPath = path.join(LESSONS_DIR, file);
    // Read with utf8; preserve original line endings by detecting CRLF.
    const original = await fs.readFile(fullPath, "utf-8");
    const usesCrlf = original.includes("\r\n");
    const normalised = usesCrlf
      ? original.replace(/\r\n/g, "\n")
      : original;
    const transformed = transformBody(normalised);

    if (transformed === normalised) {
      console.log(`D-${day}: no changes`);
      continue;
    }

    changedCount += 1;
    // Always emit LF on write, per AGENTS.md Windows note.
    if (checkOnly) {
      // Report a small per-file diff summary (count of new links).
      const newLinks =
        (transformed.match(/\]\(\/lesson\/\d+\)/g) || []).length -
        (normalised.match(/\]\(\/lesson\/\d+\)/g) || []).length;
      console.log(
        `D-${day}: would add ${newLinks} day-link${newLinks === 1 ? "" : "s"}`,
      );
    } else {
      await fs.writeFile(fullPath, transformed, "utf-8");
      const newLinks =
        (transformed.match(/\]\(\/lesson\/\d+\)/g) || []).length -
        (normalised.match(/\]\(\/lesson\/\d+\)/g) || []).length;
      console.log(
        `D-${day}: wrote ${newLinks} new day-link${newLinks === 1 ? "" : "s"}`,
      );
    }
  }

  if (checkOnly && changedCount > 0) {
    console.log(`\n${changedCount} file(s) would change`);
    process.exit(1);
  }
  if (!checkOnly) {
    console.log(`\n${changedCount} file(s) rewritten`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
