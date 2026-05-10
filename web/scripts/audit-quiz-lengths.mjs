#!/usr/bin/env node
/**
 * audit-quiz-lengths.mjs
 *
 * One-shot + maintenance auditor for the longest-answer-is-correct
 * distractor bias across learning-plan/lessons/d01..d28.
 *
 * Parses each lesson's ## Quiz section using the same shape that
 * web/lib/quiz.ts's parseAndStripQuiz uses (split on **Q\d+.**, then
 * options "- A.", "- B.", ..., then a <details>…</details> answers
 * block with "N. **L** — explanation").
 *
 * For each question we compute:
 *   - char length of each option's text (markdown stripped lightly)
 *   - which option is the correct one
 *   - "bias ratio" = len(correct) / mean(len(distractors))
 *
 * A question is FLAGGED when bias ratio >= 1.4 — i.e. the correct
 * option is at least 40% longer on average than its distractors.
 *
 * Usage:
 *   node web/scripts/audit-quiz-lengths.mjs           # human report
 *   node web/scripts/audit-quiz-lengths.mjs --json    # machine-readable
 *   node web/scripts/audit-quiz-lengths.mjs --day 5   # one day only
 *   node web/scripts/audit-quiz-lengths.mjs --flagged # only flagged Qs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LESSONS_DIR = path.resolve(__dirname, "..", "..", "learning-plan", "lessons");

const FLAG_THRESHOLD = 1.4;

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const onlyFlagged = args.includes("--flagged");
const dayArgIdx = args.indexOf("--day");
const onlyDay = dayArgIdx >= 0 ? Number.parseInt(args[dayArgIdx + 1], 10) : null;

// ---------- markdown-light length normalization ----------
// We measure visible-character length, not raw markdown length.
// Strip inline code backticks, bold/italic markers, link syntax, math
// delimiters, but preserve inner content (so $\log P$ counts as "log P",
// not as "$\log P$").
function visibleLength(md) {
  let s = md;
  // links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // images: ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  // inline code: `x` -> x
  s = s.replace(/`([^`]+)`/g, "$1");
  // bold/italic: **x**, *x*, __x__, _x_
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1$2");
  // math: $...$, $$...$$
  s = s.replace(/\$\$([^$]+)\$\$/g, "$1");
  s = s.replace(/\$([^$]+)\$/g, "$1");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s.length;
}

// ---------- parser (mirrors web/lib/quiz.ts shape) ----------
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

  // answers: split on lookahead "N. **L**"
  const answers = {};
  const answerChunks = answersBlock.split(/\n(?=\d+\.\s+\*\*[A-D]\*\*)/);
  for (const chunk of answerChunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const m = /^(\d+)\.\s+\*\*([A-D])\*\*\s*[—–-]?\s*([\s\S]*)$/.exec(trimmed);
    if (!m) continue;
    answers[Number.parseInt(m[1], 10)] = {
      letter: m[2],
      explanation: m[3].trim(),
    };
  }

  // questions: split on lookahead "**Q\d+.**"
  const questions = [];
  const qChunks = questionsBlock
    .split(/\n(?=\*\*Q\d+\.\*\*)/)
    .filter((s) => s.trim());
  for (const chunk of qChunks) {
    const headerInChunk = /^\*\*Q(\d+)\.\*\*\s*([\s\S]+?)(?=\n\s*\n- [A-D]\.|\n- [A-D]\.)/.exec(chunk);
    if (!headerInChunk) continue;
    const num = Number.parseInt(headerInChunk[1], 10);
    const stem = headerInChunk[2].trim();
    const rest = chunk.slice(headerInChunk[0].length);
    const opts = [];
    const optionLines = rest.split("\n");
    let current = null;
    for (const line of optionLines) {
      const optHead = /^- ([A-D])\.\s+(.*)$/.exec(line);
      if (optHead) {
        if (current) opts.push(current);
        current = { letter: optHead[1], text: optHead[2].trim() };
      } else if (current && line.trim().length > 0) {
        current.text += " " + line.trim();
      } else if (current && line.trim().length === 0) {
        opts.push(current);
        current = null;
        break;
      }
    }
    if (current) opts.push(current);
    if (opts.length === 0) continue;
    const ans = answers[num];
    if (!ans) continue;
    questions.push({
      number: num,
      stem,
      options: opts,
      answerLetter: ans.letter,
      explanation: ans.explanation,
    });
  }
  return questions;
}

// ---------- per-question stats ----------
function analyzeQuestion(q) {
  const lengths = {};
  for (const opt of q.options) lengths[opt.letter] = visibleLength(opt.text);
  const letters = q.options.map((o) => o.letter);
  const correctLen = lengths[q.answerLetter];
  const distractorLens = letters
    .filter((l) => l !== q.answerLetter)
    .map((l) => lengths[l]);
  const distractorMean =
    distractorLens.reduce((a, b) => a + b, 0) / Math.max(1, distractorLens.length);
  const ratio = distractorMean > 0 ? correctLen / distractorMean : 0;
  const allLens = letters.map((l) => lengths[l]);
  const maxLen = Math.max(...allLens);
  const longestLetter = letters.find((l) => lengths[l] === maxLen);
  const correctIsLongest = longestLetter === q.answerLetter;
  return {
    number: q.number,
    stem: q.stem,
    answerLetter: q.answerLetter,
    lengths,
    distractorMean: Math.round(distractorMean * 10) / 10,
    correctLen,
    biasRatio: Math.round(ratio * 100) / 100,
    correctIsLongest,
    flagged: ratio >= FLAG_THRESHOLD,
  };
}

// ---------- main ----------
async function listLessonFiles() {
  const entries = await fs.readdir(LESSONS_DIR);
  return entries.filter((n) => /^d\d{2}-.+\.md$/.test(n)).sort();
}

async function run() {
  const files = await listLessonFiles();
  const report = [];
  let totalQ = 0;
  let totalFlagged = 0;
  let totalCorrectIsLongest = 0;

  for (const file of files) {
    const day = Number.parseInt(file.slice(1, 3), 10);
    if (onlyDay && day !== onlyDay) continue;
    const raw = await fs.readFile(path.join(LESSONS_DIR, file), "utf-8");
    const questions = parseQuiz(raw);
    if (!questions) {
      report.push({ day, file, error: "no quiz parsed" });
      continue;
    }
    const analyzed = questions.map(analyzeQuestion);
    const flagged = analyzed.filter((a) => a.flagged);
    const correctIsLongestCount = analyzed.filter((a) => a.correctIsLongest).length;
    totalQ += analyzed.length;
    totalFlagged += flagged.length;
    totalCorrectIsLongest += correctIsLongestCount;
    report.push({
      day,
      file,
      questionCount: analyzed.length,
      flaggedCount: flagged.length,
      correctIsLongestCount,
      questions: analyzed,
    });
  }

  if (wantJson) {
    process.stdout.write(
      JSON.stringify(
        {
          summary: {
            totalQuestions: totalQ,
            totalFlagged,
            flaggedRate:
              totalQ > 0 ? Math.round((totalFlagged / totalQ) * 1000) / 10 : 0,
            correctIsLongestCount: totalCorrectIsLongest,
            correctIsLongestRate:
              totalQ > 0
                ? Math.round((totalCorrectIsLongest / totalQ) * 1000) / 10
                : 0,
            flagThreshold: FLAG_THRESHOLD,
          },
          days: report,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  // human-readable
  const lines = [];
  lines.push(
    `Quiz length-bias audit  (flag threshold: correct >= ${FLAG_THRESHOLD}× distractor mean)\n`,
  );
  lines.push(
    `Total questions: ${totalQ}   flagged: ${totalFlagged} (${
      totalQ ? Math.round((totalFlagged / totalQ) * 1000) / 10 : 0
    }%)   correct-is-longest: ${totalCorrectIsLongest} (${
      totalQ ? Math.round((totalCorrectIsLongest / totalQ) * 1000) / 10 : 0
    }%)\n`,
  );
  for (const d of report) {
    if (d.error) {
      lines.push(`D${String(d.day).padStart(2, "0")}  !! ${d.error}  (${d.file})`);
      continue;
    }
    const tag =
      d.flaggedCount > 0 ? `FLAGGED ${d.flaggedCount}/${d.questionCount}` : `clean ${d.questionCount}`;
    lines.push(
      `D${String(d.day).padStart(2, "0")}  ${tag}   correct-longest ${d.correctIsLongestCount}/${d.questionCount}  ${d.file}`,
    );
    for (const q of d.questions) {
      if (onlyFlagged && !q.flagged) continue;
      const lensStr = ["A", "B", "C", "D"]
        .filter((l) => l in q.lengths)
        .map((l) => `${l}=${q.lengths[l]}${l === q.answerLetter ? "*" : ""}`)
        .join(" ");
      const flag = q.flagged ? "  ⚑" : "";
      const longest = q.correctIsLongest ? "  [longest=correct]" : "";
      lines.push(
        `   Q${q.number}  ans=${q.answerLetter}  ratio=${q.biasRatio}  ${lensStr}${longest}${flag}`,
      );
    }
  }
  process.stdout.write(lines.join("\n") + "\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
