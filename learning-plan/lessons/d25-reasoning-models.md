---
day: 25
slug: reasoning-models
title: "Reasoning models and inference-time scaling — AIME, FrontierMath, and the cost-axis Pareto frontier"
week: 4
week_theme: Frontier evaluation methods
anchor_benchmark: AIME 2024/2025 (+ FrontierMath and o1 system card as overlays)
harness: benchmark-native (chain-budget instrumented)
reading_time_minutes: 35
prerequisites: [9, 11]
key_terms:
  - cons@N (self-consistency vote)
  - pass@1024
  - reasoning-effort budget
  - accuracy-vs-cost Pareto frontier
  - log-linear regime
  - acc@B tokens
  - FrontierMath
  - test-time compute scaling
goodhart_role: sub-thread
calibration_role: absent
---

# Day 25 — Reasoning models and inference-time scaling: AIME, FrontierMath, and the cost-axis Pareto frontier

## TL;DR

Reasoning models (o1, o3, DeepSeek R1, Claude extended thinking, Gemini 2.5 Pro) break the single-scalar reporting contract that Weeks 1–3 took for granted. With a tunable internal chain-of-thought budget, accuracy is no longer a number per benchmark; it is a curve over inference-time compute, with three regimes (threshold floor, log-linear midrange, ceiling). AIME 2024/2025 is this lesson's clean integer-match anchor, FrontierMath is the difficulty-ceiling overlay, the o1 system card is the methodological anchor for cost-axis reporting, and the structural fix for cost-stripped headlines is (accuracy, cost) pair reporting — which is also where the cost-axis Goodhart sub-thread bites.

## Learning objectives

By the end of this lesson, you will be able to:

1. **(L2)** State the reasoning-model lineage (o1 Sept 2024 → o3 Dec 2024 → DeepSeek R1 Jan 2025 → Claude extended thinking Feb 2025 → Gemini 2.5 Pro Mar 2025) and the three shared properties — long internal CoT, tunable reasoning-effort budget, substantial inference cost — that distinguish the class from prior chat models.
2. **(L2)** Describe AIME 2024/2025 mechanics (15 integer-answer problems per paper, answer space 0–999, exact-match scoring) and FrontierMath's complementary role as the held-out research-level difficulty-ceiling overlay (Glazer et al. 2024).
3. **(L3)** *Apply* the cons@$N$ plurality-vote rule and the Chen et al. 2021 unbiased pass@$k$ estimator to a sampled-chains scenario and compute both per-problem indicators by hand.
4. **(L4)** *Analyze* the o1 system card's three reporting moves (pass@1 alongside cons@$N$, log-scaled accuracy-vs-tokens curves, multi-effort safety evaluation) and decompose the accuracy-vs-tokens curve into its three regimes.
5. **(L5)** *Evaluate* a "Model X = 89% on AIME 2024" headline against the cost-axis framework: identify what is structurally under-specified and choose the minimum disclosure that makes the number cross-vendor comparable.
6. **(L4)** Frame cost-axis Goodhart as a structural gaming pattern in which inference compute is the unmeasured slack variable, and identify (accuracy, cost) pair reporting (METR HCAST as canonical operationalization) as the structural fix rather than a different headline metric.

## Prerequisites & callback

Two earlier lessons are load-bearing today. **[D-9](/lesson/9)** (GSM8K, MATH, PRM800K) introduced cons@$N$ self-consistency (Wang et al. 2022) as a cost-aware aggregation over CoT samples and established the right-answer-wrong-reasoning failure mode that motivates process supervision; today we extend cons@$N$ from a math-prompting trick to a default reporting axis on AIME, and the integer-match scoring rule we rely on is the same family as GSM8K's `####` convention scaled to a harder problem distribution. **[D-11](/lesson/11)** (HumanEval, LiveCodeBench) introduced the Chen et al. 2021 unbiased pass@$k$ estimator and the contamination story that motivates time-shifted releases; today we extend pass@$k$ to pass@1024 with cost on the x-axis, and AIME 2025 inherits LiveCodeBench's post-cutoff contamination property. If `acc`/`acc_norm` ([D-2](/lesson/2)), CoT prompting ([D-4](/lesson/4)), or the saturation framing ([D-7](/lesson/7)) feel hazy, skim those before continuing.

## The opening hook

Every benchmark in Weeks 1–3 reported a *single number per model*. MMLU is 89.5; HumanEval is 95.0; GPQA Diamond is 78.3. The implicit contract is that a model is a fixed mapping from inputs to outputs, and the eval measures that mapping. Sample once, score, repeat. Anything beyond that — best-of-$N$, self-consistency `maj@k`, PRM-reranked best-of-$N$ from [D-9](/lesson/9) — has historically been a methodological footnote rather than the primary axis.

That contract broke in **September 2024** with the release of OpenAI's o1 model, and it has not been re-stitched since. o1's headline AIME 2024 numbers as reported in *Learning to Reason with LLMs* (OpenAI, Sept 12, 2024):

- **GPT-4o**: 12% (≈ 1.8 / 15 problems).
- **o1, pass@1**: 74% (≈ 11.1 / 15).
- **o1, cons@64** (majority vote across 64 samples): 83% (≈ 12.5 / 15).
- **o1, best-of-1000 with a learned scoring function**: 93% (≈ 13.9 / 15).

The pass@1 jump is the headline. The pass@1 → cons@64 → best-of-1000 *trajectory* is the methodological news. A single number — *o1 = 83% on AIME 2024* — is now under-specified in a way that *o1 = 89% on MMLU* never was, because o1's accuracy is an explicit function of inference-time compute. Three months later, **o3** (announced December 20, 2024) reported **~96.7% on AIME 2024** and **25.2% on FrontierMath** (the Glazer et al. 2024 frontier overlay we'll meet below) — but the o3 announcement also introduced explicit "low / medium / high" reasoning-effort settings, making "*which o3?*" a per-row variable on the leaderboard.

Today's lesson is the methodological consequence of that shift. The single-scalar reporting convention from [D-1](/lesson/1) stops being adequate the moment the model itself has a tunable compute knob. Accuracy becomes a *curve* over inference-time tokens, and any honest comparison has to put **tokens (or dollars) on the x-axis**. We work the AIME mechanics, the FrontierMath difficulty ceiling, the o1 system card's cost-axis reporting methodology, and the Pareto reframing of what a benchmark report should now look like.

## The reasoning-model lineage

```mermaid
flowchart LR
    O1["o1 (Sep 2024)<br/>OpenAI<br/>internal long CoT"] --> O3["o3 (Dec 2024)<br/>OpenAI<br/>+ low/med/high effort"]
    O3 --> R1["DeepSeek R1 (Jan 2025)<br/>open-weights<br/>RL-trained reasoning"]
    R1 --> CL["Claude 3.7 Sonnet<br/>extended thinking (Feb 2025)<br/>hybrid toggle"]
    CL --> G25["Gemini 2.5 Pro (Mar 2025)<br/>thinking-by-default"]

    style O1 fill:#fee
    style G25 fill:#efe
```

