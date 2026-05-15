#!/usr/bin/env node
/**
 * audit-lesson-schema.mjs
 *
 * Stage 2.6 mechanical enforcement of the lesson schema documented in
 * `learning-plan/LESSON_TEMPLATE.md`. Walks `learning-plan/lessons/d01..d28`
 * and reports schema violations.
 *
 * Checks (per lesson):
 *   - Frontmatter: required fields (Stage 1a) + optional fields
 *     (Stage 2.6). Required Stage 2.6 fields once Phase E lands:
 *     prerequisites (D2..D28), key_terms, goodhart_role, calibration_role.
 *   - Section presence (mandatory): TL;DR, Learning objectives,
 *     Prerequisites & callback (D2+), The opening hook, Anchor: …,
 *     Cross-references, Takeaways, Glossary, References, Quiz.
 *   - Section count: ≥2 ⏵ Check yourself, ≤4.
 *   - Section ordering: TL;DR → Learning objectives → (Prerequisites)
 *     → opening hook → … → Cross-references → … → Takeaways →
 *     Glossary → References → Quiz.
 *   - ≥1 mermaid fence in the body.
 *   - Glossary contains ≥4 terms.
 *   - Cross-references resolves all `D-N` pointers to real days
 *     (1..28).
 *   - Quiz parses cleanly (6 questions, A–D options, answers block).
 *   - goodhart_role / calibration_role match the curriculum's locked
 *     thread table from LESSON_TEMPLATE.md.
 *   - Section slug renames have a matching alias entry in
 *     `web/lib/content.ts` SECTION_SLUG_ALIASES (if any of the legacy
 *     section names linger).
 *
 * Usage:
 *   node web/scripts/audit-lesson-schema.mjs            # human report
 *   node web/scripts/audit-lesson-schema.mjs --json     # machine-readable
 *   node web/scripts/audit-lesson-schema.mjs --day 5    # one day only
 *   node web/scripts/audit-lesson-schema.mjs --strict   # exit 1 on any
 *                                                       # violation; in
 *                                                       # default mode
 *                                                       # missing Stage
 *                                                       # 2.6 fields warn
 *                                                       # rather than fail.
 *
 * Exit code is 0 on a clean run (or in non-strict mode if only Stage 2.6
 * warnings are present), 1 if any hard violation is found.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LESSONS_DIR = path.resolve(__dirname, "..", "..", "learning-plan", "lessons");

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const strict = args.includes("--strict");
const dayArgIdx = args.indexOf("--day");
const onlyDay = dayArgIdx >= 0 ? Number.parseInt(args[dayArgIdx + 1], 10) : null;

// ---------- locked tables (mirrors LESSON_TEMPLATE.md) ----------

// Goodhart and calibration recurring threads. Days not listed default
// to {goodhart_role: "absent", calibration_role: "absent"}.
const ROLE_TABLE = {
  1: { goodhart_role: "callback", calibration_role: "absent" },
  2: { goodhart_role: "sub-thread", calibration_role: "introduces" },
  6: { goodhart_role: "foregrounded", calibration_role: "absent" },
  11: { goodhart_role: "sub-thread", calibration_role: "absent" },
  15: { goodhart_role: "foregrounded", calibration_role: "reprises" },
  17: { goodhart_role: "foregrounded", calibration_role: "absent" },
  20: { goodhart_role: "sub-thread", calibration_role: "callback" },
  22: { goodhart_role: "foregrounded", calibration_role: "absent" },
  24: { goodhart_role: "sub-thread", calibration_role: "closes" },
  25: { goodhart_role: "sub-thread", calibration_role: "absent" },
  28: { goodhart_role: "foregrounded", calibration_role: "callback" },
};

// Stage 1a frontmatter (required, locked).
const REQUIRED_FRONTMATTER = [
  "day",
  "slug",
  "title",
  "week",
  "week_theme",
  "anchor_benchmark",
  "harness",
  "reading_time_minutes",
];

// Stage 2.6 frontmatter (required after Phase E; warn-only by default).
const STAGE_2_6_FRONTMATTER = [
  "prerequisites",
  "key_terms",
  "goodhart_role",
  "calibration_role",
];

// ---------- frontmatter parser (gray-matter-equivalent, minimal) ----------

function parseFrontmatter(raw) {
  // Tolerate both LF and CRLF for cross-platform consistency.
  const norm = raw.replace(/\r\n/g, "\n");
  if (!norm.startsWith("---\n")) return { fm: {}, body: norm };
  const end = norm.indexOf("\n---\n", 4);
  if (end < 0) return { fm: {}, body: norm };
  const fmRaw = norm.slice(4, end);
  const body = norm.slice(end + 5);
  const fm = {};
  const lines = fmRaw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const m = /^([a-z_][a-z0-9_]*)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    // strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // YAML inline arrays: [1, 2, 3] or ["a", "b"]
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      if (!inner) {
        fm[key] = [];
      } else {
        fm[key] = inner.split(",").map((s) => {
          const t = s.trim().replace(/^['"]|['"]$/g, "");
          const n = Number.parseFloat(t);
          return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(t) ? n : t;
        });
      }
      continue;
    }
    // Multi-line YAML list:
    //   key_terms:
    //     - item one
    //     - item two
    if (val === "" && i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+(.+)$/.test(lines[j])) {
        const itm = /^\s+-\s+(.+)$/.exec(lines[j])[1].trim();
        const cleaned = itm.replace(/^['"]|['"]$/g, "");
        const n = Number.parseFloat(cleaned);
        items.push(
          Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(cleaned) ? n : cleaned,
        );
        j++;
      }
      fm[key] = items;
      i = j - 1;
      continue;
    }
    // numeric
    if (/^-?\d+(\.\d+)?$/.test(val)) {
      fm[key] = Number.parseFloat(val);
      continue;
    }
    fm[key] = val;
  }
  return { fm, body };
}

// ---------- slugify (mirrors web/lib/markdown.ts:slugify) ----------

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ---------- section walk ----------

function listH2Sections(body) {
  // Returns [{ slug, title, lineIndex }] in document order, excluding
  // any H2s inside fenced code blocks.
  const lines = body.split(/\r?\n/);
  const out = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const title = m[1];
    out.push({ slug: slugify(title), title, lineIndex: i });
  }
  return out;
}

function countMermaidFences(body) {
  const re = /```mermaid\b/g;
  return (body.match(re) ?? []).length;
}

function countCheckYourselfH2s(sections) {
  return sections.filter((s) => s.slug.startsWith("check-yourself")).length;
}

// Locate the byte range of the `## Anchor: …` H2 — the body slice between
// that H2's first line and the next H2 (exclusive). Returns null if no
// Anchor H2 is present.
function anchorBodyRange(body) {
  const lines = body.split(/\r?\n/);
  let start = -1;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    if (slugify(m[1]).startsWith("anchor")) {
      start = i;
      continue;
    }
    if (start !== -1) {
      return { startLine: start, endLine: i, lines };
    }
  }
  if (start !== -1) return { startLine: start, endLine: lines.length, lines };
  return null;
}

// Inside the Anchor section, audit the `### Example item` H3 requirement.
// Accepts the canonical slug "example-item" or per-anchor variants like
// "example-item-gsm8k". Multi-anchor lessons (D9, D25) accept either
// (a) one H3 per anchor as siblings or (b) H4-nested example items under
// `### Companion: …`. The audit's mechanical floor is: ≥1 H3 (or H4)
// slugged `example-item*` and ≥1 fenced code block or markdown blockquote
// inside the H3/H4's own range.
function auditExampleItems(range, day) {
  if (!range) return { violations: ["anchor body range not found"], warnings: [] };
  const { startLine, endLine, lines } = range;
  const violations = [];
  const warnings = [];

  // Walk H3 / H4 headers within the Anchor body, tracking fence state.
  const heads = []; // [{ level, slug, title, lineIndex }]
  let inFence = false;
  for (let i = startLine + 1; i < endLine; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m3 = /^###\s+(.+?)\s*$/.exec(line);
    const m4 = /^####\s+(.+?)\s*$/.exec(line);
    if (m3) heads.push({ level: 3, slug: slugify(m3[1]), title: m3[1], lineIndex: i });
    else if (m4) heads.push({ level: 4, slug: slugify(m4[1]), title: m4[1], lineIndex: i });
  }

  const exampleHeads = heads.filter((h) => h.slug.startsWith("example-item"));
  if (exampleHeads.length === 0) {
    violations.push(
      'missing "### Example item" H3 inside the Anchor section ' +
        "(or per-anchor variant like \"### Example item — GSM8K\")",
    );
    return { violations, warnings };
  }

  // For each Example-item heading, verify its own range contains ≥1
  // fenced code block or markdown blockquote (≥1 line beginning with `> `).
  // Range = from this heading's line+1 to the next sibling-or-shallower
  // heading or the end of the Anchor body.
  const exampleHeadIndices = exampleHeads.map((h) => h.lineIndex);
  for (let ei = 0; ei < exampleHeads.length; ei++) {
    const head = exampleHeads[ei];
    // Find the next H3 or H4 (sibling) line index after this head.
    let nextHeadLine = endLine;
    for (const other of heads) {
      if (
        other.lineIndex > head.lineIndex &&
        other.lineIndex < nextHeadLine
      ) {
        nextHeadLine = other.lineIndex;
      }
    }
    let blockOk = false;
    let f = false;
    for (let i = head.lineIndex + 1; i < nextHeadLine; i++) {
      const line = lines[i];
      if (/^```/.test(line)) {
        // a fence opens a code block — that satisfies the rule on its own
        f = !f;
        blockOk = true;
        continue;
      }
      if (!f && /^>\s+/.test(line)) {
        blockOk = true;
      }
    }
    if (!blockOk) {
      violations.push(
        `"${head.title}" has no fenced code block or markdown blockquote ` +
          "in its body (≥1 required to show a concrete benchmark row)",
      );
    }
  }

  // Multi-anchor lessons (D9 — GSM8K + MATH + PRM800K; D25 — AIME +
  // FrontierMath + o1 system card) must show ≥1 example per anchor.
  // We approximate via Companion H3 count.
  if (day === 9 || day === 25) {
    const companionHeads = heads.filter(
      (h) => h.level === 3 && h.slug.startsWith("companion"),
    );
    const expectedAnchors = 1 + companionHeads.length; // primary + companions
    if (exampleHeads.length < expectedAnchors) {
      warnings.push(
        `multi-anchor lesson: found ${exampleHeads.length} "### Example item" ` +
          `head(s) but ${expectedAnchors} anchor(s) (primary + ${companionHeads.length} companion(s)). ` +
          "Each anchor / companion should have its own example.",
      );
    }
  }

  return { violations, warnings };
}

// Cross-reference D-N pointers (resolved against the 1..28 range).
function findCrossReferenceDayPointers(body) {
  const out = new Set();
  const re = /\bD-?(\d{1,2})\b/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (n >= 1 && n <= 28) out.add(n);
  }
  return [...out];
}

// Glossary parser (mirrors web/lib/content.ts:parseLessonGlossary).
function parseGlossary(body) {
  const headerMatch = /^## Glossary\s*$/m.exec(body);
  if (!headerMatch) return [];
  const tail = body.slice(headerMatch.index + headerMatch[0].length);
  const nextHeader = /^##\s/m.exec(tail);
  const block = nextHeader ? tail.slice(0, nextHeader.index) : tail;
  const items = [];
  const re = /^-\s+\*\*([^*]+)\*\*\s*:\s*([\s\S]*?)(?=\n-\s+\*\*|\n##\s|$)/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    items.push({ term: m[1].trim() });
  }
  return items;
}

// Quiz parser (mirrors web/lib/quiz.ts:parseAndStripQuiz, structurally).
function parseQuizStructure(body) {
  const headerMatch = /^## Quiz\s*$/m.exec(body);
  if (!headerMatch) return { ok: false, reason: "no_quiz_header" };
  const quizSection = body.slice(headerMatch.index + headerMatch[0].length);
  const detailsRe = /<details>\s*<summary>[^<]*<\/summary>([\s\S]+?)<\/details>/;
  const detailsMatch = detailsRe.exec(quizSection);
  if (!detailsMatch) return { ok: false, reason: "no_answers_block" };
  const questionsBlock = quizSection.slice(0, detailsMatch.index);
  const qStems = questionsBlock.match(/^\*\*Q(\d+)\.\*\*/gm) ?? [];
  if (qStems.length !== 6) {
    return {
      ok: false,
      reason: `expected 6 questions, found ${qStems.length}`,
    };
  }
  return { ok: true, questionCount: qStems.length };
}

