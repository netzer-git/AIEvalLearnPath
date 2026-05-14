# Agent guide — `AIEvalLearnPath`

Self-paced 28-lesson curriculum on LLM evaluation + a planned Next.js companion app. See [README.md](README.md) for the project pitch and [IMPLEMENTATION.md](IMPLEMENTATION.md) for the running checklist.

## Read first, every session

1. [IMPLEMENTATION.md](IMPLEMENTATION.md) — source of truth for what's done and what's next. **Tick boxes here as you finish work.**
2. [README.md](README.md) — repo layout, week themes, planned Stage 2 stack.
3. [learning-plan/overview.md](learning-plan/overview.md) — the 28-row topic + benchmark grid that drives every lesson.

## Hard rule: respect the staged workflow

The project is built in strict stages with **review gates between them**. Do not skip ahead.

| Stage | Status | What's allowed |
| --- | --- | --- |
| 0 — Init | done | — |
| 1a — Topic/benchmark grid | done | Edit [overview.md](learning-plan/overview.md) only. The 28-row grid is the contract every lesson is written against. |
| 1b — Sample lesson (`d01-*.md`) | done | Locked the lesson format. |
| 1c — Lessons d02–d28 | done | Drafted against the approved d01 template. |
| 2 — Web app in `web/` | done | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui; lesson rendering, dashboard, quiz, auth, PWA, Cloudflare Tunnel. |
| 2.5 — Improvements | done | Quiz length-bias audit + per-lesson rewrites; spaced-recall warm-up + weekly review; per-section mark-as-read; post-complete navigation. |
| 2.6 — Pedagogical retrofit | done | Full schema retrofit on all 28 lessons (TL;DR, learning objectives, prerequisites & callback, ⏵ Check yourself, glossary, cross-references); web-app coordinated update (rehype tagger, `/glossary` route, slug-alias migration); audit suite (schema + Bloom + length-bias). Schema-of-record: `learning-plan/LESSON_TEMPLATE.md`. |

If a user request would jump a stage, surface that and ask before proceeding.

## Curriculum conventions (`learning-plan/`)

The canonical schema-of-record is **[learning-plan/LESSON_TEMPLATE.md](learning-plan/LESSON_TEMPLATE.md)**. Read it fully before drafting or revising any lesson.

- **Lesson filenames**: `learning-plan/lessons/dNN-<kebab-slug>.md` where `NN` is `01`–`28`. Slug derives from the topic in `overview.md`.
- **Lesson budget**: ≤35 minutes of reader time per the Stage 2.6 schema. Recompute `reading_time_minutes` per the formula in `LESSON_TEMPLATE.md` (words/250 + 1/mermaid + 0.5/⏵ Check yourself + 1.5/worked example).
- **Audience leaning**: AI-safety-leaning practitioner. Technical, sourced, no fluff, no emojis.
- **Citations**: prefer the canonical paper for each anchor benchmark + 1–2 secondary links per lesson. Don't invent URLs — if unsure, leave a `TODO(link)` marker rather than guessing. References use the labeled-bullet format `**Anchor.**` / `**Harness.**` / `**Secondary.**` / `**Goodhart.**` (last one only when `goodhart_role: foregrounded`).
- **Math**: KaTeX-compatible LaTeX. Inline `$...$`, block `$$...$$`. The Stage 2 renderer uses `rehype-katex`.
- **Code**: fenced blocks with a language tag. The renderer uses `rehype-pretty-code` and a custom mermaid-pre transformer for diagrams.
- **Mermaid diagrams**: ≥1 per lesson (dual-coding requirement). Pipeline / flow / contrast diagrams. Don't substitute the `⏵` glyph (U+23F5) — the audit script keys off it for `## ⏵ Check yourself — …` H2 detection.
- **Quiz**: 6 questions per lesson, A–D options, `<details><summary>Answers</summary>` block. Bloom mix must include ≥1 each L3 Apply / L4 Analyze / L5 Evaluate. Preserve answer letters across rewrites whenever possible (the length-bias audit baseline depends on it).
- **Recurring threads (locked)**: Goodhart-foregrounded D6 / D15 / D17 / D22 / D28; calibration thread D2 *introduces* → D15 *reprises* → D20 *callback* → D24 *closes thread*. The `goodhart_role` and `calibration_role` frontmatter fields encode each lesson's role; the schema audit enforces consistency.
- **Don't change the 28-benchmark grid** in `overview.md` without flagging it; that table is the contract every downstream lesson is written against.

