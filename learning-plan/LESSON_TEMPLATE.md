# Lesson template — Stage 2.6 schema-of-record

This file is the **canonical schema** every lesson under
`learning-plan/lessons/dNN-*.md` follows. It is consumed by:

- The audit script `web/scripts/audit-lesson-schema.mjs` (mechanical
  enforcement: required sections present + ordered, required
  frontmatter complete, ≥1 mermaid block, ≥4 LOs, ≥4 glossary terms,
  quiz parses).
- The web renderer in `web/lib/markdown.ts` (rehype plugins style
  `## TL;DR`, `## Learning objectives`, `⏵ Check yourself` blocks, and
  `## Glossary` as inline callouts).
- Sub-agents drafting or revising lessons (the prompt contract — "match
  this template").

The 28-lesson topic + benchmark grid in `learning-plan/overview.md` is
**unchanged**; this template only governs *how* each lesson is
structured internally.

---

## Pedagogical principles

The template encodes four research-backed conventions:

1. **Backward design** (Wiggins & McTighe). Surface explicit, behavioral
   learning objectives **before** content; close the loop with
   takeaways tagged to those objectives.
2. **Advance organizers** (Ausubel). A 2–3-sentence TL;DR builds
   schema before the reader parachutes into the opening hook.
3. **Retrieval practice** (Roediger & Karpicke). At least two
   `⏵ Check yourself` formative-check cards mid-lesson, in addition
   to the end-of-lesson 6-question quiz. The Stage 2.5 warm-up
   addresses *between-lesson* spacing; these checks address
   *within-lesson* retrieval.
4. **Dual coding** (Paivio; Mayer's multimedia principles). Every
   lesson contains ≥1 mermaid diagram (pipeline / flow / contrast),
   so the same idea is encoded both visually and verbally.

Cognitive Load Theory dictates the worked-example expectation: every
mechanical-content lesson (D2 acc/acc_norm, D5 CIs, D9 PRM aggregation,
D11 pass@k, D16 BBQ s_DIS, D23 ELO, D24 RM calibration, D25 cons@N,
D28 horizon-fitting) ships at least one fully-worked numeric example
the reader can reproduce.

---

## Frontmatter (YAML)

Required fields (locked from Stage 1a):

```yaml
day: NN                    # 1..28
slug: kebab-slug
title: "Quoted lesson title"
week: N                    # 1..4
week_theme: "..."
anchor_benchmark: "..."
harness: "..."
reading_time_minutes: 28-35   # recomputed at draft time
```

New optional fields (added at Stage 2.6):

```yaml
prerequisites: [N1, N2, ...]            # day numbers; load-bearing concepts
key_terms: ["term1", "term2", ...]      # 4..8 terms-of-art introduced or used today
goodhart_role: "foregrounded" | "sub-thread" | "callback" | "absent"
calibration_role: "introduces" | "reprises" | "callback" | "closes" | "absent"
```

The Goodhart and calibration roles are **fixed by the curriculum
design** and must not drift between revisions:

| Day | `goodhart_role` | `calibration_role` |
| --- | --- | --- |
| D1 | callback | absent |
| D2 | sub-thread | introduces |
| D6 | foregrounded | absent |
| D11 | sub-thread | absent |
| D15 | foregrounded | reprises |
| D17 | foregrounded | absent |
| D20 | sub-thread | callback |
| D22 | foregrounded | absent |
| D24 | sub-thread | closes |
| D25 | sub-thread | absent |
| D28 | foregrounded | callback |

All other days default to `goodhart_role: absent`,
`calibration_role: absent`. Changes to this table require an
`overview.md` review, not a per-lesson rewrite.

---

## Section order (locked)

The audit enforces this order. Sections marked **(M)** are mandatory.
Sections marked **(C)** are conditional on a flag in frontmatter or the
day's curriculum role. Sections marked **(O)** are optional but
encouraged.

1. `# Day NN — Title` **(M)** — H1 with day number + dash + title.
2. `## TL;DR` **(M)** — 2–3 sentences. Advance organizer.
3. `## Learning objectives` **(M)** — 4–6 Bloom-tagged behavioral
   objectives. See "Bloom mix" below.
4. `## Prerequisites & callback` **(C — required for D2..D28)** —
   1 paragraph naming which prior lessons' concepts are load-bearing.
5. `## The opening hook` **(M)** — concrete grounding scenario. The
   word "hook" is required; "opening question" / "Week N opens"
   variants are renamed to this.
6. **Conceptual framing sections** **(M, ≥1, ≤3)** — lesson-specific
   H2s that motivate the anchor.
7. `## Anchor: {Benchmark} ({Author et al. Year})` **(M)** — always
   benchmark-named. For multi-anchor lessons (D9, D25), the primary
   anchor uses this header and companion benchmarks live as
   `### Companion: {Name}` sub-headings inside.
8. `## ⏵ Check yourself — {short label}` **(M, ≥2 per lesson, ≤4)** —
   formative-check H2. Each contains a 1-question prompt and a
   `<details><summary>Show answer</summary>...</details>` block.
   Distribute through the body, not all at the end.
9. **Further conceptual sections** **(M, ≥1)** — mechanism, math,
   contrast, ecosystem.
10. `## Diagram` **(C — required if no mermaid block exists in any
    earlier section)** — a flow / pipeline / contrast diagram in
    a `mermaid` fence. If a diagram already appears earlier, this
    section is skipped.
11. `## Goodhart {foregrounded | sub-thread | callback}` **(C — present
    iff `goodhart_role != "absent"`)** — third-segment qualifier
    matches frontmatter `goodhart_role`. Replaces the drift between
    "Goodhart aside (brief)" / "Goodhart sub-thread" / "Goodhart
    foregrounded".
12. `## Calibration {introduces | reprises | callback | closes thread}`
    **(C — present iff `calibration_role != "absent"`)** — same
    pattern as Goodhart.
13. `## Cross-references` **(M)** — replaces all "Forward pointer" /
    "Forward-pointers" / "Cross-references and forward pointers"
    variants. Two bullet groups: `**Backward.**` and `**Forward.**`,
    each listing `D-N` numbered links and a one-sentence linkage.
14. `## Week N {handoff | review}` **(C — present only on D7 / D14 /
    D21 / D28)** — `review` on D7/14/21, `handoff` on D7/14/21
    closing toward the next week, and the synthesis pair
    (`review` + `handoff` + closing-curriculum block) on D28.
15. `## Takeaways` **(M)** — 4–6 bullets. Each tagged
    `(LO N)` to close the backward-design loop. Bullets without a
    matching LO are flagged by the audit.
16. `## Glossary` **(M)** — 4–8 terms in `**term**: gloss
    [first introduced D...]` format. Aggregated by the site-wide
    `/glossary` route.
17. `## References` **(M)** — labeled bullets:
    - `**Anchor.**` — canonical paper for the anchor benchmark.
    - `**Harness.**` — the per-lesson harness (per overview.md).
    - `**Secondary.**` — 1–3 additional citations.
    - `**Goodhart.**` — only when foregrounded.
    URLs verified or marked `TODO(link)` per AGENTS.md.
18. `## Quiz` **(M)** — locked contract from Stage 2.5:
    - 6 questions, `**Q1.**` … `**Q6.**`.
    - 4 options per question, `- A. …`, `- B. …`, `- C. …`, `- D. …`.
    - `<details><summary>Answers</summary>` block at the end with
      `1. **L** — explanation.` per question.
    - Answer letters preserved across rewrites whenever possible
      (so the existing length-bias audit baseline holds).

---

## Bloom mix for the quiz

The 6 questions per lesson must hit the following coverage:

- **≥1 question at L3 — Apply** (compute / use a formula / classify a
  given case under a definition).
- **≥1 question at L4 — Analyze** (decompose, contrast, identify the
  load-bearing assumption).
- **≥1 question at L5 — Evaluate** (judge a claim / critique a report /
  pick the most-defensible reading).

The remaining slots can be L2 (Understand). L1 (Recall) is
discouraged. L6 (Create) is out of scope for an MC format.

The audit script flags any lesson missing a category but does **not**
auto-fix. Sub-agents revising lessons should rephrase stems first
(preserving correct-option letters) before swapping whole questions.

---

## Worked-example convention

Every lesson with mechanical content (formulas, scoring rules,
algorithmic procedures) ships at least one fully-worked numeric
example readers can reproduce. Convention:

- Box the example in a fenced block with a leading
  `> **Worked example.** {one-line setup}` blockquote.
- Show every intermediate step. Cognitive Load Theory: the
  worked-example effect's strength comes from the elimination of
  means-ends search, which requires the *full* derivation.
- A `⏵ Check yourself` block within ~20 lines of the worked example
  is recommended (immediate retrieval).

---

## `⏵ Check yourself` block convention

Each `## ⏵ Check yourself — {label}` H2 contains:

```markdown
## ⏵ Check yourself — {short label}

{1-question prompt, ≤3 sentences}

<details>
<summary>Show answer</summary>

{1-paragraph answer with the *reasoning*, not just the result}

</details>
```

The `⏵` glyph (U+23F5 BLACK MEDIUM RIGHT-POINTING TRIANGLE) is the
audit's anchor for detecting these blocks; do not substitute.

The renderer (rehype) lifts the H2 + first paragraph + `<details>`
into a styled `<aside class="formative-check">` so visual cadence
distinguishes them from regular body sections. Section-completion
tracking via `rehypeWrapSections` still applies — these are real H2s,
slugged and tickable like any other section.

---

## Glossary section convention

```markdown
## Glossary

- **term-of-art**: one-line gloss [introduced D-N].
- **another term**: gloss [introduced D-N · used here].
- **a previously-introduced term**: gloss [introduced D-N · reused].
```

The `[introduced D-N]` annotation is required on the *first
appearance* term across the curriculum. Subsequent lessons that
*reuse* the term use `[introduced D-N · reused]` and may omit it
entirely if the term is too generic to claim a single introduction
day. The site-wide `/glossary` route deduplicates by collapsing
to first-appearance.

---

## Anchor section convention

```markdown
## Anchor: {Benchmark} ({First-Author et al. Year})

**Citation.** {Full BibTeX-style citation with arXiv id / DOI / URL}.

{1-paragraph framing of why this benchmark is this lesson's anchor
— what methodological move it locks in.}

### Construction

{How the dataset was built. Numbers: item count, splits, license.}

### Scoring rule

{What the metric is. If non-trivial, derive it.}

### Mechanics: how `{harness}` runs it

{The exact pipeline. CLI snippet if applicable. Reproduces the
"evaluation-as-code" framing from D1.}

### Frontier numbers (drift caveat)

{Mid-2026 SOTA, with the standard "numbers move" caveat.}
```

Multi-anchor lessons (D9 GSM8K + MATH + PRM800K, D25 AIME + FrontierMath
+ o1 system card) keep the **single primary anchor** in the H2 and
fold companions under `### Companion: {Name}` sub-headings inside the
same H2 block, so the audit sees one Anchor section.

---

## Cross-references section convention

```markdown
## Cross-references

**Backward.**
- D-N — {1-sentence statement of the concept reused, in this lesson's
  framing}.
- D-N — ...

**Forward.**
- D-N — {1-sentence statement of how this lesson's framing extends
  forward}.
- D-N — ...
```

Bullets cite real D-N pointers; the audit script resolves them.
Intra-week-end "Week N in review" / "Week N handoff" sections (D7,
D14, D21, D28) live in `## Week N ...` and may duplicate / extend
these pointers.

---

## Reading-time formula

`reading_time_minutes` is recomputed at draft time as:

```
words / 250    (250 wpm, conservative for technical prose)
+ 1.0 minute   per mermaid block
+ 0.5 minutes  per ⏵ Check yourself block
+ 1.5 minutes  per worked example
```

Round to the nearest integer. Cap at 35. The current Stage-1c lessons
average ~28; the Stage-2.6 retrofit budget is ≤35.

---

## Section-slug stability

The web app's per-section completion tracking
(`web/lib/markdown.ts: rehypeWrapSections`) slugs each H2's text. H2
renames produce new slugs and would otherwise wipe progress on user
devices.

Stage 2.6 introduces a slug-alias table in `web/lib/content.ts`
(`SECTION_SLUG_ALIASES`) so that a fixed set of pre-rewrite slugs
(`"opening-question"`, `"forward-pointer"`, `"week-2-opens"`, …) read
back as the new canonical slugs (`"the-opening-hook"`,
`"cross-references"`, …). The mapping is documented inline in
`content.ts`.

When renaming an H2 in a lesson, sub-agents append the old →new
mapping to that table. The audit script verifies every renamed H2 has
a matching alias entry.

---

## Audit summary

`npm run audit` (Stage 2.6) is a top-level script that runs:

- `audit:quiz` (Stage 2.5; length-bias audit must remain 0/168 flagged).
- `audit:schema` (NEW; this template's mechanical enforcement).
- `audit:bloom` (NEW; flags Bloom-mix gaps in quizzes).

CI-equivalent target: all three pass on every lesson. The bulk-rewrite
phase (Phase D of the Stage 2.6 plan) ends only when the audit is
clean.
