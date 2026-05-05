---
day: 5
slug: statistical-hygiene
title: "Statistical hygiene — sample size, error bars, scenario coverage"
week: 1
week_theme: Foundations of LLM evaluation
anchor_benchmark: HELM
harness: HELM (own harness)
reading_time_minutes: 28
---

# Day 5 — Statistical hygiene: sample size, error bars, scenario coverage

## The opening hook

On Day 1 we noted, almost in passing, that "with ~14k test items, sampling noise alone is around ±0.4 points." Today we do the math, then ask the harder question: if a benchmark is reported with no confidence interval at all, what should you assume about a 0.6-point gap between two models?

In most other empirical sciences the answer is "assume nothing — the report is incomplete." LLM evaluation has spent five years cheerfully ignoring this norm. Leaderboards rank models on point estimates; papers headline a one-decimal-place delta and call it state-of-the-art; press releases cite "+1.2 on MMLU" as if it were a meaningful effect size. **A score without an uncertainty interval is not a measurement; it is a guess with extra digits.**

The lesson's anchor — **HELM**, the *Holistic Evaluation of Language Models* framework (Liang et al. 2022/2023) — is the project that tried hardest, earliest, and most publicly to fix this. HELM is two things at once: a *suite* (a collection of scenarios chosen to give breadth-of-coverage rather than a single headline number) and a *harness* (a Python framework, `crfm-helm`, that runs them). Both pieces of HELM exist because the original team believed evaluation literacy required statistical rigor and scenario plurality, not point estimates on three benchmarks. Today's lesson installs the rigor; Days 6, 7, and 15 build on the plurality.

## Why the headline number has a confidence interval

Imagine MMLU-style accuracy as a Bernoulli experiment: each test item is a coin flip, the coin's bias is the model's per-item correctness probability $p$, and your score is the empirical mean. Standard probability says the standard error of the mean of $n$ Bernoulli draws is

$$\mathrm{SE}(\hat{p}) = \sqrt{\frac{p(1-p)}{n}}$$

which is maximized when $p = 0.5$ (the most uncertain coin). For the full 14,042-item MMLU test set with a model scoring around $p = 0.85$:

$$\mathrm{SE}(\hat{p}) = \sqrt{\frac{0.85 \cdot 0.15}{14042}} \approx 0.0030$$

A 95% normal-approximation interval is roughly $\hat{p} \pm 1.96 \cdot \mathrm{SE} \approx \hat{p} \pm 0.0059$ — the **±0.4 to ±0.6 percentage points** sampling-noise envelope we waved at on Day 1. Two models reporting MMLU scores of 85.1 and 85.4 are *statistically indistinguishable* under this model. Three out of four "improvements" of <1 point on MMLU are noise.

Three corrections to that simple picture matter:

- **Wilson interval over normal approximation.** For accuracies near 0 or 1, the symmetric normal interval can extend below 0 or above 1 and is empirically miscalibrated. The Wilson score interval is the standard fix and what most careful eval reports use:

$$\mathrm{Wilson}(\hat{p}, n, z) = \frac{\hat{p} + \frac{z^2}{2n}}{1 + \frac{z^2}{n}} \pm \frac{z}{1 + \frac{z^2}{n}} \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}$$

For $n = 14{,}042$ this barely moves the interval; for a 100-item subset it matters a lot.

- **Subject-level reporting is much noisier.** MMLU's 57 subjects average ~250 items each. At $n = 250, p = 0.85$ the SE is $\sqrt{0.85 \cdot 0.15/250} \approx 0.023$ — a ±4.5-point 95% CI. The "high-school physics: 91" and "college chemistry: 87" delta in a model card is well within sampling noise, even before you ask whether the questions in those two subjects are comparable.

- **Bootstrap when items aren't IID.** The closed-form formulas assume independent items. When items share structure (multi-question passages, scenario-grouped tasks, paired AB items) the effective $n$ is smaller than the nominal $n$. A nonparametric bootstrap — resample the test set with replacement $B = 1000$ times, recompute accuracy, take the 2.5th/97.5th percentiles — gives an interval that respects clustering. HELM uses bootstrapping as its default for non-trivial scenarios.