Five releases in seven months turned "reasoning model" from a single OpenAI artifact into a class. They share three properties that distinguish them from prior chat models:

1. **An internal long chain-of-thought** that consumes substantial output tokens *before* the user-visible answer. [D-4](/lesson/4) framed CoT as a prompting trick; here it becomes a model property — the model is trained, typically with reinforcement learning from outcome rewards (DeepSeek R1's recipe is the cleanest published example) or from process supervision ([D-9](/lesson/9)'s PRM800K was a precursor signal), to produce extended internal reasoning regardless of the prompt.
2. **A tunable reasoning-effort budget**. o3's `reasoning_effort: low | medium | high`, Claude's extended-thinking on/off, Gemini's thinking budget knob — all expose inference-time compute as a *first-class API parameter*. The same model is now multiple points on a curve.
3. **Substantial inference cost**. A single hard AIME problem under o1 can consume tens of thousands of internal-reasoning tokens; o3-high configurations reportedly used hundreds of thousands per problem on ARC-AGI. The cost gap between *answer* and *correct answer* is now a non-trivial fraction of a deployment budget.

The capability number ([D-4](/lesson/4) was 56.6% → 73.9% on BBH from a *prompt change*) is now decoupled from the *cost* of producing it. That decoupling is what this lesson is about.

> *Note on rapidly-drifting numbers.* The release sequence above is verified to early 2026; specific frontier scores quoted later in this lesson are version-locked to the cited reports and will drift. Per [D-7](/lesson/7)'s saturation caveat, treat absolute numbers as time-stamped data points, not durable claims.

## Anchor: AIME 2024/2025

**Citation.** Mathematical Association of America. *American Invitational Mathematics Examination* (AIME I and II, annual administration, 2024 and 2025 papers). MAA: https://maa.org/maa-invitational-competitions/ . Reference solutions and discussion: https://artofproblemsolving.com/wiki/index.php/American_Invitational_Mathematics_Examination .

The **American Invitational Mathematics Examination (AIME)** is the second round of the MAA's high-school olympiad ladder (AMC 10/12 → AIME → USAMO/USAJMO). It is this lesson's primary anchor because its scoring rule is essentially noise-free at the frontier: every answer is an integer in $\{000, 001, \ldots, 999\}$, scoring is exact match, and there is no LaTeX-equivalence checker between the model and the score. When you spend tens of thousands of inference-time tokens per problem, you do not want the scoring rule itself to be a source of variance.

### Construction

- **15 problems, 3 hours**, no calculator, administered annually by the MAA.
- **Each answer is an integer from 000 to 999.** No multiple choice; no partial credit; no equivalence checking. The answer space is exactly $1{,}000$ values per problem, so random guessing scores $1/1000 = 0.1\%$ per problem.
- **AIME I and AIME II** are administered two weeks apart each year — students take *one*, with the other available as a make-up. Both are valid, comparable instruments; the **AIME-as-LLM-benchmark** convention treats each year's I+II as a 30-problem set (sometimes reported per-paper; both are common).
- Recent dates: **AIME 2024** — AIME I on Jan 31, 2024; AIME II on Feb 1, 2024 (the MAA scheduled them on consecutive days that year). **AIME 2025** — AIME I on Feb 6, 2025; AIME II on Feb 12, 2025.

GSM8K saturated at 95%+ by 2024; MATH-500 sits near 90–96% on frontier models in early 2026 ([D-9](/lesson/9)). AIME is what's left of *checkable, integer-answer math* with meaningful headroom. The 2024/2025 papers were also released *after* most reasoning-model training cutoffs — AIME 2024 in late January, AIME 2025 in early February — which is a contamination property AIME inherits from the time-shifted continuous-update logic of LiveCodeBench ([D-11](/lesson/11)). A vendor reporting "o3 on AIME 2025" is reporting on problems the model demonstrably did not see at training time, *provided* the cutoff is correctly disclosed.

### Example item — AIME

A canonical AIME problem is one of the 15 from a given paper. AIME 2024 Problem 1 (publicly archived on Art of Problem Solving):

> Every morning, Aya goes for a $9$-kilometer-long walk and stops at a coffee shop afterwards. When she walks at a constant speed of $s$ kilometers per hour, the walk takes her $4$ hours, including $t$ minutes spent in the coffee shop. When she walks at $s+2$ kilometers per hour, the walk takes her $2$ hours and $24$ minutes, including $t$ minutes spent in the coffee shop. Suppose Aya walks at $s + \tfrac{1}{2}$ kilometers per hour. Find the number of minutes the walk takes her, including the $t$ minutes spent in the coffee shop.
>
> **Answer space:** integer in $\{0, 1, \ldots, 999\}$.
> **Gold answer:** $204$.

The model's job is to produce one integer in $[0, 999]$. There is no LaTeX equivalence checking, no boxed-expression extraction, no symbolic normalization — the scoring rule is `int(model_output) == 204`. That spartan-ness is exactly why AIME survives at the frontier where MATH and GSM8K saturated: at very long CoTs (tens of thousands of tokens), the *grader* itself stops being a source of variance.

### Scoring rule

Integer exact match, identical in spirit to GSM8K's `####`-suffix integer match ([D-9](/lesson/9)). For each problem, the model's final answer $\hat a \in \{0, \ldots, 999\}$ is compared to the gold $a^\star$; the per-problem indicator is $\mathbb{1}[\hat a = a^\star]$. There is no answer-extraction problem of the MATH/`\boxed{...}` variety, and no equivalence-checker disagreement between paper implementations to confound cross-paper comparisons. AIME's clean scoring rule is exactly why it became the post-MATH frontier math anchor.

### Mechanics: how a chain-budget-instrumented harness runs it

Because reasoning models report multiple aggregations per row (pass@1, cons@$N$, best-of-$k$ + reranker), the canonical AIME harness pattern is benchmark-native rather than `lm-eval` task-pinned. A typical run:

```bash
# Schematic; specifics vary by lab. Each row in the output is a triple
# (model, effort_setting, aggregation) → accuracy on AIME 2024.
for effort in low medium high; do
  for n in 1 64 1024; do
    python run_aime.py \
      --model "o3-2024-12-20" \
      --reasoning_effort "$effort" \
      --n_samples "$n" \
      --aggregator "cons@N" \
      --year 2024 \
      --record_tokens \
      --out "aime2024_o3_${effort}_n${n}.jsonl"
  done
done
```

The `--record_tokens` flag is the methodological keystone: every sampled chain logs its prompt-plus-completion-token count, and per-problem accuracy is reported alongside per-problem expected token usage so that the Pareto comparison below is well-defined.

### Frontier numbers (drift caveat)

A snapshot of the public AIME 2024 trajectory:

| Model | Reported AIME 2024 | Notes | Source |
| --- | --- | --- | --- |
| GPT-4o | ~12% | Single sample. Pre-reasoning-model baseline. | OpenAI o1 launch post (Sept 2024) |
| o1 (pass@1) | ~74% | Single sample, full internal CoT. | OpenAI o1 launch post |
| o1 (cons@64) | ~83% | Majority vote across 64 samples. | OpenAI o1 launch post |
| o1 (best-of-1000, learned scorer) | ~93% | Reranked, not just voted. | OpenAI o1 launch post |
| o3 | ~96.7% | Reasoning-effort high; specific setting per OpenAI announcement. | OpenAI o3 launch (Dec 2024) |

