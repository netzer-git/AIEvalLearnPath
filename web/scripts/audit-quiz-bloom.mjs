#!/usr/bin/env node
/**
 * audit-quiz-bloom.mjs
 *
 * Stage 2.6 heuristic audit of Bloom's-taxonomy coverage in lesson
 * quizzes. The goal is not classification accuracy on every item — that
 * needs a human eye — but a flag-only signal: if a lesson's 6 quiz
 * questions skip Apply (L3), Analyze (L4), or Evaluate (L5) entirely,
 * the lesson is over-weighted toward Recall/Understand and the audit
 * surfaces it.
 *
 * Heuristics (per question stem + explanation):
 *   - Apply (L3): stem contains computation cues ("compute", "what is",
 *     "calculate", "how many", "given … find", numbers + a formula in
 *     the explanation, or words like "approximately", "estimator").
 *   - Analyze (L4): stem contains decomposition cues ("which is the
 *     load-bearing", "primarily because", "best explains why",
 *     "structurally", "compare", "contrast", "decompose", "the
 *     mechanism is").
 *   - Evaluate (L5): stem contains judgment cues ("most defensible
 *     reading", "right reflex", "best critique", "most appropriate
 *     interpretation", "is the best read", "is supported", "is *not*
 *     evidence", "right takeaway", or any "which is the most …").
 *   - Otherwise: Understand (L2) by default.
 *
 * The audit flags a lesson if it has 0 questions in any of L3, L4, or
 * L5. Coverage of L2 is not flagged — every lesson has plenty.
 *
 * Usage:
 *   node web/scripts/audit-quiz-bloom.mjs            # human report
 *   node web/scripts/audit-quiz-bloom.mjs --json     # machine-readable
 *   node web/scripts/audit-quiz-bloom.mjs --day 5    # one day only
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LESSONS_DIR = path.resolve(__dirname, "..", "..", "learning-plan", "lessons");

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const dayArgIdx = args.indexOf("--day");
const onlyDay = dayArgIdx >= 0 ? Number.parseInt(args[dayArgIdx + 1], 10) : null;

// ---------- patterns ----------

const APPLY_PATTERNS = [
  /\bcompute\b/i,
  /\bcalculate\b/i,
  /\bwhat is the (approximate|expected|unbiased) /i,
  /\bhow many\b/i,
  /\bwhat are the\b/i,
  /\bgiven\b[\s\S]{0,80}\bfind\b/i,
  /\b(estimate|estimator)\b/i,
  /\bunder the (standard|published|original) /i,
  /\bwhat is the\b[\s\S]{0,80}\b(score|gap|interval|CI|probability|rating|update)\b/i,
  /\bwhat is\b[\s\S]{0,40}\bs_/i, // BBQ s_DIS, s_AMB
  /\bcons@\d+\b/i,
  /\bpass@\d+\b/i,
  /\bL_{?\d/i, // L_50, L_80
];

const ANALYZE_PATTERNS = [
  /\bload-bearing\b/i,
  /\bprimarily because\b/i,
  /\bprimarily in\b/i,
  /\b(best|most accurate|most precise) (description|description of|critique|statement|diagnosis)\b/i,
  /\bbest explains\b/i,
  /\bclearest single demonstration\b/i,
  /\bclearest reason\b/i,
  /\bstructural difference\b/i,
  /\bstructurally\b/i,
  /\bcompare\b/i,
  /\bcontrast\b/i,
  /\bdecompose\b/i,
  /\bthe mechanism is\b/i,
  /\bhow does\b/i,
  /\bwhich is the operational definition\b/i,
  /\bdefining (construction|design) property\b/i,
  /\bwhich.*best.*statement of\b/i,
  /\bwhich.*best.*captures\b/i,
];

const EVALUATE_PATTERNS = [
  /\bmost defensible (reading|read)\b/i,
  /\bright reflex\b/i,
  /\bright reading\b/i,
  /\bright takeaway\b/i,
  /\bbest read\b/i,
  /\bbest reading\b/i,
  /\bbest critique\b/i,
  /\bmost appropriate (under|interpretation)\b/i,
  /\bnot necessarily evidence\b/i,
  /\bnot \*?\*?evidence\b/i,
  /\bleast supported\b/i,
  /\bmost informative\b/i,
  /\b\*?\*?most\*?\*? consistent with\b/i,
  /\b\*?\*?most\*?\*? supported\b/i,
  /\bdefensible\b/i,
];

function classify(stem, explanation) {
  const probe = `${stem} ${explanation}`;
  if (EVALUATE_PATTERNS.some((re) => re.test(probe))) return "L5";
  if (ANALYZE_PATTERNS.some((re) => re.test(probe))) return "L4";
  if (APPLY_PATTERNS.some((re) => re.test(probe))) return "L3";
  return "L2";
}

// ---------- quiz parser (mirrors web/lib/quiz.ts shape) ----------

const QUIZ_HEADER_RE = /^## Quiz\s*$/m;

function parseQuiz(markdown) {
  const headerMatch = QUIZ_HEADER_RE.exec(markdown);
  if (!headerMatch) return null;
  const quizSection = markdown.slice(headerMatch.index + headerMatch[0].length);
  const detailsRe = /<details>\s*<summary>[^<]*<\/summary>([\s\S]+?)<\/details>/;
  const detailsMatch = detailsRe.exec(quizSection);
  if (!detailsMatch) return null;
  const answersBlock = detailsMatch[1].trim();
  const questionsBlock = quizSection.slice(0, detailsMatch.index).trim();

  // ---- questions: split on "**Q\d+.**"
  const stems = [];
  const stemRe = /\*\*Q(\d+)\.\*\*\s*([\s\S]+?)(?=(?:\n\n\*\*Q\d+\.\*\*)|\n\n<details>|$)/g;
  let m;
  while ((m = stemRe.exec(questionsBlock)) !== null) {
    stems.push({ n: Number.parseInt(m[1], 10), text: m[2].trim() });
  }

  // ---- answers: each "N. **L** — explanation"
  const answers = {};
  const answerChunks = answersBlock.split(/\n(?=\d+\.\s+\*\*[A-D]\*\*)/);
  for (const chunk of answerChunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const am = /^(\d+)\.\s+\*\*([A-D])\*\*\s*[—–-]?\s*([\s\S]*)$/.exec(trimmed);
    if (!am) continue;
    answers[Number.parseInt(am[1], 10)] = {
      letter: am[2],
      explanation: am[3].trim(),
    };
  }

  return { stems, answers };
}

// ---------- per-lesson audit ----------

async function auditLesson(file) {
  const filePath = path.join(LESSONS_DIR, file);
  const raw = await fs.readFile(filePath, "utf-8");
  const dayMatch = /^d(\d{2})-/.exec(file);
  const day = dayMatch ? Number.parseInt(dayMatch[1], 10) : null;
  const titleMatch = /^title:\s*"?([^"\n]+)"?\s*$/m.exec(raw);
  const title = titleMatch ? titleMatch[1] : "(no title)";

  const quiz = parseQuiz(raw);
  if (!quiz) {
    return {
      file,
      day,
      title,
      ok: false,
      reason: "no_parsable_quiz",
      classifications: [],
      mix: { L2: 0, L3: 0, L4: 0, L5: 0 },
      missing: [],
    };
  }

  const classifications = [];
  for (const s of quiz.stems) {
    const ans = quiz.answers[s.n];
    const explanation = ans?.explanation ?? "";
    const level = classify(s.text, explanation);
    classifications.push({ n: s.n, level });
  }

  const mix = { L2: 0, L3: 0, L4: 0, L5: 0 };
  for (const c of classifications) mix[c.level]++;
  const missing = [];
  if (mix.L3 === 0) missing.push("L3 Apply");
  if (mix.L4 === 0) missing.push("L4 Analyze");
  if (mix.L5 === 0) missing.push("L5 Evaluate");

  return {
    file,
    day,
    title,
    ok: true,
    classifications,
    mix,
    missing,
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

  let totalFlagged = 0;
  for (const r of reports) {
    if (!r.ok || r.missing.length > 0) totalFlagged++;
  }

  if (wantJson) {
    process.stdout.write(JSON.stringify({ reports, totalFlagged }, null, 2) + "\n");
  } else {
    for (const r of reports) {
      const flag = r.ok && r.missing.length === 0 ? "✓" : "!";
      const mix = r.mix
        ? `L2:${r.mix.L2} L3:${r.mix.L3} L4:${r.mix.L4} L5:${r.mix.L5}`
        : "(no quiz)";
      console.log(
        `${flag} D${String(r.day).padStart(2, "0")} — ${r.title}` +
          `  [${mix}]` +
          (r.missing && r.missing.length
            ? `  missing: ${r.missing.join(", ")}`
            : ""),
      );
      if (r.classifications) {
        for (const c of r.classifications) {
          // surface low-confidence classifications by showing all
          // questions in compact form
          // (no per-Q explanation in default mode; use --json for raw)
        }
      }
      if (!r.ok) console.log(`    ✗ ${r.reason}`);
    }
    console.log("");
    console.log(
      `Summary: ${totalFlagged} lesson(s) flagged (missing L3/L4/L5 coverage) of ${reports.length}.`,
    );
  }

  // exit 0 — Bloom audit is informational; sub-agents read it as guidance
  // for stem rephrasing. Strict mode could be added later.
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