A useful rule of thumb to commit to memory: **at $p \approx 0.85$, a 95% CI of ±1 point requires roughly $n = 5{,}000$ items; ±0.5 points requires ~20,000.**

## Two models, one comparison: paired vs. unpaired tests

The interval above answers "how uncertain is my single number?" The downstream question — "is model A better than model B?" — is harder, because the two models are usually evaluated on the *same* test items.

```mermaid
flowchart LR
    TS["Test set (n items)"] --> A["Model A → score_A_per_item"]
    TS --> B["Model B → score_B_per_item"]
    A --> D["Per-item differences<br/>d_i = score_A_i - score_B_i"]
    B --> D
    D --> P["Paired bootstrap / paired sign test<br/>→ tighter CI on (acc_A - acc_B)"]
```

If you pretend the two scores are independent samples and apply an unpaired interval, you'll wildly overestimate uncertainty. The correct move is a **paired test**: for each item, record the difference $d_i = \mathbb{1}[A_i] - \mathbb{1}[B_i]$, then bootstrap the mean of $d$. The variance of the paired difference is

$$\mathrm{Var}(\hat{d}) = \frac{\sigma_A^2 + \sigma_B^2 - 2\,\mathrm{Cov}(A, B)}{n}$$

and the covariance term is large and positive when the two models tend to get the same items right (which is almost always true for similar-capability models). A paired CI on the *gap* can be tighter than either model's individual CI by 2–5×. This is why the same data can support "Llama-3 ranks above Mistral-7B" with high confidence even when both models' individual CIs overlap.

The lm-evaluation-harness `--bootstrap_iters` flag computes per-task standard errors but not paired differences across runs. To compare two models rigorously you need to keep the per-item scores and pair them yourself.

## Anchor: HELM (Liang et al. 2022/2023)

HELM was published as *Holistic Evaluation of Language Models* (arXiv:2211.09110, November 2022; published in TMLR 2023). The author list is unusually long — 50 authors led by Percy Liang, with Rishi Bommasani and Tony Lee as the other lead contributors and a long tail of Stanford CRFM collaborators. The size of the author list is itself a methodological signal: HELM was designed as community infrastructure, not a single paper's experiment. The framework has been continuously updated since release and as of early 2026 the `crfm-helm` package on PyPI is on its fifth-year minor-version cadence.

### The methodological move: scenarios × metrics, not benchmarks × accuracy

Pre-HELM evaluation reported one metric (accuracy) on each of a handful of benchmarks. HELM's signature contribution is the **scenario × metric matrix**: every model is evaluated on every (scenario, metric) cell where it makes sense.

The original 2022 release defined:

- **16 core scenarios** spanning question answering, information retrieval, summarization, sentiment analysis, toxicity detection, and miscellaneous text classification — drawn from existing datasets (NaturalQuestions, NarrativeQA, MMLU, TruthfulQA, RAFT, etc.).
- **42 total scenarios** including 26 targeted evaluations for specific properties (knowledge, reasoning, harms, efficiency).
- **7 metrics per scenario where applicable**: accuracy, calibration, robustness, fairness, bias, toxicity, and efficiency.

The headline empirical claim of the paper is that HELM improved benchmark coverage of the 30 surveyed models from an average of ~17.9% of the core scenarios pre-HELM to 96.0% under the HELM evaluation. *Coverage* — not headline accuracy — is the deliverable.

The shift from "benchmark × accuracy" to "scenario × metric" is the structural argument. A model that scores 85 on MMLU has revealed *one number*. A model that has been run through HELM has revealed accuracy, calibration, robustness to typos, demographic-fairness gaps, social-bias scores, toxicity rate, and tokens-per-second on the same scenarios. The reader gets a vector of comparable measurements rather than a single comparable scalar. That is the same philosophy you will see again on D22 (judge biases) and D24 (RewardBench): the "headline number" is a compression that throws away signal.

> **Calibration in HELM.** Day 2 introduced calibration as a property of the *scoring rule* (acc vs. acc_norm and the reliability-diagram framing). HELM treats it as a first-class scenario-level *metric* — Expected Calibration Error reported alongside accuracy in the same table. The methodological commitment: calibration is not a separate workstream from accuracy but one of seven readings on the same instrument. The full calibration thread (D2 → D15 → D20 → D24) returns to this view on TruthfulQA, sycophancy, and RewardBench respectively.