The 12% → 96.7% gap across one model generation is the largest single-benchmark single-year jump in the curriculum's coverage. The [D-7](/lesson/7) saturation framing applies: AIME 2024 may be approaching its useful-ranking ceiling for the strongest reasoning models, and AIME 2025 + 2026 are the natural successors. Per [D-7](/lesson/7), *and* per the inference-time-scaling story below, "approaching saturation" now also means "approaching the regime where small accuracy gains require disproportionate compute." A 96.7% on AIME 2024 is a different number depending on whether o3-high used $10^4$ or $10^6$ tokens to produce it — and OpenAI's announcement reported both an accuracy and a *cost band* per evaluation, which is the methodological seed of this lesson.

### Companion: FrontierMath (Glazer et al. 2024)

**Citation.** Glazer, E., Erdil, E., Besiroglu, T., Chicharro, D., Chen, E., Gunning, A., Olsson, C. F., Denain, J.-S., Ho, A., Santucci, E. de O., Järviniemi, O., Barnett, M., Sandler, R., Vrzala, M., Sevilla, J., Ren, Q., Pratt, E., Levine, L., Barkley, G., Stewart, N., Grechuk, B., Grechuk, T., Enugandla, S. V., & Wildon, M. (2024). *FrontierMath: A Benchmark for Evaluating Advanced Mathematical Reasoning in AI.* arXiv:2411.04872.

FrontierMath is the **difficulty-ceiling overlay** for the AIME story. Where AIME problems are high-school olympiad-level (still solvable in the 3-hour window by very strong contest students), FrontierMath problems are **research-level**, drawn from across modern mathematics — number theory, real and complex analysis, algebraic geometry, category theory, combinatorics, and adjacent areas.

- **350 original problems total**, structured as a base set of **300 problems** across Tiers 1–3 plus an expansion set of **50 Tier-4 problems** described as "exceptionally difficult."
- **Authored and vetted by 60+ expert mathematicians**, including IMO problem-setters and Fields medalists. The construction parallels GPQA's domain-expert framing ([D-7](/lesson/7)) but at a substantially harder difficulty band.
- **Expert-only solvability claim**: Glazer et al. argue that even strong research mathematicians typically need *multiple hours* per problem in their own subfield, and *days or weeks* for problems outside it. This is the load-bearing claim distinguishing FrontierMath from "another hard math benchmark" — the difficulty floor is calibrated to professional research rather than student competition.
- **Held-out**: the dataset is *not* publicly released as a downloadable JSONL. Evaluation runs through Epoch AI's infrastructure on a held-out problem set, with a small public sample. Structurally similar to ARC-AGI's private-set design ([D-6](/lesson/6)/[D-7](/lesson/7)), and the contamination-resistance move the benchmark needs to remain a meaningful difficulty-ceiling instrument as reasoning models close in on it.
- **Automated, exact-answer scoring**: problems are designed to have **definitive numerical or symbolic answers** that are checkable without judge models — the same kind of integer/symbolic match as AIME, scaled up to harder objects (e.g., specific numbers of solutions in a Diophantine system; specific Galois-group orders).

The frontier number that anchored the early FrontierMath story:

> Glazer et al. report (Nov 2024) that **state-of-the-art models solve under 2%** of FrontierMath problems, against a backdrop where AIME 2024 was already near 83% under cons@64.

That gap — 83% on AIME 2024 vs. <2% on FrontierMath, *for the same model class* — is what makes FrontierMath the right overlay for [D-25](/lesson/25). The AIME ceiling is one Pareto frontier; the FrontierMath ceiling is another, much further away. A reasoning model's "math capability" is not a single point but a profile across difficulty bands. The o3 announcement (Dec 2024) reported **~25.2% on FrontierMath**, which the Glazer et al. team and OpenAI both characterized as a substantial jump while emphasizing that the bulk of the benchmark remained out of reach. That 2% → 25% jump in two months is the *open* story this benchmark exists to track; AIME 2024 is the *closed* story.

> *Caveat — funding disclosure.* Public discussion in late 2024 and early 2025 noted that OpenAI provided funding for FrontierMath's construction, which was disclosed only after the o3 announcement. This is methodologically relevant — the benchmark is *not* a third-party-only artifact in the sense GPQA is — without invalidating the technical construction. Treat FrontierMath the way you treat any vendor-funded benchmark: the construction details matter more than the headline number, and the held-out structure carries most of the credibility weight.

#### Example item — FrontierMath

FrontierMath items are research-level math problems with definitive symbolic or numerical answers. The Glazer et al. 2024 paper released a small public-sample set; the rest is held out. A representative public sample (Glazer et al. 2024, Appendix; paraphrased to fit the line budget):

> Let $f(x) = x^4 - 6x^3 + 11x^2 - 6x + 1$. Compute the smallest positive integer $n$ such that $f(n)$ is the square of a positive integer that is not equal to $f(n)$ itself — i.e., $\sqrt{f(n)}$ is a positive integer strictly less than $f(n)$. Provide the answer as an integer.
>
> **Answer:** a single non-negative integer (held out for the public-sample evaluator; OpenAI / Epoch AI report results against this exact-answer match).

The construction guarantees an exact-answer match — every problem ships with a single definitive answer (integer, rational, finite tuple, or canonical symbolic form), checkable by a Python evaluator without an LLM judge. That property is what lets FrontierMath sit alongside AIME in the same anchor: both score by exact match, both eliminate the equivalence-checker confound that plagues open-form math scoring ([D-9](/lesson/9)). Where they differ is the difficulty floor — FrontierMath problems require research-mathematics tools (Galois theory, advanced number theory, modern algebraic geometry) that AIME does not.

### Companion: o1 system card (OpenAI 2024)

**Citation.** OpenAI. (2024). *OpenAI o1 System Card.* Initially released September 12, 2024; substantially revised version published December 5, 2024 (and republished as arXiv:2412.16720). https://openai.com/index/openai-o1-system-card/ ; https://cdn.openai.com/o1-system-card.pdf ; https://cdn.openai.com/o1-system-card-20241205.pdf .

The o1 system card is this lesson's **methodological anchor** rather than a benchmark anchor. It is the document where the field's largest lab first published a deliberate framing of accuracy *as a function of inference-time compute*. Three load-bearing reporting moves:

