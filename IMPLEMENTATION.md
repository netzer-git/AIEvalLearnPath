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

## Stage 2.6 — Pedagogical retrofit (curriculum + web app)

Coordinated change set; phases A → B → C → D (4 waves) → E. Plan-of-record in `/memories/session/plan.md`. Branch: `stage-2.6-pedagogical-retrofit`.

- [x] **Phase A — schema lock.** `learning-plan/LESSON_TEMPLATE.md` (canonical schema-of-record): TL;DR / Learning objectives (Bloom-tagged, ≥1 each L3/L4/L5) / Prerequisites & callback / The opening hook / Anchor / ⏵ Check yourself / Goodhart {foregrounded|sub-thread|callback} / Calibration {introduces|reprises|callback|closes thread} / Cross-references (Backward + Forward) / Week N review|handoff (D7/D14/D21/D28) / Takeaways tagged (LO N) / Glossary / References (`**Anchor.**` / `**Harness.**` / `**Secondary.**` / `**Goodhart.**`) / Quiz. Locks Goodhart and calibration recurring-thread tables. Slug-stability policy via `web/lib/content.ts` `SECTION_SLUG_ALIASES` + per-day `SECTION_SLUG_ALIASES_BY_DAY`.
- [x] **Phase B — web app + audits.**
  - `web/lib/content.ts`: `LessonFrontmatter` + `LessonSummary` extended with optional `prerequisites`, `key_terms`, `goodhart_role`, `calibration_role`. `SECTION_SLUG_ALIASES` + per-day `SECTION_SLUG_ALIASES_BY_DAY` + `resolveSectionSlug(slug, day?)` + `migrateSectionSlugs(sections)` for legacy-progress migration. `getGlossary()` aggregator + `GlossaryEntry` type.
  - `web/lib/markdown.ts`: `rehypeTagPedagogicalSections` adds `lesson-section--{tldr|objectives|prereq|check|glossary|takeaways|cross-refs}` modifier classes (runs after `rehypeWrapSections` so section-completion slugging is unchanged).
  - `web/lib/progress.ts`: `loadProgress` calls `migrateSectionSlugs` on read (legacy section-completion records resolve to canonical post-rewrite slugs; first subsequent write persists the migration).
  - `web/app/globals.css`: callout styles for the seven pedagogical-section variants, `.lesson-prereq-strip`, `.glossary-page` styles.
  - `web/app/lesson/[day]/page.tsx`: prerequisite chip strip in the header.
  - `web/app/glossary/page.tsx`: NEW site-wide glossary route, alphabetized, deep-linked to introducing lesson.
  - `web/scripts/audit-lesson-schema.mjs`: NEW (sections present + ordered, frontmatter complete, ≥1 mermaid, ≥4 glossary terms, ≥2 ⏵ Check yourself, role consistency vs. locked Goodhart/calibration table, cross-ref D-N pointers in 1..28).
  - `web/scripts/audit-quiz-bloom.mjs`: NEW heuristic Bloom-coverage audit (flags lessons missing ≥1 each L3/L4/L5).
  - `web/package.json`: `audit:quiz` / `audit:schema` / `audit:bloom` scripts + top-level `audit`.
- [x] **Phase C — pilot D1 rewrite (review gate).** `learning-plan/lessons/d01-what-is-an-eval.md` rewritten under the locked schema. All citations, mermaid pipeline, worked numbers, quiz answer letters preserved. Three ⏵ Check yourself blocks; takeaways tagged to LO 1–6; glossary with 8 D1-introduced terms. Audits clean: schema 0 violations, Bloom L2:1 L3:1 L4:2 L5:2, length-bias 0/6 flagged.
- [x] **Phase D — bulk rewrite (4 waves of parallel sub-agents).**
  - **Wave 1 — D2..D7 (commit `bca3f80`).** D2 (calibration introduces + Goodhart sub-thread), D3, D4, D5, D6 (Goodhart foregrounded — flagship, sets the curriculum-wide Goodhart pattern grid), D7 (week 1 closer with `## Week 1 review` + `## Week 1 handoff`).
  - **Wave 2 — D8..D14 (commit `1105e4c`).** D8 (`## Week 2 opens` → `## The opening hook`), D9 (multi-anchor consolidated to GSM8K + `### Companion: MATH` + `### Companion: PRM800K`), D10, D11 (Goodhart sub-thread on HumanEval contamination), D12, D13 (Goodhart-aside-brief renamed), D14 (week 2 closer).
  - **Wave 3 — D15..D21 (commit `28d46b7`).** D15 (Goodhart foregrounded + Calibration reprises — both flagship), D16, D17 (Goodhart foregrounded — situational conditioning; Apollo scheming folded into Cross-references Forward as a closing pointer), D18, D19, D20 (Goodhart sub-thread + Calibration callback), D21 (week 3 closer).
  - **Wave 4 — D22..D28 (commit `71fe0a9`).** D22 (Goodhart foregrounded — measurement-instrument-as-target), D23, D24 (Goodhart sub-thread + Calibration closes thread — the four-step reprise D2 → D15 → D20 → D24), D25 (multi-anchor consolidated to AIME + `### Companion: FrontierMath` + `### Companion: o1 system card`), D26, D27, D28 (curriculum closer — Goodhart foregrounded + Calibration callback + 28-day curriculum synthesis).