### A scenario in detail: HELM's MMLU run

To make the scenario × metric structure concrete, take HELM's treatment of MMLU. (HELM also runs a dedicated MMLU leaderboard since 2024, separate from the 2022 paper's core suite.)

- **Prompt template:** standardized 5-shot, single canonical format across all models. No per-model tuning. The HELM team's rationale is that fairness across models requires a common pipeline — a model that "would have" scored higher under a different prompt template is not the comparison HELM is making.
- **Sampling:** in the 2022 evaluation, each scenario was capped at 1,000 items per evaluation run (the full MMLU has 14,042; HELM Lite re-introduced a similar cap in 2023). The cap matters statistically: at $n = 1000, p = 0.85$, the 95% CI is roughly ±2.2 points — wider than the difference between most state-of-the-art models on the leaderboard. HELM's choice was: cover more scenarios at narrower-but-still-meaningful per-scenario CIs rather than fewer scenarios at very tight CIs.
- **Aggregation:** *macro*-average across MMLU's 57 subjects (matching the original benchmark) rather than micro-average across items. HELM later added a separate full-MMLU leaderboard (announced May 2024) that uses all 57 subjects without subsampling.
- **Reporting:** the result is published as an *interval*, not a point estimate. Bootstrapped standard errors are computed by resampling the per-item scores with replacement and are reported alongside the mean.
- **Comparison:** HELM headlines a **mean win rate** — fraction of (scenario, model-pair) cells where model $A$ beats model $B$ — rather than an averaged accuracy across scenarios. A win rate is rank-based and survives the cross-scenario unit problem (you cannot meaningfully average BLEU on summarization with accuracy on MMLU).

The forward-pointer here is **D15** (TruthfulQA), which appeared as a HELM scenario from the start and inherited HELM's measurement philosophy — including the calibration-vs-truthfulness reading that D15 unpacks.

### HELM as harness — the framework, not the suite

The other half of "HELM" is `crfm-helm`, the Python framework that runs the suite. This is the first non-`lm-evaluation-harness` framework you have met in this curriculum, and the design contrast is instructive:

- **Install:** `pip install crfm-helm`. Repository: `github.com/stanford-crfm/helm`. License: Apache-2.0.
- **Core abstractions:** `Scenario` (loads a dataset and produces `Instance` objects), `Adapter` (formats prompts — few-shot, multiple-choice, generation), `Metric` (scores model outputs — exact-match, F1, calibration, bias-classifier-based, etc.), `Runner` (orchestrates the pipeline, caches per-prompt model calls). Compared to `lm-evaluation-harness`'s task-centric design, HELM's separation of `Scenario`/`Adapter`/`Metric` makes it easier to swap in a new metric on an existing scenario — useful when (e.g.) a new calibration measure appears.
- **Caching:** HELM caches model responses by (model, prompt) key. Re-running a scenario with a new metric does not re-query the model. Important for cost control on a 50-scenario suite.
- **Web UI:** HELM ships a static-site frontend at `crfm.stanford.edu/helm/` that renders the scenario × metric × model matrix. You can drill into individual prompts and the model's full output — this *prompt-level transparency* is the same first-principle as Day 1's "an evaluation is a pipeline."
- **Sub-leaderboards:** as of 2026 the HELM project hosts several sibling leaderboards — HELM Classic (the original 16-scenario suite), HELM Lite (a faster 9-scenario suite, December 2023), HELM MMLU (full 57-subject MMLU, May 2024), HELM Capabilities (March 2025; MMLU-Pro + GPQA + IFEval + WildBench + Omni-MATH at ~1,000 instances each), HELM Safety, MedHELM, and others. Each is a curated scenario set served by the same harness.

```bash
# Verify the scenario list and run a single scenario locally.
pip install crfm-helm
helm-run \
  --conf-paths run_specs.conf \
  --suite v1 \
  --max-eval-instances 1000 \
  --models-to-run openai/gpt-4o-2024-05-13 \
  --scenarios-to-run mmlu
# Outputs: per-instance JSON, aggregated metrics with bootstrapped CIs,
# and a static site fragment under benchmark_output/runs/v1/.
```