1. **Pass@1 alongside cons@$N$ as default reporting.** Where prior model cards reported a single accuracy per benchmark, the o1 system card reports both pass@1 (single sample) *and* a majority-vote / consensus number across $N$ samples ($N = 32$ or $N = 64$ depending on the eval). This makes the *sampling-budget axis* visible at the row level: "o1 = 83% on AIME 2024" is reported as "*o1, AIME 2024, cons@64 = 83%; pass@1 = 74%*", which carries the cost dimension by structure.
2. **Test-time compute scaling curves.** The accompanying *Learning to Reason with LLMs* post (and the corresponding figures referenced in the system card) plot accuracy versus inference-time compute on log-scaled x-axes for AIME and several other benchmarks. The relationship is roughly **log-linear** over multiple orders of magnitude — doubling inference compute buys a roughly constant accuracy increment in absolute percentage points, until task-specific ceilings are approached. The shape of the curve matters as much as any single point on it.
3. **Capability-vs-cost framing in safety review.** The system card's safety sections evaluate dangerous-capability proxies (cf. [D-21](/lesson/21) WMDP) at *multiple inference-effort settings*, recognizing that a model that can be coaxed into hazardous output at $10^6$ tokens of internal reasoning is a different deployment risk from one that cannot — even if both score the same at pass@1.

The combination of these three moves is what makes the o1 system card the right anchor for the cost-axis story. Subsequent system cards (o3, Claude 3.7 Sonnet, Gemini 2.5 Pro, DeepSeek R1) have either followed the same template or have been criticized in public review for *not* doing so. The methodological norm being established is: **for a reasoning model, accuracy without an inference-cost axis is an unfinished report**.

#### Example item — o1 system card report row

The system card's reporting unit is one *row* of the capability table: a model, a benchmark, a sampling regime, and the resulting accuracy. The o1 release reports each AIME 2024 number along this shape (transcribed verbatim from the o1 launch post and the December 2024 system card revision):

```
Benchmark:           AIME 2024 (30 problems: AIME I + AIME II)
Model:               o1
Sampling regime:     pass@1, full internal CoT
Accuracy:            74.4%
----------
Benchmark:           AIME 2024
Model:               o1
Sampling regime:     cons@64 (majority vote over 64 samples)
Accuracy:            83.3%
----------
Benchmark:           AIME 2024
Model:               o1
Sampling regime:     best-of-1000 with learned scorer
Accuracy:            ~93%
```

The *row* is the unit, not the model. A single number ("o1 = 83.3% on AIME 2024") is under-specified without its sampling regime; three rows for the same `(model, benchmark)` pair is the methodological move the system card normalizes. The 19-point spread between pass@1 and best-of-1000 on the same checkpoint is the cost dimension made legible: the headline you cite is also a budget you are paying.

## ⏵ Check yourself — capability profile

A frontier-lab system card reports one model's math capability as "AIME 2024 cons@64 = 88%". Another lab's card reports "FrontierMath = 18%" for a different model. Why does the lesson argue that you cannot rank "math capability" between these two models from these two numbers alone, and what is the minimum extra disclosure that would let you?

<details>
<summary>Show answer</summary>

The two benchmarks sit at radically different difficulty bands — AIME at high-school olympiad level, FrontierMath at research level — so a high score on one and a moderate score on the other do not compose into a single ranking. The lesson's framing is that math capability is a *profile* across difficulty bands, not a scalar, and AIME + FrontierMath together cover meaningfully more of the relevant frontier than either alone. The minimum extra disclosure that would let you compare the two models would be (a) both numbers on the same benchmark for both models — at minimum, both models' AIME 2024 cons@64 *and* both models' FrontierMath — and (b) a cost band per number, since "AIME cons@64 = 88%" at $10^4$ tokens per problem is a different capability from the same headline at $10^6$ tokens. The single-axis comparison is the structurally under-specified move; the difficulty-profile + cost-band joint disclosure is the comparable one.

</details>

## The cost-axis Pareto reframing

This is the methodological core of the lesson. The argument is sharp.

### Why a single scalar accuracy is no longer sufficient

A standard accuracy report — "Model X scores 83% on AIME 2024" — is well-defined when the model is a *fixed* function: one prompt, one sample, one answer. The 83% has an implicit cost: roughly the input-prompt-plus-answer-tokens that any model would use on this benchmark. Cross-model comparison at fixed cost is then automatic, because all models are spending similar token budgets.

For reasoning models that condition heavily on internal CoT, *this assumption fails*. Three concrete failures:

1. **Same accuracy, different cost.** Model A reaches 83% on AIME 2024 at ~10k tokens per problem; Model B reaches 83% at ~100k tokens per problem. The single-scalar leaderboard treats them as tied; the deployment economics are 10× apart.
2. **Same model, different accuracy.** o3 with `reasoning_effort: low` and o3 with `reasoning_effort: high` produce dramatically different AIME 2024 numbers from the same checkpoint. "o3 = 96.7% on AIME" is genuinely under-specified without an effort setting and a token-budget bound.
3. **Cost-gaming the score.** A vendor optimizing for headline numbers can scale inference budget to whatever level wins the leaderboard, then report the resulting accuracy as a model property. We name this pattern explicitly in the Goodhart sub-thread below.

The remedy is to report **(accuracy, cost) pairs**, not accuracies alone — or, at the limit, full **accuracy-vs-tokens curves** on a log-scaled x-axis.

### The conceptual shift: capability number → capability curve

```mermaid
flowchart LR
    A[Pre-reasoning era<br/>Capability = single number] --> B[Reasoning era<br/>Capability = curve over compute]
    B --> C[Pareto frontier:<br/>compare curves, not points]
    C --> D[Headline = curve summary<br/>knee-of-curve / cost@accuracy<br/>or area-under-curve]

    style A fill:#fee
    style B fill:#efe
    style D fill:#efe
```

Concretely: a model's AIME 2024 result is now best summarized as a function $a(c)$ mapping inference-cost $c$ (in tokens or dollars) to expected accuracy, with sampling at $T > 0$ to expose variance. Two models' Pareto-frontier comparison is then "*does $a_1(c) > a_2(c)$ for all $c$ in the deployment-relevant range, or do the curves cross?*" — a richer question than "which is the bigger number."

### A schematic accuracy-vs-tokens curve

The empirical shape across multiple labs and benchmarks is consistent: roughly log-linear in the middle of the range, with floor and ceiling effects at the extremes. A schematic for AIME 2024-class problems (illustrative; not a fit to specific reported numbers — see the o1 system card for actual curves):

```
Accuracy (%)
  100 |                                  ......_______ ceiling regime
      |                            ....''
   90 |                       ..''
      |                   .''
   80 |                .''       <-- log-linear regime
      |             .''          (each 2x compute  ~+5pp)
   70 |          .''
      |        .'
   60 |     .'
      |   .'                         <-- threshold regime
   50 | .'                           (compute below floor: model
      |.                              cannot solve at all)
   40 +'-----+------+------+------+------+------+----- log10(tokens)
            3      4      5      6      7      8
                    ^             ^             ^
                    |             |             |
                pass@1, low    cons@64        best-of-1024
                effort         medium         + reranker
```

Three regimes are visible:

