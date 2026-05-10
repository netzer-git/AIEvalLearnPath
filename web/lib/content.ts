import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { markdownToHtml } from "./markdown";
import { parseAndStripQuiz, type Quiz } from "./quiz";

const LESSONS_DIR = path.resolve(process.cwd(), "..", "learning-plan", "lessons");

export type GoodhartRole =
  | "foregrounded"
  | "sub-thread"
  | "callback"
  | "absent";

export type CalibrationRole =
  | "introduces"
  | "reprises"
  | "callback"
  | "closes"
  | "absent";

export type LessonFrontmatter = {
  // --- Stage 1a (locked)
  day: number;
  slug: string;
  title: string;
  week: number;
  week_theme: string;
  anchor_benchmark: string;
  harness: string;
  reading_time_minutes: number;
  // --- Stage 2.6 (optional during rollout; required after Phase E)
  prerequisites?: number[];
  key_terms?: string[];
  goodhart_role?: GoodhartRole;
  calibration_role?: CalibrationRole;
};

export type Lesson = {
  frontmatter: LessonFrontmatter;
  html: string;
  quiz: Quiz | null;
};

export type LessonSummary = Pick<
  LessonFrontmatter,
  | "day"
  | "slug"
  | "title"
  | "week"
  | "week_theme"
  | "anchor_benchmark"
  | "reading_time_minutes"
  | "prerequisites"
  | "key_terms"
  | "goodhart_role"
  | "calibration_role"
> & {
  /**
   * Count of collapsable lesson sections (H2s in the body, excluding
   * `## Quiz` which is stripped before rendering). Drives the
   * "M / N sections" indicator on the dashboard tile.
   */
  section_count: number;
};

/**
 * Section-slug stability table — Stage 2.6.
 *
 * H2 text is slugged by `rehypeWrapSections` in `markdown.ts` and
 * stored as the per-section completion key in `progress.json` on each
 * user's device. Renaming an H2 changes the slug and would otherwise
 * silently invalidate the user's section-completion records.
 *
 * The Stage 2.6 retrofit normalizes section names ("opening question"
 * → "the opening hook", "forward pointer" → "cross-references", etc.).
 * For each renamed H2, append the old → new mapping below so progress
 * APIs can resolve the legacy slug to the new canonical slug at read
 * time. The audit script (`scripts/audit-lesson-schema.mjs`) verifies
 * every renamed H2 in the curriculum has a matching alias entry.
 *
 * Entries are LEGACY → CANONICAL. Slugs are produced by
 * `slugify(text)` in `markdown.ts` (lowercase, NFD-stripped, non-
 * alphanumerics → "-", trimmed, length-capped at 80).
 */
export const SECTION_SLUG_ALIASES: Readonly<Record<string, string>> = {
  // opening-section variants → canonical "the-opening-hook"
  "the-opening-question": "the-opening-hook",
  "opening-question": "the-opening-hook",
  "week-2-opens": "the-opening-hook",
  // forward-pointer variants → canonical "cross-references"
  "forward-pointer": "cross-references",
  "forward-pointers": "cross-references",
  "forward-pointer-week-2-and-the-contamination-resistant-successor-pattern":
    "cross-references",
  "forward-pointer-d9-and-the-chain-of-thought-gap": "cross-references",
  "forward-pointer-d25-and-reasoning-models": "cross-references",
  "forward-pointer-d26-d28-and-the-cost-axis-everywhere": "cross-references",
  "forward-pointer-instruction-following-degradation-in-reasoning-models":
    "cross-references",
  "forward-pointer-long-context-safety-surface": "cross-references",
  "forward-pointer-wmdp-and-its-sibling-lessons": "cross-references",
  "forward-pointer-d24-rewardbench": "cross-references",
  "cross-references-and-forward-pointers": "cross-references",
  // Goodhart-section variants for foregrounded-role lessons
  // (each old slug appeared on exactly one lesson, so a global mapping
  // is unambiguous).
  "goodhart-on-d17-situational-conditioning-as-a-distinct-mechanism":
    "goodhart-foregrounded",
  "goodhart-foregrounded-the-measurement-instrument-as-target":
    "goodhart-foregrounded",
  "goodhart-foregrounded-incentive-structure-not-contamination":
    "goodhart-foregrounded",
  "goodhart-foregrounded-autonomy-measurement-as-selection-pressure":
    "goodhart-foregrounded",
  // Goodhart-sub-thread variants for sub-thread-role lessons.
  "the-goodhart-sub-thread-cost-axis-gaming": "goodhart-sub-thread",
  "goodhart-on-rlhf-the-canonical-case": "goodhart-sub-thread",
  // Calibration-section variants → canonical "calibration-{role}"
  "light-calibration-callback-d2-d20": "calibration-callback",
  "calibration-reprise-d2-d15": "calibration-reprises",
  "the-full-calibration-reprise-d2-d15-d20-d24": "calibration-closes-thread",
};