## Audit suite (`web/scripts/`)

Three audits gate any lesson change. From `web/`:

- `npm run audit:quiz` — length-bias on quiz options (≥1.4× distractor mean = flagged). Baseline: 0/168 flagged.
- `npm run audit:schema` — Stage 2.6 schema enforcement (sections present + ordered, frontmatter complete, ≥1 mermaid, ≥4 glossary terms, ≥2 ⏵ Check yourself, role consistency, cross-ref D-N pointers in 1..28).
- `npm run audit:bloom` — heuristic Bloom-coverage check (flags lessons missing ≥1 each L3/L4/L5).
- `npm run audit` runs all three.

When you revise a lesson, run all three and iterate until clean. Do not modify the audit scripts to make a lesson pass — the scripts are the contract.

## Web app conventions (`web/`)

Stack — locked unless the user explicitly changes it:

- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui. **Note**: `web/AGENTS.md` (created by `create-next-app`) warns Next.js 16 has breaking changes from older training data — read `web/node_modules/next/dist/docs/` before writing App Router code.
- JSON-backed `web/data/progress.json` (per-host single-user, gitignored). Swap to `better-sqlite3` only when going through the Cloudflare Tunnel for multi-device sync.
- `iron-session` cookie auth, single passcode (opt-in via `SESSION_PASSWORD` + `APP_PASSCODE` env vars).
- Markdown pipeline (`web/lib/markdown.ts`): `gray-matter` + `remark-parse` + `remark-gfm` + `remark-math` + `rehype-raw` + `rehype-katex` + a custom `rehypeMermaidPre` transformer + `rehype-pretty-code` + `rehypeWrapSections` (per-H2 collapse + section-completion buttons) + `rehypeTagPedagogicalSections` (Stage 2.6 — adds `lesson-section--{tldr|objectives|prereq|check|glossary|takeaways|cross-refs}` modifier classes).
- Mobile-first, dark mode, PWA-installable, exposed via Cloudflare Tunnel.
- Keyboard shortcuts: `j`/`k` (next/prev lesson), `m` (mark complete). `1`–`4` quiz answers deferred (quiz is reveal-only).
- Section-slug stability across the Stage 2.6 rename: `web/lib/content.ts` exports `SECTION_SLUG_ALIASES` (global) + `SECTION_SLUG_ALIASES_BY_DAY` (per-day overrides for cross-lesson collisions). `loadProgress` migrates legacy keys through `migrateSectionSlugs` on read; the next write persists.

## Repo hygiene

- Windows host. Prefer PowerShell-friendly commands. Avoid Unix-only one-liners in examples.
- `.gitignore` covers Node, Next.js build output, SQLite working files, and `.vscode/`. Don't check in `*.db`, `.next/`, or `node_modules/`.
- Lesson markdown files MUST use LF line endings. The `create_file` tool produces CRLF on Windows; normalize with `[System.IO.File]::WriteAllText($p, $c -replace "`r`n", "`n", (New-Object System.Text.UTF8Encoding $false))` after writing.
- The detailed external plan referenced in [IMPLEMENTATION.md](IMPLEMENTATION.md) (`C:\Users\nepstein\.claude\plans\...`) is **outside this repo and machine-specific** — don't try to read it; rely on `IMPLEMENTATION.md` instead.

## When in doubt

Ask. The user explicitly designed this project around review gates — small clarifying questions are cheaper than a stage being redone.