- **Threshold (low compute).** Accuracy is below the floor where the chain-budget can support multi-step reasoning; output is essentially random or pattern-matched. Below this, *more* compute does not help — the model lacks the substrate.
- **Log-linear (mid compute).** The regime the o1 system card documents most clearly: accuracy rises roughly linearly in $\log_2(\text{tokens})$. Each doubling of compute buys a roughly constant absolute-percentage-point gain. This is the regime where "*how much compute did you use?*" is the most informative single follow-up question to "*what's the accuracy?*".
- **Ceiling (high compute).** Returns diminish; the remaining problems are either above the difficulty ceiling for this model or are mislabeled in the test set (the same label-noise floor [D-9](/lesson/9) named for GSM8K). Past the knee, additional compute is wasted.

### Cost-aware metric variants

The math literature has consolidated around a few cost-aware accuracy variants. The most important to know:

**pass@$k$ (Chen et al. 2021 — [D-11](/lesson/11) anchor).** Probability that *at least one* of $k$ i.i.d. samples is correct, estimated unbiasedly as

$$
\text{pass@}k = \mathop{\mathbb{E}}_{\text{problems}} \left[ 1 - \frac{\binom{n - c}{k}}{\binom{n}{k}} \right]
$$

where $n \geq k$ samples are drawn per problem and $c$ are correct ([D-11](/lesson/11) derives this in detail). At reasoning-model scale, papers now routinely report **pass@1, pass@64, pass@1024** — the three-orders-of-magnitude span is what makes the "curve, not a number" framing concrete. Note that pass@$k$ requires a *checker* that verifies correctness without choosing among samples, which AIME's integer-match scoring provides for free.

**cons@$N$ / `maj@N` (Wang et al. 2022 self-consistency — [D-9](/lesson/9) anchor).** Sample $N$ chains at $T > 0$, take the **plurality vote** over their final answers:

$$
\hat{a}_{\text{cons}@N} = \arg\max_{a \in \mathcal{A}} \sum_{i=1}^{N} \mathbb{1}[\text{answer}(s_i) = a]
$$

where $s_1, \ldots, s_N$ are the sampled chains and $\mathcal{A}$ is the answer space (for AIME, $\{0, 1, \ldots, 999\}$). cons@$N$ scores correctness as $\mathbb{1}[\hat{a}_{\text{cons}@N} = a^\star]$ on the gold answer $a^\star$; the per-problem indicator averages over the test set. Unlike pass@$k$, cons@$N$ does *not* require an external verifier — it relies on the model's own output distribution to concentrate on the correct answer. This is the metric the o1 system card uses (`cons@64` in the AIME report) and is the natural choice when no verifier exists.

> **Worked example.** A reasoning model produces $n = 6$ independent CoT samples on a single AIME problem with gold answer $a^\star = 188$. The sampled final integers are $\{188, 41, 188, 188, 999, 188\}$, so $c = 4$ samples are correct.
>
> 1. **cons@6 (plurality vote).** Tally: $188 \to 4$, $41 \to 1$, $999 \to 1$. The plurality answer is $\hat a = 188$, which matches $a^\star$, so the per-problem cons@6 indicator is $1$.
> 2. **pass@1 (single-sample accuracy estimated from these 6 draws).** $c/n = 4/6 \approx 0.667$.
> 3. **pass@2 via the unbiased Chen et al. 2021 estimator.** With $n = 6$, $c = 4$, $k = 2$: $\binom{n - c}{k}/\binom{n}{k} = \binom{2}{2}/\binom{6}{2} = 1/15$, so pass@2 $= 1 - 1/15 = 14/15 \approx 0.933$.
> 4. **pass@4.** $\binom{2}{4} = 0$ (you cannot draw 4 wrong samples from a pool of only 2 wrong ones), so pass@4 $= 1 - 0 = 1$. Mechanically: at least one of any 4 drawn samples is guaranteed to be correct given $n - c = 2$ wrong samples available.
>
> The general lesson: pass@$k$ rewards *coverage* (one of $k$ is right) and rises monotonically in $k$, while cons@$N$ rewards *mode-concentration* (most of $N$ agree on one answer). On the same draws, cons@6 = 1 because $188$ has a 4/6 plurality, but cons@6 would have been $0$ on draws like $\{188, 41, 999, 17, 23, 56\}$ where every wrong answer is unique and $188$ has only a 1/6 plurality (still the mode, here actually tied — most implementations break ties toward the lowest integer or randomly, and a no-pluraity-winner case scores $0$).

**Cost-bounded variants.** A more honest reporting convention pairs accuracy with a token bound: **acc@$B$ tokens**, the expected per-problem accuracy when total inference is capped at $B$ tokens (across however many samples the model chooses to generate). This is the metric that most directly reflects a deployment budget. METR's HCAST suite ([D-28](/lesson/28) forward) operationalizes this exactly: for each model, evaluation runs are capped at a token budget (16M tokens per task for o3/o4-mini-class models, 8M for DeepSeek R1, 2M for smaller models in METR's published reports), and the scaffold exposes the remaining budget to the agent so that *cost-aware behavior* is part of the eval.

The relationship at $T \to 0$ greedy decoding is that pass@1 = cons@1 = the deterministic accuracy. At $T > 0$ they diverge — pass@$k$ rewards coverage, cons@$N$ rewards mode-concentration — and the right choice depends on whether you have a checker.

## ⏵ Check yourself — cons@$N$ vs. pass@$k$

A model produces 5 sampled chains on an AIME problem. The final integers are $\{42, 42, 17, 42, 600\}$. The gold answer is $42$. Compute the per-problem cons@5 indicator and the per-problem pass@2 estimate (Chen et al. 2021 unbiased), and explain in one sentence why the two metrics tell different stories about the same draws.

<details>
<summary>Show answer</summary>

cons@5: tally is $42 \to 3$, $17 \to 1$, $600 \to 1$; plurality $\hat a = 42$ matches gold, so the indicator is $1$. pass@2: $n = 5$, $c = 3$ (the three $42$ samples), $k = 2$, so $\binom{n-c}{k}/\binom{n}{k} = \binom{2}{2}/\binom{5}{2} = 1/10$, giving pass@2 $= 9/10 = 0.9$. The two stories: cons@5 says "the model concentrates its mode correctly under voting," pass@2 says "if a checker can pick the right one out of 2 samples, you're right 90% of the time" — coverage vs. mode-concentration, which matters because AIME's integer scoring lets you compute either, but a benchmark with no checker can only honestly report cons@$N$.

</details>

## Goodhart sub-thread

The Goodhart frame from [D-1](/lesson/1), [D-6](/lesson/6), [D-11](/lesson/11), [D-17](/lesson/17), [D-22](/lesson/22) has a specific instantiation in the cost-axis era worth naming explicitly.

When a benchmark reports accuracy *without* cost, the inference budget becomes a free variable that vendors can scale to whatever level wins. The pattern is:

1. **Vendor A reports model $M$ at cons@64 = 83%.**
2. **Vendor B reports model $M'$ at "best-of-1024 + learned reranker" = 93%.**
3. **The leaderboard** shows $M' > M$ by 10 points.
4. **In production** at a fixed user-facing latency budget, $M$ may strictly dominate $M'$ because $M'$'s 93% is purchased with 16× more compute per query than the deployment can afford.