> **Maintenance note.** The `crfm-helm` GitHub repo is on its v0.5.x release line as of early 2026 and continues to ship updates; the project hosts active sub-leaderboards (HELM Lite, MMLU, Capabilities, Long Context, Safety, MedHELM). Treat the harness as production-quality and the suites as evolving at HELM Lite / HELM Capabilities cadence — new scenarios get added; older ones don't refresh on a strict schedule.

## What scenario coverage actually buys you

The "scenarios × metrics" matrix is more than a presentation choice. It changes what kind of claim you can make about a model.

Consider a model card that reports MMLU = 85.0. It supports the claim "this model is good at multi-domain knowledge questions." It does not support:

- "This model is calibrated" (separate metric, often anti-correlated with accuracy after RLHF).
- "This model is robust" (typos and capitalization changes can move accuracy 2–5 points without the model "learning" anything).
- "This model is fair" (demographic-conditioned accuracy gaps may be 5–15 points even at high overall accuracy).
- "This model is safe to deploy on user inputs" (toxicity rate is uncorrelated with MMLU).

A HELM-style report makes those four properties first-class, comparable, and uncomparably more decision-relevant than the headline accuracy number on its own. This is also the methodological philosophy that **D22** (LLM-as-judge biases) returns to: judges, like models, must be evaluated on multiple axes, because the single-number compression is what allows systemic biases to hide.

The trade-off is honest: a HELM-style evaluation costs roughly $K$× a single-benchmark eval, where $K$ is the number of scenarios. The 2022 paper's 30 models × 42 scenarios run reportedly cost ~$50,000 in API calls. HELM Lite cut this by an order of magnitude by dropping the most expensive scenarios (calibration on log-likelihood-only models, MS MARCO retrieval) and by reducing to a single random seed. The cost-vs-coverage trade-off is permanent and is itself an evaluation-design dimension you should reason about before clicking *run*.

## A worked CI example

Suppose you want to claim that model A beats model B on a 1,000-item scenario, and you observe accuracies 0.74 and 0.71. Should you believe the 3-point gap?

- **Unpaired Wilson 95% CIs:** A is in [0.712, 0.766], B is in [0.681, 0.737]. The intervals **overlap** — naively, "no significant difference."
- **Paired bootstrap on $d_i$:** if the per-item agreement between A and B is 0.85 (roughly typical for two similar-capability models), the SE of the *paired* difference is much smaller than the SE of either marginal. With $n = 1000$ and a paired SE around 0.0095, the 95% CI on the gap is roughly $[0.011, 0.049]$ — i.e., the gap is significant at $p < 0.05$ even though the marginal CIs overlapped.

The lesson: **overlapping marginal CIs do not imply a non-significant difference when the items are paired.** Many "no-significant-difference" claims you see in eval blog posts use the wrong test. HELM's bootstrap-of-the-difference (when it is reported) is the right one.

## Practical checklist for reading or writing an eval report

When you read someone else's eval, look for:

- [ ] $n$ — the number of test items used. (If subsampled from a larger set, the subsampling seed and method.)
- [ ] A confidence interval, standard error, or bootstrapped quantiles on every reported number.
- [ ] **Paired** comparisons when comparing two models on the same data, not unpaired intervals.
- [ ] Per-subject / per-scenario breakdowns where the noise floor is stated, not buried.
- [ ] Whether multiple seeds were used (HELM Classic: yes, ≥3; HELM Lite: 1; lm-eval-harness: configurable, default 1).
- [ ] Coverage of *non-accuracy* metrics where applicable: calibration (D2 → D24), robustness (D6/D19), fairness/bias (D16), efficiency (D25).

When you write one, treat reporting a single point estimate as a defect — analogous to reporting a physics measurement without an error bar.

