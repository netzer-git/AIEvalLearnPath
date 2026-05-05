# AIEvalLearnPath — 28-day curriculum + companion web app

A self-paced 4-week / 28-lesson curriculum on LLM benchmarks and evaluation, plus a small mobile-friendly web app to follow it.

Each lesson is ~30 minutes: one core principle or technique + one anchor benchmark + a 5-question quiz.

## Repository layout

```
.
├── learning-plan/          # The 28-lesson curriculum (markdown)
│   ├── overview.md         # 28-row topic + benchmark grid
│   └── lessons/            # One markdown file per day (d01-..d28-)
└── web/                    # Next.js companion app (Stage 2)
```

## Stages

This project is built in three stages, with a review gate between each:

- **Stage 0 — Initialization**: empty repo skeleton (this commit).
- **Stage 1 — Curriculum**: write and iterate on `learning-plan/`. Topic+benchmark grid first, then a sample lesson, then bulk-generate the rest. Reviewed before any code is written.
- **Stage 2 — Web app**: Next.js + Tailwind + shadcn/ui + SQLite. Mobile-first, server-side progress sync, exposed via Cloudflare Tunnel.

See `IMPLEMENTATION.md` for the running checklist.

## Curriculum themes (proposed)

| Week | Theme |
| --- | --- |
| 1 | Foundations of LLM evaluation |
| 2 | Capability benchmarks (knowledge, reasoning, code, math, multimodal) |
| 3 | Alignment, safety, robustness |
| 4 | Frontier evaluation methods (LLM-as-judge, agents, contamination, red-teaming) |

The exact 28-row topic+benchmark mapping lives in `learning-plan/overview.md` once Stage 1a is written.

## Web app (Stage 2 — TBD)

How to run the app will be filled in once Stage 2 begins. Planned stack:

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: Tailwind CSS + shadcn/ui, mobile-first, dark mode, PWA-installable
- **Storage**: SQLite (`better-sqlite3`) for completion + quiz scores, synced across devices
- **Auth**: single passcode (iron-session cookie)
- **Remote access**: Cloudflare Tunnel → free public HTTPS URL

## License

MIT — see [LICENSE](./LICENSE).