The leaderboard treats $M'$ as the better model; the deployment treats $M$ as the better model. The leaderboard number was the target; cost was the slack variable; Goodhart's Law took its standard course. The fix is *not* a different headline metric (any single number recreates the same dynamic). The fix is **structural**: report (accuracy, cost) pairs by default, and treat any cost-stripped headline with the same skepticism [D-7](/lesson/7) advised for benchmarks at saturation. The METR HCAST move — pre-declared per-model token budgets exposed to the agent — is an operationalization of that fix at the agent-eval level.

This is the same Goodhart pattern as the [D-11](/lesson/11) contamination story (HumanEval became a target, leaked into pretraining, score inflated) and the [D-21](/lesson/21) unlearning-target story (WMDP became a target, models learned to fail on its surface form), with the optimization pressure routed through inference compute rather than training data. The structure is identical; only the slack variable differs. The classification across the curriculum: [D-6](/lesson/6) / [D-15](/lesson/15) / [D-17](/lesson/17) / [D-22](/lesson/22) / [D-28](/lesson/28) carry the foregrounded Goodhart treatment; [D-2](/lesson/2) / [D-11](/lesson/11) / [D-20](/lesson/20) / [D-24](/lesson/24) / **[D-25](/lesson/25)** are sub-thread treatments that name a domain-specific instance of the same underlying mechanism.

## Why this changes the rest of Week 4

> **Safety researcher's note.** Reasoning models reshape the safety landscape in three specific ways the cost-axis frame helps name. First, **dangerous-capability evaluation ([D-21](/lesson/21))** has to be re-run at multiple effort settings — a model that refuses or fails at low effort and complies at high effort is a different deployment risk than either alone, and the system-card convention of single-effort dangerous-capability scores is straightforwardly insufficient for this generation. Second, **CoT faithfulness ([D-4](/lesson/4), [D-9](/lesson/9))** becomes more pressing, not less: the long internal chains that produce the capability gain are *also* the visible-but-not-necessarily-faithful surface that safety claims have started to lean on. Anthropic's 2025 *Reasoning Models Don't Always Say What They Think* and the broader unfaithful-CoT line (Turpin et al. 2023) argue that high-capability reasoning models can produce externally legible chains whose content does not drive the answer, and the optimization pressure to make chains *look* faithful (because that is what the system card displays and the safety reviewer reads) is exactly the Goodhart-on-transparency concern [D-9](/lesson/9)'s safety note named. Third, **the cost axis itself is a safety-relevant lever.** A capability that requires $10^6$ tokens to elicit is a *more contained* threat than one elicitable at $10^4$; deployment policies can in principle be specified in terms of *capability-at-budget* rather than capability-at-all. METR's HCAST framing and Anthropic's RSP / OpenAI's Preparedness frameworks have started to incorporate this implicitly. The methodological shift this lesson documents — accuracy is a curve, not a number — is a safety-relevant shift, not just an economic one.

## Cross-references

**Backward.**
- [D-1](/lesson/1) — eval-as-pipeline framing extends with inference compute as a new free variable on the benchmark side rather than only on the training side.
- [D-7](/lesson/7) — saturation framing applies: AIME 2024 is approaching the regime where ranking signal degrades, and AIME 2025/2026 are the natural successors.
- [D-9](/lesson/9) — cons@$N$ self-consistency (Wang et al. 2022) and the integer/`####`-style exact-match scoring rule are the precursors that today's AIME story extends.
- [D-11](/lesson/11) — pass@$k$ from HumanEval is the cost-axis metric this lesson scales to pass@1024; the LiveCodeBench post-cutoff release pattern is the contamination property AIME 2025 inherits.

**Forward.**
- [D-26](/lesson/26) — web-agent benchmarks (WebArena, GAIA, AgentDojo) multiply the cost axis by adding tool calls and wall-clock minutes; today's framing is the prerequisite for [D-26](/lesson/26)'s metrics.
- [D-28](/lesson/28) — METR's HCAST autonomy suite operationalizes acc@$B$ tokens with pre-declared per-model token budgets exposed to the agent, and is the canonical (capability, cost) Pareto framing for autonomous tasks.
- [D-21](/lesson/21) — dangerous-capability evaluation (WMDP) inherits the multi-effort reporting requirement: a capability elicitable only at $10^6$ tokens is a different deployment risk from one elicitable at $10^4$.

## Takeaways

1. **Reasoning models are a class** (o1 Sept 2024 → o3 Dec 2024 → DeepSeek R1 Jan 2025 → Claude extended thinking Feb 2025 → Gemini 2.5 Pro Mar 2025) defined by long internal CoT, tunable reasoning-effort budgets, and substantial inference cost. CoT stops being a prompting trick ([D-4](/lesson/4)) and becomes a model property. (LO 1)
2. **AIME 2024/2025** (15 integer-answer problems per AIME I + II, answer space 0–999, exact-match scoring) is the post-MATH frontier math anchor: clean scoring, meaningful headroom into 2024, post-cutoff for most reasoning models. Reported trajectory: GPT-4o ~12% → o1 pass@1 ~74% → o1 cons@64 ~83% → o3 ~96.7% on AIME 2024. (LO 2)
3. **FrontierMath** (Glazer et al. 2024, arXiv:2411.04872, 350 expert-authored research-level problems, held-out, automated exact-answer scoring) is the difficulty-ceiling overlay. Frontier <2% at release; o3 ~25.2% in December 2024. The benchmark exists where AIME has saturated; together with AIME it reports a capability *profile*, not a scalar. (LO 2)
4. **The o1 system card** (OpenAI Sept 2024 / Dec 2024 revision) is the methodological anchor: pass@1 alongside cons@$N$ as default reporting, log-scaled accuracy-vs-tokens curves, multi-effort safety evaluation. The norm being established: for a reasoning model, accuracy without an inference-cost axis is an unfinished report. (LO 4)
5. **Capability is now a curve, not a number.** A model's AIME-class accuracy is a function $a(c)$ of inference cost, with three regimes — threshold floor, log-linear midrange, ceiling — and Pareto-frontier comparison across models replaces single-scalar comparison. (LO 4)
6. **Cost-axis Goodhart sub-thread**: when accuracy is reported without cost, vendors can scale inference compute to whatever level wins the leaderboard. The leaderboard number rises; the deployment-relevant per-fixed-budget capability does not. The structural fix is (accuracy, cost) pair reporting; METR HCAST's pre-declared token budgets are the canonical operationalization. The minimum follow-up question to a cost-stripped headline is "*which inference-time compute and aggregation produced this number?*" (LO 5, LO 6)
7. **pass@$k$, cons@$N$, acc@$B$ tokens** are the cost-aware metric family. pass@$k$ requires a checker ([D-11](/lesson/11) anchor); cons@$N$ does not ([D-9](/lesson/9) anchor); acc@$B$ binds total compute. The choice depends on whether a verifier exists and what deployment quantity is being predicted. (LO 3)

## Glossary