> **Safety researcher's note.** Statistical hygiene is doubly important for safety evals because their effect sizes are usually small. A capability benchmark might show a +12-point gap between Llama-3-8B and Llama-3-70B; a safety eval (refusal rate on borderline prompts, harm-classifier rate on jailbroken responses, sycophancy score) typically shows 1–3 point gaps between adjacent model versions, and the test sets are often $n < 500$. At $n = 300, p = 0.5$, the 95% CI is ±5.7 points — wider than every reported safety improvement in some recent model cards. If you read "refusal rate improved from 87.3% to 89.1% (n=200)," you are reading noise. The HELM Safety leaderboard is one of the only public safety reports that reports CIs as a default; the rest of the field has not caught up. When you build internal safety dashboards, build the CIs in from day one — they will save you from celebrating a regression.

## Forward-pointers

- **D6 (contamination)** explains *why* point estimates are even less trustworthy than the CI math suggests: if the data is contaminated, even a perfectly tight CI is centered on the wrong number.
- **D7 (saturation)** explains why the noise floor matters increasingly more as benchmarks age: when the gap between SOTA and ceiling shrinks, every visible "improvement" lands inside the ±0.5-point envelope and the benchmark stops discriminating.
- **D15 (TruthfulQA)** is a HELM scenario that inherited HELM's measurement philosophy and exposes a calibration-vs-truthfulness trade that only appears once you read the multi-metric matrix.
- **D22 (LLM-as-judge)** generalizes the multi-metric philosophy to judges: a judge that scores high on agreement-with-humans but high on position-bias is not a good judge, and the only way to see that is to report both metrics.
- **D24 (RewardBench)** completes the calibration thread (D2 → D15 → D20 → D24): reward-model confidence is itself a calibration story and inherits the same statistical-hygiene discipline.

## Takeaways

1. A score is not a measurement; an interval is. At $n = 14{,}000, p \approx 0.85$ the sampling-noise floor is roughly ±0.4 points; at $n = 250$ it is ±4.5 points. Per-subject breakdowns are much noisier than headline numbers.
2. Use the Wilson interval near $p = 0$ or $p = 1$, and use a **bootstrap** when items are non-IID (passage-grouped, paired AB, scenario-grouped).
3. Comparisons between two models on the same items are *paired*. Marginal CIs overlapping does not mean the gap is insignificant — paired bootstrap on $d_i$ gives the right interval.
4. HELM's signature methodological move is the **scenario × metric** matrix: 16 core scenarios × 7 metrics (accuracy, calibration, robustness, fairness, bias, toxicity, efficiency) instead of one benchmark × accuracy. *Coverage*, not headline number, is the deliverable.
5. HELM is also a harness (`crfm-helm`) with `Scenario` / `Adapter` / `Metric` / `Runner` abstractions, prompt-level caching, a static-site frontend, and several sub-leaderboards (Classic, Lite, MMLU, Capabilities, Safety, MedHELM).
6. Safety evals are usually small-$n$ and report tiny effect sizes; they need *more* statistical hygiene than capability evals, not less.

## References

- **Anchor.** Liang, P., Bommasani, R., Lee, T., Tsipras, D., Soylu, D., et al. (2022/2023). *Holistic Evaluation of Language Models.* TMLR. arXiv:2211.09110.
- **HELM Classic launch post.** Stanford CRFM. *Holistic Evaluation of Language Models (HELM).* November 2022. https://crfm.stanford.edu/2022/11/17/helm.html
- **HELM Lite launch post.** Stanford CRFM. *HELM Lite: Lightweight and Broad Capabilities Evaluation.* December 2023. https://crfm.stanford.edu/2023/12/19/helm-lite.html
- **HELM MMLU launch post.** Stanford CRFM. *MMLU on HELM.* May 2024. https://crfm.stanford.edu/2024/05/01/helm-mmlu.html
- **HELM Capabilities launch post.** Stanford CRFM. *HELM Capabilities.* March 2025. https://crfm.stanford.edu/2025/03/20/helm-capabilities.html
- **HELM repository.** stanford-crfm/helm on GitHub. Apache-2.0. https://github.com/stanford-crfm/helm
- **Wilson interval.** Wilson, E. B. (1927). *Probable Inference, the Law of Succession, and Statistical Inference.* JASA 22(158).
- **Bootstrap.** Efron, B. (1979). *Bootstrap Methods: Another Look at the Jackknife.* Annals of Statistics 7(1).
- **Eval-uncertainty critique.** Madaan, L., Singh, A. K., Schaeffer, R., Poulton, A., Koyejo, S., Stenetorp, P., Narang, S., & Hupkes, D. (2024). *Quantifying Variance in Evaluation Benchmarks.* arXiv:2406.10229. https://arxiv.org/abs/2406.10229 — empirical companion piece on bench-to-bench variance, seed variance, and monotonicity-during-training as evaluation metrics.