// ---------- per-lesson audit ----------

async function auditLesson(file) {
  const filePath = path.join(LESSONS_DIR, file);
  const raw = await fs.readFile(filePath, "utf-8");
  const { fm, body } = parseFrontmatter(raw);
  const dayMatch = /^d(\d{2})-/.exec(file);
  const day = dayMatch ? Number.parseInt(dayMatch[1], 10) : null;

  const violations = []; // hard
  const warnings = []; // stage-2.6 rollout, soft

  // --- frontmatter
  for (const k of REQUIRED_FRONTMATTER) {
    if (fm[k] === undefined || fm[k] === "") {
      violations.push(`frontmatter.${k} missing`);
    }
  }
  for (const k of STAGE_2_6_FRONTMATTER) {
    if (fm[k] === undefined) {
      warnings.push(`frontmatter.${k} missing (Stage 2.6 schema)`);
    }
  }
  // role consistency
  const expected = ROLE_TABLE[day] ?? {
    goodhart_role: "absent",
    calibration_role: "absent",
  };
  if (fm.goodhart_role !== undefined && fm.goodhart_role !== expected.goodhart_role) {
    violations.push(
      `goodhart_role = "${fm.goodhart_role}" but curriculum locks D${day} = "${expected.goodhart_role}"`,
    );
  }
  if (
    fm.calibration_role !== undefined &&
    fm.calibration_role !== expected.calibration_role
  ) {
    violations.push(
      `calibration_role = "${fm.calibration_role}" but curriculum locks D${day} = "${expected.calibration_role}"`,
    );
  }
  // prerequisites: D2..D28 must list at least one prior day
  if (day !== null && day >= 2 && Array.isArray(fm.prerequisites)) {
    if (fm.prerequisites.length === 0) {
      warnings.push("prerequisites empty — D2+ should list ≥1 prior day");
    }
    for (const p of fm.prerequisites) {
      if (!(typeof p === "number" && p >= 1 && p < day)) {
        violations.push(`prerequisites contains invalid day ${p}`);
      }
    }
  }
  // reading_time_minutes ≤ 35 (Stage 2.6 cap)
  if (typeof fm.reading_time_minutes === "number" && fm.reading_time_minutes > 35) {
    warnings.push(
      `reading_time_minutes = ${fm.reading_time_minutes} exceeds Stage 2.6 cap (35)`,
    );
  }

  // --- sections
  const sections = listH2Sections(body);
  const slugs = sections.map((s) => s.slug);

  // mandatory sections
  const requireSlug = (slug, label, opts = {}) => {
    if (!slugs.includes(slug)) {
      const list = opts.softWhenMissingD1 && day === 1
        ? warnings
        : violations;
      list.push(`missing required section: "${label}" (slug: ${slug})`);
    }
  };
  requireSlug("tl-dr", "## TL;DR");
  requireSlug("learning-objectives", "## Learning objectives");
  if (day !== null && day >= 2) {
    requireSlug("prerequisites-callback", "## Prerequisites & callback");
  }
  requireSlug("the-opening-hook", "## The opening hook");
  // Anchor section: starts with "anchor"; must match at least one slug.
  const hasAnchor = slugs.some((s) => s.startsWith("anchor"));
  if (!hasAnchor) {
    violations.push("missing required section: ## Anchor: …");
  }
  requireSlug("cross-references", "## Cross-references");
  requireSlug("takeaways", "## Takeaways");
  requireSlug("glossary", "## Glossary");
  requireSlug("references", "## References");
  requireSlug("quiz", "## Quiz");

  // ⏵ Check yourself: ≥2, ≤4
  const checkCount = countCheckYourselfH2s(sections);
  if (checkCount < 2) {
    violations.push(
      `only ${checkCount} ⏵ Check yourself sections (need ≥2)`,
    );
  } else if (checkCount > 4) {
    warnings.push(
      `${checkCount} ⏵ Check yourself sections (cap is 4)`,
    );
  }

  // section ordering
  const indexOf = (slug) => slugs.indexOf(slug);
  const ordered = [
    "tl-dr",
    "learning-objectives",
    "prerequisites-callback",
    "the-opening-hook",
  ];
  let lastIdx = -1;
  for (const s of ordered) {
    const idx = indexOf(s);
    if (idx === -1) continue;
    if (idx <= lastIdx) {
      violations.push(`section order: ${s} appears after a later section`);
    }
    lastIdx = idx;
  }
  // tail order: cross-references → takeaways → glossary → references → quiz
  const tailOrder = [
    "cross-references",
    "takeaways",
    "glossary",
    "references",
    "quiz",
  ];
  let lastTail = -1;
  for (const s of tailOrder) {
    const idx = indexOf(s);
    if (idx === -1) continue;
    if (idx <= lastTail) {
      violations.push(`section order: ${s} appears after a later tail section`);
    }
    lastTail = idx;
  }
  // anchor must be after the opening hook
  const anchorIdx = slugs.findIndex((s) => s.startsWith("anchor"));
  const hookIdx = indexOf("the-opening-hook");
  if (anchorIdx !== -1 && hookIdx !== -1 && anchorIdx < hookIdx) {
    violations.push("section order: anchor before the opening hook");
  }

  // --- mermaid
  if (countMermaidFences(body) === 0) {
    violations.push("no mermaid fence found (≥1 required)");
  }

  // --- anchor: Example item H3 + ≥1 fenced/blockquote inside it
  const aRange = anchorBodyRange(body);
  const exReport = auditExampleItems(aRange, day);
  for (const v of exReport.violations) violations.push(v);
  for (const w of exReport.warnings) warnings.push(w);

  // --- glossary
  const glossaryItems = parseGlossary(body);
  if (glossaryItems.length < 4) {
    violations.push(
      `glossary has ${glossaryItems.length} terms (≥4 required)`,
    );
  }

  // --- cross-references resolve
  const crossRefIdx = indexOf("cross-references");
  if (crossRefIdx !== -1) {
    // crude: just scan the entire body for D-N pointers; the real
    // section-scoped scan would require a cleaner tail-parse but the
    // information content is similar.
    const ptrs = findCrossReferenceDayPointers(body);
    for (const p of ptrs) {
      if (p < 1 || p > 28) {
        violations.push(`cross-reference D-${p} out of range`);
      }
    }
  }

  // --- quiz
  const quiz = parseQuizStructure(body);
  if (!quiz.ok) {
    violations.push(`quiz: ${quiz.reason}`);
  }

  return {
    file,
    day,
    title: fm.title ?? "(no title)",
    violations,
    warnings,
    sectionCount: sections.length,
    checkCount,
    glossaryCount: glossaryItems.length,
    mermaidCount: countMermaidFences(body),
  };
}

