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
- [ ] Initial commit

## Stage 1 — Curriculum content

### 1a. Topic + benchmark grid — REVIEW GATE
- [ ] Draft `learning-plan/overview.md` (28-row table + week themes)
- [ ] Iterate with user — swap topics/benchmarks
- [ ] Approved

### 1b. Sample lesson — REVIEW GATE
- [ ] Draft `learning-plan/lessons/d01-*.md` (full lesson, locks the format)
- [ ] Iterate with user — depth/tone/length
- [ ] Approved

### 1c. Bulk lesson generation
- [ ] Lessons d02–d07 (Week 1 finish)
- [ ] Lessons d08–d14 (Week 2)
- [ ] Lessons d15–d21 (Week 3)
- [ ] Lessons d22–d28 (Week 4)
- [ ] Final consistency pass across all 28

## Stage 2 — Web app

- [ ] Bootstrap `web/`: `create-next-app`, Tailwind, shadcn/ui
- [ ] Markdown pipeline + content loader (gray-matter, remark, rehype-katex, rehype-pretty-code)
- [ ] Render lesson 1 end-to-end at `/lesson/1`
- [ ] SQLite layer (`better-sqlite3`) + migrations
- [ ] API routes: `/api/progress`, `/api/auth`
- [ ] Dashboard 4×7 grid wired to DB
- [ ] Quiz component (interactive, scored, persisted)
- [ ] Progress page (overall %, per-week %, streak, attempts table)
- [ ] Auth (passcode + iron-session middleware)
- [ ] PWA manifest + service worker
- [ ] Polish: theme toggle, transitions, a11y, 404/error states
- [ ] Keyboard shortcuts (j/k/m/1-4)
- [ ] Cloudflare Tunnel setup doc
- [ ] Windows "run on login" task for `npm start` + `cloudflared`
- [ ] End-to-end smoke test on phone (via tunnel) + desktop