## Quiz

**Q1.** A model scores 82.0% on a 1,000-item scenario. The approximate 95% Wilson CI is closest to:

- A. ±0.4 points
- B. ±1.2 points
- C. ±2.4 points
- D. ±5.0 points

**Q2.** Two models report MMLU scores of 85.1 and 85.5 on the full 14,042-item test set. Which conclusion is best supported?

- A. The 0.4-point gap is statistically significant; model B is better.
- B. The 0.4-point gap is within the ±0.4-to-±0.6-point sampling-noise envelope; the gap is plausibly noise.
- C. The two models are identical.
- D. You need at least 100,000 items to distinguish them under any test.

**Q3.** Two models are evaluated on the same 1,000-item scenario. Their marginal 95% CIs overlap. Which test is most appropriate to determine whether one model is significantly better?

- A. Conclude "no significant difference" from the marginal-CI overlap.
- B. Run an unpaired t-test on the two accuracies.
- C. Compute per-item differences $d_i$ and bootstrap a CI on the mean of $d$ (paired bootstrap).
- D. Re-run both models on a different test set and compare again.

**Q4.** HELM's signature methodological contribution is best described as:

- A. A new prompt template that fixes acc-vs-acc_norm bias.
- B. The scenario × metric matrix — every model evaluated on every (scenario, metric) cell where applicable.
- C. A faster Python harness that replaces lm-evaluation-harness.
- D. A leaderboard that ranks models on a single mean-accuracy number.

**Q5.** Which of these metrics is **not** part of HELM's canonical 7-metric core (per Liang et al. 2022)?

- A. Accuracy
- B. Calibration
- C. Cost-per-token
- D. Toxicity

**Q6.** You read a safety-eval report claiming "refusal rate improved from 87.3% to 89.1% on n=200 borderline prompts." What is the right reflex?

- A. Believe the 1.8-point improvement; safety evals are usually rigorous.
- B. Compute the rough Wilson CI: at $n = 200$ near $p = 0.88$, the CI is around ±4.5 points; the claimed improvement is well inside the noise floor and may not be a real effect.
- C. The improvement is significant because the model version changed.
- D. You need an LLM-judge to score safety evals, so the report is invalid.

<details>
<summary>Answers</summary>

1. **C** — $\mathrm{SE} = \sqrt{0.82 \cdot 0.18 / 1000} \approx 0.012$, so 95% CI is roughly $\pm 1.96 \cdot 0.012 \approx \pm 0.024$, i.e., ±2.4 points.
2. **B** — at $n = 14{,}042, p \approx 0.85$, the per-model SE is about 0.30 points, so a 0.4-point gap is well within sampling noise. (A paired test could in principle resolve it, but only with the per-item scores in hand.)
3. **C** — paired comparisons on the same test set have lower variance than unpaired tests because the per-item correlation is high. Marginal CIs can overlap while a paired CI excludes zero.
4. **B** — the scenarios × metrics matrix is HELM's structural innovation; it pushes evaluation from "one benchmark, one number" to "many scenarios, many metrics, all comparable."
5. **C** — HELM's seven metrics are accuracy, calibration, robustness, fairness, bias, toxicity, and efficiency. Cost-per-token is related to (but not the same as) efficiency, which HELM operationalizes as wall-clock and energy-style measures, not dollars.
6. **B** — at $n = 200, p \approx 0.88$, $\mathrm{SE} \approx \sqrt{0.88 \cdot 0.12 / 200} \approx 0.023$, so the 95% CI is about ±4.5 points. A 1.8-point delta is well inside the noise floor and the claim of "improvement" is not statistically supported on this sample size alone.

</details>
