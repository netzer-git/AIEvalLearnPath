# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read these first

`AGENTS.md` is the canonical agent guide for this repo — read it every session. The bullets below are a fast index, not a replacement.

1. `IMPLEMENTATION.md` — running checklist; tick boxes here as work completes.
2. `README.md` — pitch, repo layout, planned Stage 2 stack.
3. `learning-plan/overview.md` — the 28-row topic + benchmark grid that drives every lesson.
## Read these first

`AGENTS.md` is the canonical agent guide for this repo — read it every session. The bullets below are a fast index, not a replacement.

1. `IMPLEMENTATION.md` — running checklist; tick boxes here as work completes.
2. `learning-plan/LESSON_TEMPLATE.md` — the Stage 2.6 schema-of-record. The contract every lesson is written against.
3. `learning-plan/overview.md` — the 28-row topic + benchmark grid that drives every lesson (frozen).
4. `README.md` — pitch, repo layout.

## What this project is

A 28-lesson self-paced curriculum on LLM evaluation (`learning-plan/`) plus a Next.js companion app (`web/`). Both have shipped through Stage 2.6 (full pedagogical retrofit on every lesson).

## Hard rule: respect the staged workflow

The current state is **Stage 2.6 done**. See `AGENTS.md` and `IMPLEMENTATION.md` for the full stage table. Any request that would alter the locked schema, the 28-row topic+benchmark grid, the calibration thread (D2 → D15 → D20 → D24), or the Goodhart-foregrounded sequence (D6 / D15 / D17 / D22 / D28) should be surfaced as a Stage-2.7-or-later proposal, not done inline.

## Curriculum conventions (`learning-plan/`)

The canonical schema is in `learning-plan/LESSON_TEMPLATE.md`. Read it. Key bullets:

- **Filenames**: `learning-plan/lessons/dNN-<kebab-slug>.md`, `NN` ∈ `01`–`28`. Slug derives from the topic in `overview.md`.
- **Lesson budget**: ≤35 min reader time per the Stage 2.6 schema (the formula is in `LESSON_TEMPLATE.md`).
- **Sections (locked order)**: TL;DR → Learning objectives (Bloom-tagged, ≥1 each L3/L4/L5) → Prerequisites & callback → The opening hook → conceptual framing → Anchor → ⏵ Check yourself blocks distributed → Goodhart {foregrounded|sub-thread|callback} (if `goodhart_role != absent`) → Calibration {introduces|reprises|callback|closes thread} (if `calibration_role != absent`) → Cross-references (Backward + Forward) → Week N review/handoff (D7/D14/D21/D28 only) → Takeaways (each tagged `(LO N)`) → Glossary → References (`**Anchor.**` / `**Harness.**` / `**Secondary.**` / `**Goodhart.**`) → Quiz (6 questions, A–D, `<details>` answers).
- **Mermaid**: ≥1 per lesson (dual-coding requirement).
- **⏵ Check yourself**: ≥2 per lesson, ≤4. The `⏵` glyph (U+23F5) is mandatory — the audit script keys off it.
- **Audience**: AI-safety-leaning practitioner. Technical, sourced, no emojis.
- **Citations**: anchor + 1–2 secondaries. Don't invent URLs — leave `TODO(link)` if unsure.
- **Math**: KaTeX-compatible (`$...$` / `$$...$$`).
- **Code**: fenced with a language tag.

## Audit suite (`web/scripts/`)

From `web/`:

- `npm run audit:quiz` — length-bias on quiz options. Baseline: 0/168 flagged.
- `npm run audit:schema` — Stage 2.6 schema enforcement.
- `npm run audit:bloom` — Bloom-coverage check.
- `npm run audit` — all three.

When you revise a lesson, run all three and iterate until clean. Do not modify the audit scripts to make a lesson pass.

## Web app stack (locked unless user changes it)

Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4, shadcn/ui. JSON-backed `web/data/progress.json` (per-host single-user), `iron-session` cookie auth (opt-in via env vars). Markdown pipeline: `gray-matter` + `remark-parse` + `remark-gfm` + `remark-math` + `rehype-raw` + `rehype-katex` + custom `rehypeMermaidPre` + `rehype-pretty-code` + `rehypeWrapSections` + `rehypeTagPedagogicalSections`. Mobile-first PWA exposed via Cloudflare Tunnel. Keyboard shortcuts: `j`/`k` (next/prev), `m` (mark complete). Section-slug stability across the Stage 2.6 rename: `web/lib/content.ts` exports `SECTION_SLUG_ALIASES` (global) + `SECTION_SLUG_ALIASES_BY_DAY` (per-day). `loadProgress` migrates legacy keys on read.

**Next.js 16 has breaking changes from older training data** — `web/AGENTS.md` directs you to `web/node_modules/next/dist/docs/` for current conventions.

## Host notes

- Windows host — prefer PowerShell-friendly commands; avoid Unix-only one-liners.
- Lesson markdown files MUST use LF line endings. The `create_file` tool produces CRLF on Windows; normalize with `[System.IO.File]::WriteAllText($p, $c -replace "`r`n", "`n", (New-Object System.Text.UTF8Encoding $false))`.
- The detailed external plan referenced by `IMPLEMENTATION.md` (`C:\Users\nepstein\.claude\plans\...`) is **outside this repo and machine-specific**. Don't try to read it; rely on `IMPLEMENTATION.md` for plan-of-record.
- `.gitignore` already covers Node, Next.js build output, SQLite working files, and `.vscode/`. Don't check in `*.db`, `.next/`, or `node_modules/`.