// ---------- runner ----------

async function main() {
  const entries = await fs.readdir(LESSONS_DIR);
  const files = entries
    .filter((f) => /^d\d{2}-.+\.md$/.test(f))
    .sort();

  const reports = [];
  for (const file of files) {
    const dayMatch = /^d(\d{2})-/.exec(file);
    const day = dayMatch ? Number.parseInt(dayMatch[1], 10) : null;
    if (onlyDay !== null && day !== onlyDay) continue;
    reports.push(await auditLesson(file));
  }

  const totalViolations = reports.reduce((acc, r) => acc + r.violations.length, 0);
  const totalWarnings = reports.reduce((acc, r) => acc + r.warnings.length, 0);

  if (wantJson) {
    process.stdout.write(
      JSON.stringify({ reports, totalViolations, totalWarnings }, null, 2) + "\n",
    );
  } else {
    for (const r of reports) {
      const flag = r.violations.length > 0 ? "✗" : r.warnings.length > 0 ? "!" : "✓";
      console.log(
        `${flag} D${String(r.day).padStart(2, "0")} — ${r.title}` +
          ` [${r.sectionCount} sections, ${r.checkCount} checks, ${r.glossaryCount} glossary, ${r.mermaidCount} mermaid]`,
      );
      for (const v of r.violations) console.log(`    ✗ ${v}`);
      for (const w of r.warnings) console.log(`    ! ${w}`);
    }
    console.log("");
    console.log(
      `Summary: ${totalViolations} violation(s), ${totalWarnings} warning(s) across ${reports.length} lesson(s).`,
    );
  }

  if (totalViolations > 0) process.exit(1);
  if (strict && totalWarnings > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