- [x] **Phase E — cross-lesson consistency + thread audit + slug-alias consolidation.**
  - All 28 lessons audit clean: schema 0/0 across all 28; Bloom 0/28 flagged for missing L3/L4/L5 (was 23/28 pre-rewrite); length-bias 0/168 flagged with 58/168 correct-is-longest (34.5%, near the 35.7% baseline).
  - Calibration thread coherent: D2 *Calibration introduces* → D15 *Calibration reprises* → D20 *Calibration callback* → D24 *Calibration closes thread*.
  - Goodhart-foregrounded sequence: D6 (leakage), D15 (incentive), D17 (situational), D22 (instrument), D28 (selection-pressure). All five lessons share the canonical `## Goodhart foregrounded` H2 and the curriculum-wide pattern grid lives in D28.
  - Goodhart sub-thread sequence: D2, D11, D20, D24, D25 — all canonical `## Goodhart sub-thread`.
  - Slug-alias consolidation: per-day overrides in `web/lib/content.ts` `SECTION_SLUG_ALIASES_BY_DAY` resolve the `goodhart-aside-brief` cross-lesson collision (D13 vs. D27) and the per-lesson Goodhart-rename slugs that the wave dispatchers produced (D7, D16, D18, D19, D26 + D21 `week-3-in-review`/`week-4-handoff` migration). `loadProgress` applies `migrateSectionSlugs` on read so existing per-section completion data keeps working.
  - Build clean (38 routes SSG'd including the new `/glossary`).
- [x] **Phase F — prerequisite-proximity content patch.** Reduced reflexive D-1 callbacks in the `## Prerequisites & callback` section. **Phase A (3 lessons, frontmatter + prose):** D3 `prerequisites: [1]→[1,2]` (lead with D-2 scoring-rule machinery, D-1 demoted to supporting beat); D13 `[1]→[1,5,7]` (lead with D-7 saturation arc + D-5 per-discipline reporting, collapsed 4× `[D-1]` to 1×); D18 `[1]→[1,3,6]` (lead with D-3 free-form-scoring problem + D-6 contamination-resistant-successor reflex). **Phase B (7 lessons, prose-only reorder):** D7, D8, D10, D11, D14, D16, D21 — callback paragraph reordered so the proximate predecessor (D-3/4/5/6/17 as applicable) leads the section; D-1 retained as a supporting beat where the pipeline-framing reuse is genuinely load-bearing, dropped otherwise. D6 retained 3× `[D-1]` intentionally (Goodhart-foregrounded callback to D-1's parking-of-Goodhart is the lesson's central methodological move). All 10 edited files normalized to LF line endings. Audits clean post-edit: schema 0/0, Bloom 0/28 flagged, length-bias 0/168 flagged.
- [ ] **Phase E follow-ups (not blocking).**
  - Glossary deduplication review on `/glossary` — 28 lessons each contribute 4–8 terms; the aggregator collapses duplicates by first-introduction day, but a manual pass to canonicalize gloss wording across lessons is worthwhile.
  - Phone smoke test of the new pedagogical callouts via Cloudflare Tunnel.
  - Optional follow-up: refactor `SECTION_SLUG_ALIASES` to merge global + per-day into a single 2-level table (current shape works but the duplication around `goodhart-sub-thread-d6-reprise-applied-to-safety-evals` is a maintenance burden).

## Stage 2.7-A — Benchmark-entry examples on every lesson

Per-lesson Anchor sections now ship a uniform `### Example item` H3 with a concrete benchmark row (fenced code block or markdown blockquote) so the reader can see exactly what one row of the benchmark looks like before the scoring-rule and mechanics subsections operate on that schema. The Stage 2.6 section schema is preserved; only the Anchor-section convention gains a new sub-requirement.

- [x] **Phase A — schema + audit.** Extended `learning-plan/LESSON_TEMPLATE.md` *Anchor section convention* to require a `### Example item` H3 (or per-anchor variant) with ≥1 fenced code block or markdown blockquote. Added the safety-sensitive carve-out (GPQA / HarmBench / WMDP → authors' own published illustrative items, cited). Added the multi-anchor sub-rule (D9 / D25 — one example block per anchor + companion). Added the corresponding mechanical check to `web/scripts/audit-lesson-schema.mjs` (`anchorBodyRange` + `auditExampleItems` helpers): every `## Anchor:` H2's body must contain ≥1 `example-item`-slugged H3 or H4, and each such head must have ≥1 fenced/blockquoted block within its own range.
- [x] **Phase B — content.** 28 lessons touched.
  - **HAS wrappers (18 lessons).** D01 / D02 / D03 / D04 / D11 / D13 / D14 / D15 / D16 / D17 / D18 / D20 → existing benchmark-row example wrapped in `### Example item` H3 (or an adjacent paraphrased H3 renamed to it). D09 multi-anchor → three named heads (`### Example item — GSM8K` / `#### Example item — MATH` / `#### Example item — PRM800K`); PRM800K block lifted up *above* the `## ⏵ Check yourself — PRM aggregation` H2 so the example lives inside the Anchor body (the H2 was prematurely closing the Anchor range). D12 SWE-Bench → sibling `### Example item` H3 added between Construction and Scoring rule, separate from the existing JSON-in-Mechanics block. D22 → `### Worked example` renamed to `### Example item` (the Python 2→3 + Model A/B trace was already a real WildBench-shape row). D23 → new `### Example item` with a battle-log JSON row (`lmsys-chat-1m` schema). D26 → new `### Example item` with a WebArena task JSON record. D27 → new `### Example item` with an OSWorld YAML task spec.
  - **WEAK replacements (7 lessons).** D05 HELM → real per-instance JSON record from `benchmark_output/runs/*/PerInstanceStats` (multi-metric: exact_match + ECE + perturbation-robustness + toxicity + runtime). D07 GPQA → paraphrased physics composite retained (per the *use authors' own published illustrative items only* decision and the safety-sensitive carve-out), heading renamed to `### Example item`, citation to Rein et al. Figure 1 / Table 2 added. D08 ARC-C → public `allenai/ai2_arc` item (the canonical "dry palms vs. wet palms" question) + the existing spoon paraphrase retained as a second illustrative item. D21 WMDP → three per-subset paraphrased shapes consolidated under `### Example item`, citation to Li et al. 2024 Section 3 / Appendix B added (per the safety-sensitive carve-out). D24 RewardBench → real LLMBar-natural (chat-hard) trio JSON from `allenai/reward-bench`. D25 multi-anchor → three blocks: `### Example item — AIME` (AIME 2024 Problem 1, Art of Problem Solving public archive) + `#### Example item — FrontierMath` (a paraphrased public-sample-set problem from Glazer et al. 2024) + `#### Example item — o1 system card report row` (verbatim three-row transcript of o1's pass@1 / cons@64 / best-of-1000 AIME 2024 numbers). D28 → new `### Example item — HCAST / RE-Bench task spec` showing a representative HCAST task YAML (METR `tasks-public` shape).
  - **MISSING blocks (3 lessons).** D06 MMLU-Pro → real 10-option physics item from `TIGER-Lab/MMLU-Pro` (the canonical glass-transmission question; 10 options including the correct one). D10 RGB → structural JSON row showing `(question, retrieved_passages[5] with answer_bearing flags, noise_ratio, testbed)`; existing Apollo-11-counterfactual block retained as mechanism illustration in a separate H3. D19 HarmBench → behavior-record JSON for the Standard / Misinformation functional + semantic category, citation to Mazeika et al. 2024 Table 1 (authors' published per-category exemplars).
- [x] **Phase C — verify.** All three audits clean across 28 lessons: schema 0 violations / 0 warnings; quiz length-bias 0/168 flagged (35% correct-is-longest, unchanged from the Stage 2.5 baseline of 34.5%); Bloom coverage 0/28 lessons flagged for missing L3/L4/L5. `npm run build` from `web/` compiles successfully; all 38 routes SSG'd including all 28 `/lesson/[day]` pages and `/glossary`. Reading-time recompute applied across all 28 lessons under the canonical `LESSON_TEMPLATE.md` formula (250 wpm + 1.0/mermaid + 0.5/check-yourself + 1.5/worked-example), cap = 35; final spread 19–35 minutes with D22 / D25 / D28 capped at 35. All 28 lesson files + `LESSON_TEMPLATE.md` + `audit-lesson-schema.mjs` normalized to LF line endings.