/**
 * Per-day section-slug aliases — for renames that map differently on
 * different lessons (i.e., the same legacy slug existed on multiple
 * lessons but the rewrite renamed to different canonical slugs).
 *
 * Format: { dayNumber: { legacy-slug: canonical-slug, ... }, ... }.
 *
 * `resolveSectionSlug(slug, day)` checks this map first, then falls
 * back to the global `SECTION_SLUG_ALIASES` table.
 *
 * Stage 2.6.
 */
export const SECTION_SLUG_ALIASES_BY_DAY: Readonly<
  Record<number, Readonly<Record<string, string>>>
> = {
  // D7: rewrite renamed the Goodhart sub-thread to a content-descriptive
  // name (locked goodhart_role: absent → no `## Goodhart …` H2).
  7: {
    "the-goodhart-sub-thread-why-benchmarks-die-faster-than-capability-grows":
      "why-benchmarks-die-faster-than-capability-grows",
  },
  // D13 and D27 both used `## Goodhart aside (brief)` pre-rewrite but
  // the rewrites named the new sections differently per their content.
  13: {
    "goodhart-aside-brief":
      "visual-prompt-injection-and-the-multimodal-jailbreak-surface",
    "goodhart-aside": "visual-prompt-injection-and-the-multimodal-jailbreak-surface",
  },
  16: {
    "goodhart-and-the-ood-persistence-problem": "out-of-distribution-persistence",
  },
  18: {
    "goodhart-sub-thread-rl-on-verifiable-instructions":
      "verifiable-rewards-and-reward-gaming",
  },
  19: {
    // Sub-agent already added a global entry; keep it here too for the
    // per-day priority resolution to be explicit.
    "goodhart-sub-thread-d6-reprise-applied-to-safety-evals":
      "when-attack-set-leakage-applies-to-safety-evals",
  },
  21: {
    "week-3-in-review": "week-3-review",
    "week-4-handoff": "week-3-handoff",
  },
  26: {
    "the-goodhart-sub-thread-not-foregrounded-today":
      "reading-web-agent-numbers-across-papers",
  },
  27: {
    "goodhart-aside-brief": "os-agent-benchmark-fragility",
    "goodhart-aside": "os-agent-benchmark-fragility",
  },
};

/**
 * Resolve a section slug to its canonical form. Used by progress APIs
 * when reading per-section completion records, so legacy slugs (from
 * before the Stage 2.6 rename) still surface.
 *
 * Resolution order: per-day override (if `day` provided) → global
 * alias → input slug unchanged.
 */
export function resolveSectionSlug(slug: string, day?: number): string {
  if (day !== undefined) {
    const perDay = SECTION_SLUG_ALIASES_BY_DAY[day];
    if (perDay && slug in perDay) return perDay[slug];
  }
  return SECTION_SLUG_ALIASES[slug] ?? slug;
}

/**
 * Apply slug aliases to a `sections` map (one per day) so legacy keys
 * resolve to the post-Stage-2.6 canonical slugs. Used by `loadProgress`
 * so existing per-section completion data keeps working after the
 * curriculum-wide rewrite. New keys take precedence over migrated ones
 * if a collision occurs.
 */
export function migrateSectionSlugs(
  sections: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [dayKey, perDayMap] of Object.entries(sections)) {
    const dayNum = Number.parseInt(dayKey, 10);
    const migrated: Record<string, string> = {};
    for (const [legacySlug, ts] of Object.entries(perDayMap)) {
      const canonical = resolveSectionSlug(legacySlug, dayNum);
      // Newer (post-rewrite) entries win over migrated ones if both
      // exist. The data file is read-only at this stage; we don't
      // persist the migration, just present it through the API.
      if (!(canonical in migrated)) {
        migrated[canonical] = ts;
      }
    }
    out[dayKey] = migrated;
  }
  return out;
}

/**
 * Count of H2 sections that the lesson body actually renders, excluding
 * `## Quiz` (which `parseAndStripQuiz` removes before markdown→HTML).
 * Cheap regex over the raw markdown — no need to round-trip through
 * the full unified pipeline for a count.
 */
function countLessonSections(rawBody: string): number {
  const matches = rawBody.match(/^## (?!Quiz\s*$).+$/gm);
  return matches ? matches.length : 0;
}

async function listLessonFiles(): Promise<string[]> {
  const entries = await fs.readdir(LESSONS_DIR);
  return entries.filter((name) => /^d\d{2}-.+\.md$/.test(name)).sort();
}

export async function getAllLessonDays(): Promise<number[]> {
  const files = await listLessonFiles();
  return files.map((f) => Number.parseInt(f.slice(1, 3), 10));
}

export async function getAllLessonSummaries(): Promise<LessonSummary[]> {
  const files = await listLessonFiles();
  const summaries: LessonSummary[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(LESSONS_DIR, file), "utf-8");
    const { data, content } = matter(raw);
    const fm = data as LessonFrontmatter;
    summaries.push({
      day: fm.day,
      slug: fm.slug,
      title: fm.title,
      week: fm.week,
      week_theme: fm.week_theme,
      anchor_benchmark: fm.anchor_benchmark,
      reading_time_minutes: fm.reading_time_minutes,
      prerequisites: fm.prerequisites,
      key_terms: fm.key_terms,
      goodhart_role: fm.goodhart_role,
      calibration_role: fm.calibration_role,
      section_count: countLessonSections(content),
    });
  }
  return summaries;
}