- **pass@1024**: extension of the Chen et al. 2021 unbiased pass@$k$ estimator to $k = 1024$ samples, the upper end of the cost-axis span reported by frontier reasoning-model evaluations. Probability that at least one of 1024 i.i.d. samples is correct, estimated from a larger draw $n \geq 1024$ [introduced D-11 (pass@$k$) · extended D-25](/lesson/11).
- **cons@$N$**: plurality-vote aggregation over $N$ sampled CoT chains, $\hat a_{\text{cons}@N} = \arg\max_a \sum_i \mathbb{1}[\text{answer}(s_i) = a]$; per-problem indicator is $\mathbb{1}[\hat a_{\text{cons}@N} = a^\star]$. The o1 system card's default aggregation alongside pass@1 [introduced D-9 (Wang et al. 2022) · reused D-25](/lesson/9).
- **reasoning-effort budget**: API-exposed inference-time compute knob (`reasoning_effort: low | medium | high` for o3, extended-thinking on/off for Claude 3.7, thinking-budget for Gemini 2.5 Pro) that makes a single checkpoint multiple points on a capability curve [introduced D-25](/lesson/25).
- **accuracy-vs-cost Pareto frontier**: the curve $a(c)$ of expected accuracy vs. inference cost $c$ (tokens or dollars), used in place of a scalar accuracy when the model has a tunable compute knob; comparison across models becomes "*does $a_1(c) > a_2(c)$ for all $c$ in range?*" rather than which number is bigger [introduced D-25](/lesson/25).
- **log-linear regime**: the midrange of the accuracy-vs-tokens curve where $a(c) \approx \alpha \log_2(c) + \beta$, so each doubling of inference compute buys a roughly constant absolute-percentage-point gain. Bounded below by the threshold floor and above by the task ceiling [introduced D-25](/lesson/25).
- **acc@$B$ tokens**: expected per-problem accuracy under a total inference token cap $B$ across however many samples the model generates; the cost-bounded variant of accuracy that most directly reflects deployment budget. METR HCAST's per-model pre-declared budgets are the canonical operationalization [introduced D-25 · extended D-28](/lesson/25).
- **FrontierMath**: 350 expert-authored research-level math problems across number theory, analysis, algebraic geometry, category theory, combinatorics, and adjacent areas; held-out via Epoch AI infrastructure; automated exact-answer scoring; the difficulty-ceiling overlay for the AIME story. Frontier <2% at release (Nov 2024), o3 ~25.2% (Dec 2024) [introduced D-25](/lesson/25).
- **test-time compute scaling**: the empirical phenomenon that reasoning-model accuracy rises monotonically in inference-time compute over multiple orders of magnitude, with three regimes (threshold floor / log-linear midrange / ceiling); the property whose existence is the load-bearing reason for the cost-axis reporting move [introduced D-25](/lesson/25).

## References

