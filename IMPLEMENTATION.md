# Implementation checklist

Running plan-of-record. Tick items as they're completed. Detailed plan in `C:\Users\nepstein\.claude\plans\mutable-bubbling-chipmunk.md`.

## Stage 0 — Initialization

- [x] `git init -b main` at repo root
- [x] `README.md` — top-level overview
- [x] `IMPLEMENTATION.md` — this file
- [x] `.gitignore` — Node / Next.js / OS / IDE / SQLite working files
- [x] `LICENSE` — MIT
- [x] `learning-plan/.gitkeep`
- [x] `web/.gitkeep`
- [x] Initial commit (`ade3f7e`)

## Stage 1 — Curriculum content

### 1a. Topic + benchmark grid — REVIEW GATE
- [x] Draft `learning-plan/overview.md` (28-row table + week themes)
- [x] Iterate with user — swap topics/benchmarks
- [x] Approved

### 1b. Sample lesson — REVIEW GATE
- [x] Draft `learning-plan/lessons/d01-*.md` (full lesson, locks the format)
- [x] Iterate with user — depth/tone/length
- [x] Approved

### 1c. Bulk lesson generation
- [x] Lessons d02–d07 (Week 1 finish) — drafted via parallel validator-drafter agents; awaiting review
- [x] Lessons d08–d14 (Week 2) — drafted via parallel validator-drafter agents; awaiting review
- [x] Lessons d15–d21 (Week 3) — drafted via parallel validator-drafter agents; awaiting review
- [x] Lessons d22–d28 (Week 4) — drafted via parallel validator-drafter agents; awaiting review
- [x] Final consistency pass across all 28 — audit clean (1 Must-fix on calibration-thread chain in d05; +1 sibling found in d23 during verification; both fixed)

## Stage 2 — Web app

- [x] Bootstrap `web/`: `create-next-app` (Next.js 16 + React 19 + Tailwind v4 + ESLint + TS + Turbopack) and `shadcn@latest init` with defaults
- [x] Markdown pipeline + content loader (gray-matter, remark, remark-gfm, remark-math, rehype-raw, rehype-katex, rehype-pretty-code, custom mermaid-pre transformer in lieu of rehype-mermaid)
- [x] Render lesson 1 end-to-end at `/lesson/1` (and all 28 via SSG)
- [x] Storage layer (JSON-backed `web/data/progress.json`; per-host single-user; gitignored). Swap to `better-sqlite3` when going through the Cloudflare Tunnel for multi-device sync.
- [x] API routes: `GET /api/progress`, `POST /api/progress/lesson/[day]`. Auth deferred (Phase H gate).
- [x] Dashboard 4×7 grid wired to storage — completion state painted, mint accent on done tiles, per-week and overall counters, avg-min-per-lesson reading-time aggregate. Tiles show day + topic + anchor benchmark.
- [x] Quiz component — per-question revealable answer (native `<details>`), markdown-rendered stems / options / explanations, parsed from each lesson's `<details>` answer block. Interactive scoring deferred (current quiz is reveal-only per stage 2 phase B/D ask).
- [ ] Progress page (overall %, per-week %, streak, attempts table) — superseded by the dashboard's inline completion state per user direction (game-tile model).
- [ ] Auth (passcode + iron-session middleware) — gated to Phase H (Cloudflare Tunnel exposure).
- [ ] PWA manifest + service worker
- [ ] Polish: theme toggle, transitions, a11y, 404/error states
- [ ] Keyboard shortcuts (j/k/m/1-4)
- [ ] Cloudflare Tunnel setup doc
- [ ] Windows "run on login" task for `npm start` + `cloudflared`
- [ ] End-to-end smoke test on phone (via tunnel) + desktop