export async function getLessonByDay(day: number): Promise<Lesson | null> {
  const files = await listLessonFiles();
  const dayPrefix = `d${String(day).padStart(2, "0")}-`;
  const file = files.find((f) => f.startsWith(dayPrefix));
  if (!file) return null;
  const raw = await fs.readFile(path.join(LESSONS_DIR, file), "utf-8");
  const { data, content } = matter(raw);
  const { bodyMarkdown, quiz } = parseAndStripQuiz(content);
  const html = await markdownToHtml(bodyMarkdown);
  return { frontmatter: data as LessonFrontmatter, html, quiz };
}

/**
 * One glossary entry as surfaced on the site-wide /glossary route.
 * `firstAppearanceDay` is the day where the term is *introduced*
 * (i.e. the first lesson markdown that lists it under `## Glossary`
 * without a `· reused` qualifier). Subsequent reuses are dropped so
 * the global page lists each term once.
 */
export type GlossaryEntry = {
  term: string;
  gloss: string;
  firstAppearanceDay: number;
  firstAppearanceSlug: string;
  firstAppearanceTitle: string;
};

const GLOSSARY_HEADER_RE = /^## Glossary\s*$/m;
const GLOSSARY_ITEM_RE =
  /^-\s+\*\*([^*]+)\*\*\s*:\s*([\s\S]*?)(?=\n-\s+\*\*|\n##\s|$)/gm;
const REUSED_MARKER_RE = /·\s*reused/i;

/**
 * Parse the `## Glossary` section of a lesson's raw markdown and
 * return its entries. Stops at the next `## ` heading.
 */
function parseLessonGlossary(rawBody: string): Array<{
  term: string;
  gloss: string;
  reused: boolean;
}> {
  const headerMatch = GLOSSARY_HEADER_RE.exec(rawBody);
  if (!headerMatch) return [];
  const tail = rawBody.slice(headerMatch.index + headerMatch[0].length);
  const nextHeader = /^##\s/m.exec(tail);
  const block = nextHeader ? tail.slice(0, nextHeader.index) : tail;
  const out: Array<{ term: string; gloss: string; reused: boolean }> = [];
  let m: RegExpExecArray | null;
  GLOSSARY_ITEM_RE.lastIndex = 0;
  while ((m = GLOSSARY_ITEM_RE.exec(block)) !== null) {
    const term = m[1].trim();
    const glossRaw = m[2].trim();
    const reused = REUSED_MARKER_RE.test(glossRaw);
    out.push({ term, gloss: glossRaw, reused });
  }
  return out;
}

/**
 * Aggregate all 28 lessons' `## Glossary` sections into a deduplicated,
 * alphabetized list. A term's "first appearance" is the lowest-numbered
 * day whose entry doesn't carry the `· reused` marker (or the lowest-
 * numbered day overall if every appearance is marked reused).
 */
export async function getGlossary(): Promise<GlossaryEntry[]> {
  const files = await listLessonFiles();
  const accum = new Map<
    string,
    {
      term: string;
      gloss: string;
      day: number;
      slug: string;
      title: string;
      seenIntroduction: boolean;
    }
  >();
  for (const file of files) {
    const raw = await fs.readFile(path.join(LESSONS_DIR, file), "utf-8");
    const { data, content } = matter(raw);
    const fm = data as LessonFrontmatter;
    const entries = parseLessonGlossary(content);
    for (const e of entries) {
      const key = e.term.toLowerCase();
      const existing = accum.get(key);
      if (!existing) {
        accum.set(key, {
          term: e.term,
          gloss: stripGlossMarkdown(e.gloss),
          day: fm.day,
          slug: fm.slug,
          title: fm.title,
          seenIntroduction: !e.reused,
        });
        continue;
      }
      // Prefer the first introduction over a subsequent reuse.
      if (!existing.seenIntroduction && !e.reused) {
        accum.set(key, {
          term: e.term,
          gloss: stripGlossMarkdown(e.gloss),
          day: fm.day,
          slug: fm.slug,
          title: fm.title,
          seenIntroduction: true,
        });
      }
    }
  }
  const list: GlossaryEntry[] = [];
  for (const v of accum.values()) {
    list.push({
      term: v.term,
      gloss: v.gloss,
      firstAppearanceDay: v.day,
      firstAppearanceSlug: v.slug,
      firstAppearanceTitle: v.title,
    });
  }
  list.sort((a, b) =>
    a.term.toLowerCase().localeCompare(b.term.toLowerCase()),
  );
  return list;
}

/**
 * Strip light markdown + the trailing `[introduced D-N · reused?]`
 * annotation so the glossary page can render plain text. Conservative:
 * flattens `**bold**`, `_em_`, and `[text](url)` links; backticks are
 * preserved for code-like terms inside the gloss.
 */
function stripGlossMarkdown(s: string): string {
  return s
    .replace(/\[introduced[^\]]*\]/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();
}
