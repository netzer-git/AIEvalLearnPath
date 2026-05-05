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
| 1a — Topic/benchmark grid | **review gate** (current) | Edit [overview.md](learning-plan/overview.md) only. Do not draft lessons. |
| 1b — Sample lesson (`d01-*.md`) | blocked on 1a | Draft only `learning-plan/lessons/d01-*.md`. Locks the lesson format. |
| 1c — Lessons d02–d28 | blocked on 1b | Bulk-generate against the approved d01 template. |
| 2 — Web app in `web/` | blocked on 1c | Do not bootstrap Next.js, install deps, or create files in `web/` until Stage 1 is complete. |

If a user request would jump a stage, surface that and ask before proceeding.

## Curriculum conventions (`learning-plan/`)

- **Lesson filenames**: `learning-plan/lessons/dNN-<kebab-slug>.md` where `NN` is `01`–`28` (e.g. `d01-what-is-an-eval.md`). Slug derives from the topic in `overview.md`.
- **Lesson budget**: ~30 minutes of reader time. One core principle/technique + one anchor benchmark + a 5–6 question quiz (default 5; add a 6th when the lesson has additional mechanical depth that warrants testing — `acc`/`acc_norm` mechanics on D1, calibration math on D2, etc.).
- **Audience leaning**: AI-safety-leaning practitioner. Technical, sourced, no fluff, no emojis.
- **Citations**: prefer the canonical paper for each anchor benchmark + 1–2 secondary links per lesson. Don't invent URLs — if unsure, leave a `TODO(link)` marker rather than guessing.
- **Math**: KaTeX-compatible LaTeX. Inline `$...$`, block `$$...$$`. The Stage 2 renderer uses `rehype-katex`.
- **Code**: fenced blocks with a language tag — the Stage 2 renderer uses `rehype-pretty-code`.
- **Don't change the 28-benchmark grid** in `overview.md` without flagging it; that table is the contract every downstream lesson is written against.

## Web app conventions (`web/` — not yet bootstrapped)

`web/` is intentionally empty (just `.gitkeep`) until Stage 2 begins. When Stage 2 starts, the planned stack — locked unless the user explicitly changes it — is:

- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui. **Note**: `web/AGENTS.md` (created by `create-next-app`) warns Next.js 16 has breaking changes from older training data — read `web/node_modules/next/dist/docs/` before writing App Router code.
- `better-sqlite3` for progress + quiz scores; SQLite files are gitignored (progress is per-host)
- `iron-session` cookie auth, single passcode
- Markdown pipeline: `gray-matter` + `remark` + `rehype-katex` + `rehype-pretty-code` + `rehype-mermaid` (added so lesson diagrams like the D1 pipeline flowchart render)
- Mobile-first, dark mode, PWA-installable, exposed via Cloudflare Tunnel
- Keyboard shortcuts: `j`/`k` (next/prev lesson), `m` (mark complete), `1`–`4` (quiz answer)

Until then, do not run `npm`/`pnpm`/`create-next-app` or add files under `web/`.

## Repo hygiene

- This is a Windows host. Prefer PowerShell-friendly commands. Avoid Unix-only one-liners in examples.
- `.gitignore` already covers Node, Next.js build output, SQLite working files, and `.vscode/`. Do not check in `*.db`, `.next/`, or `node_modules/`.
- The detailed external plan referenced in [IMPLEMENTATION.md](IMPLEMENTATION.md) (`C:\Users\nepstein\.claude\plans\...`) is **outside this repo and machine-specific** — don't try to read it; rely on `IMPLEMENTATION.md` instead.
- No tests, linters, or build tooling exist yet. There is nothing to run. Don't fabricate commands.

## When in doubt

Ask. The user explicitly designed this project around review gates — small clarifying questions are cheaper than a stage being redone.
