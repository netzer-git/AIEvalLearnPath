# AIEvalLearnPath — 28-day curriculum + companion web app

A self-paced 4-week / 28-lesson curriculum on LLM benchmarks and evaluation, plus a small mobile-friendly web app to follow it.

Each lesson is ~30 minutes: one core principle or technique + one anchor benchmark + a 5-question quiz. Audience: AI-safety-leaning practitioner.

## Repository layout

```
.
├── learning-plan/                 # The 28-lesson curriculum (markdown)
│   ├── overview.md                # 28-row topic + benchmark grid + threads
│   └── lessons/                   # d01-…-d28 (one markdown file per day)
├── web/                           # Next.js 16 companion app
│   ├── app/                       # App Router routes (dashboard, lesson, login, api)
│   ├── components/                # Client components (quiz, section tracker, …)
│   ├── lib/                       # Markdown pipeline, content loader, progress, session
│   ├── public/                    # Service worker, icon
│   ├── scripts/                   # PowerShell launchers for deployment
│   └── DEPLOYMENT.md              # Cloudflare Tunnel + run-on-login setup
└── IMPLEMENTATION.md              # Running checklist
```

## Curriculum

Status: all 28 lessons drafted, validated, and consistency-passed. The grid lives in [`learning-plan/overview.md`](./learning-plan/overview.md).

| Week | Theme |
| --- | --- |
| 1 | Foundations of LLM evaluation — vocabulary, scoring, statistical hygiene, contamination, saturation |
| 2 | Capability benchmarks — knowledge, reasoning, math, code, SWE, multimodal, long-context |
| 3 | Alignment, safety, robustness — truthfulness, bias, toxicity, instruction-following, jailbreaks, sycophancy, dangerous capabilities |
| 4 | Frontier methods — LLM-as-judge, reward-model evals, reasoning-model evals, agent / web / OS benchmarks, contamination-resistant design |

Two recurring threads run through the corpus:

- **Goodhart's Law** is foregrounded on D6, D15, D17, D22, D28 (data leakage → incentive structure → situational conditioning → judge as instrument → autonomy as selection pressure).
- **Calibration** chains D2 → D15 → D20 → D24, closed at D24.

## Web app

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Mobile-first PWA, dark mode by default, optional passcode auth (iron-session). Markdown pipeline: `gray-matter` + `remark` + `rehype-katex` + custom mermaid pre-transform + `rehype-pretty-code` + custom section-wrapper.

Progress is stored as JSON at `web/data/progress.json` — single-host, single-user. Each lesson day records `completed_at` + `reading_seconds`; per-section completion is tracked under `sections.<day>.<slug>`. Multi-device sync is exposed via the public Cloudflare Tunnel URL, not by syncing the file across hosts. (A `better-sqlite3` swap is on the roadmap if multi-host ever becomes a thing.)

### Quick start

```powershell
cd web
npm install
npm run dev          # http://localhost:3000
```

Auth is opt-in. To enable, create `web/.env.local`:

```
SESSION_PASSWORD=<64-char-hex>     # generate with crypto.randomBytes(32).toString("hex")
APP_PASSCODE=<your-passcode>
```

Without those, the app is open on localhost (useful for dev; never expose without them).

### Production + remote access

```powershell
npm run build
powershell -File web\scripts\start-deployment.ps1
```

The deployment script launches `npm run start` and a Cloudflare quick tunnel detached, and writes the public `*.trycloudflare.com` URL to `web/data/tunnel-url.txt`. Quick-tunnel URLs rotate on every restart; the named-tunnel upgrade path (stable hostname on a Cloudflare-managed domain) is documented in [`web/DEPLOYMENT.md`](./web/DEPLOYMENT.md), along with the `schtasks` one-liner that registers run-on-login.

### Keyboard shortcuts

- `j` next lesson, `k` previous
- `m` click the Complete button

## License

MIT — see [LICENSE](./LICENSE).