- **Anchor — AIME 2024.** Mathematical Association of America. *2024 AIME I & II competitions.* https://maa.org/maa-invitational-competitions/ ; AoPS wiki: https://artofproblemsolving.com/wiki/index.php/American_Invitational_Mathematics_Examination
- **Anchor — AIME 2025.** Mathematical Association of America. *2025 AIME I (Feb 6, 2025) and AIME II (Feb 12, 2025).* AoPS: https://artofproblemsolving.com/wiki/index.php/2025_AIME_I
- **Anchor — methodological framing.** OpenAI. (2024). *OpenAI o1 System Card.* Sept 12, 2024 (https://cdn.openai.com/o1-system-card.pdf) and Dec 5, 2024 revision (https://cdn.openai.com/o1-system-card-20241205.pdf ; arXiv:2412.16720). Companion post: *Learning to Reason with LLMs.* https://openai.com/index/learning-to-reason-with-llms/
- **Harness.** AIME and FrontierMath are run via benchmark-native chain-budget-instrumented harnesses (per-sample token logging, per-aggregation rows in the result table). FrontierMath evaluation runs through Epoch AI infrastructure on a held-out set; project page: https://epoch.ai/frontiermath . Public AIME runners log token usage alongside accuracy; canonical pattern shown in the Anchor mechanics block above.
- **Secondary — FrontierMath.** Glazer, E., Erdil, E., Besiroglu, T., Chicharro, D., Chen, E., Gunning, A., et al. (2024). *FrontierMath: A Benchmark for Evaluating Advanced Mathematical Reasoning in AI.* arXiv:2411.04872. https://arxiv.org/abs/2411.04872
- **Secondary — o3 announcement.** OpenAI. (Dec 20, 2024). *Introducing OpenAI o3 and o4-mini.* Initial coverage: https://openai.com/index/introducing-o3-and-o4-mini/
- **Secondary — DeepSeek R1.** DeepSeek-AI. (Jan 20, 2025). *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning.* arXiv:2501.12948. https://arxiv.org/abs/2501.12948
- **Secondary — Claude extended thinking.** Anthropic. (Feb 2025). *Claude 3.7 Sonnet and Claude Code.* https://www.anthropic.com/news/claude-3-7-sonnet
- **Secondary — Gemini 2.5 Pro (thinking).** Google DeepMind. (Mar 2025). *Gemini 2.5: Our most intelligent AI model.* https://blog.google/technology/google-deepmind/gemini-model-thinking-updates-march-2025/
- **Secondary — self-consistency / cons@$N$.** Wang, X., Wei, J., Schuurmans, D., Le, Q., Chi, E., Narang, S., Chowdhery, A., & Zhou, D. (2022). *Self-Consistency Improves Chain of Thought Reasoning in Language Models.* ICLR 2023. arXiv:2203.11171. https://arxiv.org/abs/2203.11171
- **Secondary — pass@$k$ ([D-11](/lesson/11) cross-reference).** Chen, M., Tworek, J., Jun, H., Yuan, Q., et al. (2021). *Evaluating Large Language Models Trained on Code.* arXiv:2107.03374. https://arxiv.org/abs/2107.03374
- **Secondary — cost-aware autonomy eval ([D-28](/lesson/28) forward).** METR. *HCAST: Human-Calibrated Autonomy Software Tasks.* arXiv:2503.17354. https://arxiv.org/abs/2503.17354 ; project page: https://metr.org/hcast.pdf ; o3/o4-mini evaluation report: https://evaluations.metr.org/openai-o3-report/
- **Secondary — CoT faithfulness ([D-4](/lesson/4)/[D-9](/lesson/9) cross-reference).** Turpin, M., Michael, J., Perez, E., & Bowman, S. R. (2023). *Language Models Don't Always Say What They Think: Unfaithful Explanations in Chain-of-Thought Prompting.* NeurIPS 2023. arXiv:2305.04388. https://arxiv.org/abs/2305.04388

## Quiz

**Q1.** A model is sampled $n = 10$ times on an AIME 2024 problem and $c = 4$ samples produce the correct integer answer. Using the unbiased Chen et al. 2021 estimator, what is pass@2 for this problem?

- A. $1 - \binom{6}{2}/\binom{10}{2} = 2/3 \approx 0.667$
- B. $1 - (1 - 4/10)^2 = 0.64$, the i.i.d. plug-in that ignores sampling-without-replacement and gives the asymptotic large-$n$ limit
- C. $4/10 = 0.4$, the empirical pass@1 single-sample accuracy from the same 10 draws
- D. $1 - \binom{4}{2}/\binom{10}{2} = 13/15 \approx 0.867$, computed by counting correct-pool subsets in the numerator instead of wrong-pool subsets

**Q2.** A model produces 5 sampled chains on an AIME problem. The final integers are $\{42, 42, 17, 42, 600\}$. The gold answer is $42$. What is the cons@5 score for this problem, and which property of cons@$N$ does this illustrate?

- A. $0$, because cons@$N$ requires unanimous agreement across all $N$ chains for the per-problem indicator to fire
- B. $1$, since the plurality vote $42$ (3/5) matches gold; cons@$N$ scores mode-concentration
- C. $3/5 = 0.6$, the fraction of chains whose final integer matches the gold; cons@$N$ averages this fraction across the test set
- D. Undefined, because cons@$N$ is only well-posed for even $N$ so that ties cannot occur in the plurality vote on integer answers

**Q3.** A vendor reports "Model X: AIME 2024 = 89%". Which single follow-up question is most informative about whether the number is comparable to a competitor's "Model Y: AIME 2024 = 87%"?

- A. Which GPU SKU, inference framework, and quantization profile were used to run the evaluation pipeline end-to-end
- B. Which inference-time compute and aggregation (pass@1, cons@$N$, best-of-$k$) produced the 89%?
- C. Whether Model X is released under open weights or only as a closed API endpoint behind a paywall
- D. Whether the 89% averaged AIME I and AIME II separately or pooled all 30 problems into a single denominator without reweighting

**Q4.** Which of the following best describes the **structural** Goodhart pattern that single-scalar accuracy reporting creates for reasoning-model leaderboards?

- A. Reasoning models can be contaminated by direct inclusion of AIME 2024 problems in pretraining or instruction-tuning data, which inflates their reported score relative to true held-out performance
- B. Inference compute is the unmeasured slack variable; vendors scale it until the leaderboard wins, while per-fixed-budget capability does not move. Fix: report (accuracy, cost) pairs.
- C. Reasoning models always saturate any newly released math benchmark within one year because RL on outcome rewards forces near-perfect generalization to integer-answer problem distributions
- D. cons@$N$ is mathematically biased upward relative to pass@1 by exactly $\log_2 N$ percentage points, regardless of the underlying answer distribution or sampling temperature

**Q5.** FrontierMath (Glazer et al. 2024) and AIME 2024 sit at very different difficulty bands. Which best describes the methodological *complementarity* between them in this lesson's framing?

- A. They are functionally interchangeable in a reasoning-model report — AIME 2024 or FrontierMath alone is sufficient to characterize math capability across all difficulty bands of interest
- B. AIME is the near-saturation, integer-match discriminator; FrontierMath is the research-level held-out ceiling. Together they report a capability profile across difficulty bands rather than a single number.
- C. FrontierMath is a curated subset of AIME problems re-tagged at higher difficulty levels by the Glazer et al. expert panel of 60+ research mathematicians
- D. AIME problems are scored by an LLM-as-judge over free-form derivations while FrontierMath uses exact symbolic match against the gold object; the difference between the two is purely about scoring infrastructure rather than underlying difficulty

**Q6.** A reasoning model produces an accuracy-vs-log-tokens curve on AIME 2024 with three regimes: a low-compute floor where accuracy is near random, a log-linear midrange where each doubling of compute buys a roughly constant absolute-percentage-point gain, and a high-compute ceiling. Which of the following is the **most accurate** characterization of why each doubling in the midrange buys roughly the *same* absolute gain rather than a constant *relative* gain?

- A. Because the model's effective parameter count under Kaplan et al.'s test-time scaling laws grows roughly logarithmically with inference budget, so doubling compute acts like adding a fixed parameter increment per step
- B. Because the o1 system card reports accuracy approximately linear in $\log_2(\text{tokens})$ over the midrange; each doubling shifts $\log_2$ by 1, so a linear function of $\log_2$ adds a constant per doubling.
- C. Because cons@$N$ is a linear unbiased estimator of pass@1 and the linearity of expectation propagates compute increments additively across doublings of the sample budget
- D. Because OpenAI's API meters token costs in fixed-size billing blocks, so each doubling of compute corresponds to one additional block worth of accuracy improvement on AIME-class problems

<details>
<summary>Answers</summary>

1. **A** — apply the unbiased estimator with $n = 10$, $c = 4$, $k = 2$: $\binom{n-c}{k}/\binom{n}{k} = \binom{6}{2}/\binom{10}{2} = 15/45 = 1/3$, so pass@2 $= 1 - 1/3 = 2/3 \approx 0.667$. Distractor B is the *biased* plug-in $1 - (1 - c/n)^k = 0.64$ (close, but slightly lower than the unbiased estimate — the typical bias direction at small $n$). Distractor C is pass@1, not pass@2. Distractor D miscomputes by counting correct-pool subsets ($\binom{c}{k}$) instead of wrong-pool subsets ($\binom{n-c}{k}$) — the canonical direction-of-counting error [D-11](/lesson/11) flagged.
2. **B** — cons@5 takes the plurality vote: $42$ wins with 3 chains vs. $17$ (1) and $600$ (1). The vote matches the gold answer, so the per-problem score is $1$. The illustrative point is that cons@$N$ rewards mode-concentration ("most chains agree on the same answer"), not coverage ("at least one chain is right" — that's pass@$k$). On AIME's integer answer space of size 1000, plurality voting concentrates strongly on correct answers when the model's distribution is well-calibrated.
3. **B** — without an inference-time-compute disclosure and an aggregation method (pass@1 vs. cons@$N$ vs. best-of-$k$-reranker), the two numbers are not on the same axis. Per the lesson's central argument: reasoning-model accuracy reported without cost is structurally under-specified. (A and C are second-order; D is a small effect — AIME I and AIME II are calibrated to be of comparable difficulty within a year.)
4. **B** — the cost-axis Goodhart pattern. Inference compute is the unmeasured slack variable that absorbs the optimization pressure; the leaderboard number rises without per-fixed-budget capability changing. The structural fix — (accuracy, cost) pair reporting; METR HCAST's pre-declared budgets — is what the lesson argues for. (A is a separate Goodhart pattern at training time; C is empirically false; D is a fabricated relationship.)
5. **B** — capability is a *profile across difficulty bands*, not a single number, and AIME + FrontierMath together cover meaningfully more of the relevant frontier than either alone. The contrast — saturation-near AIME vs. floor-near FrontierMath — is what makes the pair informative. (A misses the entire point; C is factually wrong — they're independent constructions; D mischaracterizes both scoring rules.)
6. **B** — the empirical claim from the o1 system card's test-time-compute scaling curves. If $a(c) \approx \alpha \cdot \log_2(c) + \beta$ over the midrange, then $a(2c) - a(c) = \alpha$, a constant in absolute percentage points per doubling — *not* a constant ratio. The shape is task-specific; the floor and ceiling regimes break the log-linearity. (A confuses inference-time compute with parameter count; C is wrong — cons@$N$ is not a linear estimator; D is unrelated.)

</details>
