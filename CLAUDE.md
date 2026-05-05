# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read these first

`AGENTS.md` is the canonical agent guide for this repo — read it every session. The bullets below are a fast index, not a replacement.

1. `IMPLEMENTATION.md` — running checklist; tick boxes here as work completes.
2. `README.md` — pitch, repo layout, planned Stage 2 stack.
3. `learning-plan/overview.md` — the 28-row topic + benchmark grid that drives every lesson.

## What this project is

A 28-lesson self-paced curriculum on LLM evaluation (`learning-plan/`) plus a planned Next.js companion app (`web/`, not yet bootstrapped). Built in strict stages with review gates between them.

## Hard rule: respect the staged workflow

| Stage | Status (as of last commit) | What's allowed |
| --- | --- | --- |
| 0 — Init | done | — |
| 1a — Topic/benchmark grid | review gate (current) | Edit `learning-plan/overview.md` only. Do not draft lessons. |
| 1b — Sample lesson `d01-*.md` | blocked on 1a sign-off | Draft only `learning-plan/lessons/d01-*.md`; locks the lesson format. |
| 1c — Lessons d02–d28 | blocked on 1b | Bulk-generate against the approved d01 template. |
| 2 — Web app in `web/` | blocked on 1c | Do not bootstrap Next.js, install deps, or create files under `web/` until Stage 1 is complete. |

Always re-derive the current stage from `IMPLEMENTATION.md` — the table above is a snapshot. If a request would jump a stage, surface it and ask before proceeding.

## No build/test/lint yet

There is no Node project, no test runner, no linter. Don't fabricate `npm`/`pnpm`/`create-next-app` commands until Stage 2 begins. Stage 0 and Stage 1 work is all markdown.

## Curriculum conventions (`learning-plan/`)

- **Filenames**: `learning-plan/lessons/dNN-<kebab-slug>.md`, `NN` ∈ `01`–`28`. Slug derives from the topic in `overview.md`.
- **Lesson budget**: ~30 min reader time. One core principle/technique + one anchor benchmark + a 5-question quiz.
- **Audience**: AI-safety-leaning practitioner. Technical, sourced, no fluff, no emojis.
- **Citations**: prefer the canonical paper for the anchor benchmark + 1–2 secondary links. Don't invent URLs — leave a `TODO(link)` marker if unsure.
- **Math**: KaTeX-compatible LaTeX (`$...$` inline, `$$...$$` block) — Stage 2 renderer uses `rehype-katex`.
- **Code**: fenced blocks with a language tag — Stage 2 renderer uses `rehype-pretty-code`.
- **Don't change the 28-benchmark grid** in `overview.md` without flagging it; that table is the contract every downstream lesson is written against.

## Web app stack (locked unless user changes it)

Stage 2 stack (in progress as of Phase A): Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4, shadcn/ui, `better-sqlite3` (SQLite files gitignored — progress is per-host), `iron-session` cookie auth (single passcode), markdown pipeline `gray-matter` + `remark` + `rehype-katex` + `rehype-pretty-code` + `rehype-mermaid`, mobile-first PWA, exposed via Cloudflare Tunnel (public URL + passcode). Keyboard shortcuts: `j`/`k` (next/prev), `m` (mark complete), `1`–`4` (quiz answer). **Next.js 16 has breaking changes from older training data** — `web/AGENTS.md` directs you to `web/node_modules/next/dist/docs/` for current conventions.

## Host notes

- Windows host — prefer PowerShell-friendly commands; avoid Unix-only one-liners.
- The detailed external plan referenced by `IMPLEMENTATION.md` (`C:\Users\nepstein\.claude\plans\...`) is **outside this repo and machine-specific**. Don't try to read it; rely on `IMPLEMENTATION.md` for plan-of-record.
- `.gitignore` already covers Node, Next.js build output, SQLite working files, and `.vscode/`. Don't check in `*.db`, `.next/`, or `node_modules/`.
