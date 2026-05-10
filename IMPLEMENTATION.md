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
- [x] Auth (passcode + iron-session middleware) — opt-in via env vars. Set `SESSION_PASSWORD` (≥32 char secret) + `APP_PASSCODE` in `web/.env.local` to enable; leave unset for open-access localhost dev. Login form at `/login`, middleware at `web/middleware.ts` redirects unauthed app routes to login and returns 401 JSON for unauthed API routes.
- [x] PWA manifest + service worker — `app/manifest.ts` (display: standalone, mint theme color, /icon.svg), apple-touch + iOS standalone meta tags in layout, `public/sw.js` hand-rolled service worker (cache-first for assets, network-first with cache fallback for HTML + /api/*), prod-only registration via `components/RegisterSW.tsx`.
- [ ] Polish: theme toggle, transitions, a11y, 404/error states
- [x] Keyboard shortcuts: `j` next lesson, `k` prev lesson, `m` click Complete (`components/LessonShortcuts.tsx`). `1`–`4` quiz answers deferred — quiz is reveal-only per the locked Phase D/E spec, no interactive scoring yet.
- [x] Cloudflare Tunnel setup doc — `web/DEPLOYMENT.md` (quick-tunnel flow + named-tunnel upgrade path)
- [x] Windows "run on login" task for `npm start` + `cloudflared` — `web/scripts/start-deployment.ps1` + `stop-deployment.ps1`; `schtasks` one-liner in `DEPLOYMENT.md` (user runs once to register)
- [ ] End-to-end smoke test on phone (via tunnel) + desktop — desktop validated end-to-end (auth gate, login flow, lesson render over public URL); phone test is user's call

## Stage 2.5 — Improvements (curriculum + web app)

Coordinated change set; user-defined sequencing. See `/memories/session/plan.md` for full plan and locked decisions.

- [x] **(1) Quiz length-bias audit + rewrites** — added `web/scripts/audit-quiz-lengths.mjs` (mirrors `parseAndStripQuiz` shape, flags questions where correct option ≥1.4× distractor mean). Baseline: 143/168 questions flagged (85.1%), 150/168 correct-is-longest (89.3%). Per-day rewrites dispatched to 28 parallel subagents (one per day) — tightened correct options, lengthened distractors with plausible-but-wrong technical detail. Final: 0/168 flagged, 60/168 correct-is-longest (35.7% — close to the 25% random baseline). All 168 answer letters preserved; production parser (`web/lib/quiz.ts` `parseAndStripQuiz`) still extracts every quiz.
- [x] **(3) + (5) Spaced-recall warm-up + weekly review** — shared sampler `web/lib/quiz-pool.ts` (xmur3 + sfc32 deterministic PRNG, `seedKey` constant `"global"` per locked decision; signature kept generic for forward-compat with per-session keying). Warm-up: 2 questions on D2+, weighted toward recent days with ≥1 from ≥3 days back when available; injected above the article in `web/app/lesson/[day]/page.tsx`; D1 has no warm-up. Weekly cumulative review: 8 questions sampled across the week's 7 lessons with ≥1 per day, served at `/review/[week]` (1–4) via auto-generation from the per-lesson quiz pools (no new markdown content). New `web/components/Quiz.tsx` `variant` prop (`lesson` | `warmup` | `weekly`); `web/components/WeeklyReviewClient.tsx` is a new client component implementing click-to-pick + Submit + per-question correct/incorrect reveal. Progress schema in `web/lib/progress.ts` extended with `weekly: Record<"1"|"2"|"3"|"4", {completed_at, score, total}>`; new POST/GET API at `/api/progress/weekly/[week]` with server-side 409 gate when not all 7 lessons are complete. Dashboard `web/app/page.tsx` shows a `WeekReviewCard` after each 7-tile row (locked / unlocked / done with score). Final-day lesson pages (D7/D14/D21/D28) get a "Week N review →" nudge card after the prev/next nav. CSS additions in `web/app/globals.css` for `.quiz-section--warmup`, `.quiz-section--weekly`, interactive options, weekly footer, dashboard review cards, lesson-end review nudge.
- [x] **(2) Per-section "mark as read" collapse** — extended `rehypeWrapSections` in `web/lib/markdown.ts` to inject a `<span class="lesson-section-badge">read ✓</span>` inside each section's summary AND a `<button class="section-mark-read">✓ Mark section read</button>` at the section's tail. Refactored `web/components/SectionTracker.tsx` to wire both buttons via a shared `setSectionState` helper: summary check (badge + un-mark toggle, no auto-collapse) and bottom mark-read button (forward-flow: mark complete + collapse the `<details>`). On hydration, sections already marked complete server-side now default-collapse with the badge visible; existing `section-toggle` event still fires so `SectionProgress` updates live. CSS additions: `.lesson-section-badge`, `.section-footer`, `.section-mark-read[data-completed]`, summary-mint-tint when done. The `m` keyboard shortcut still targets `.lesson-complete .complete-button` (whole-lesson Complete) — section toggling is mouse-only.
- [x] **(4) Post-complete "Back to lesson index" nav** — `web/components/CompleteButton.tsx` complete-state branch now renders a `complete-strip-group` containing the existing completion strip plus a `<Link href="/">` styled as an outline ghost button ("← Back to lesson index"). CSS additions: `.complete-strip-group`, `.complete-back-link`. The `j`/`k`/`m` shortcuts in `web/components/LessonShortcuts.tsx` are unaffected (handled by a separate component, target unchanged).
