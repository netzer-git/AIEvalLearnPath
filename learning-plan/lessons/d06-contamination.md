---
day: 6
slug: contamination
title: "Test-set contamination — when the benchmark is in the training data"
week: 1
week_theme: Foundations of LLM evaluation
anchor_benchmark: MMLU-Pro
harness: lm-evaluation-harness
reading_time_minutes: 29
prerequisites: [1, 5]
key_terms:
  - test-set contamination
  - decontamination
  - paraphrase contamination
  - n-gram overlap
  - Min-K% Prob
  - canary string
  - membership inference
  - exchangeability test
goodhart_role: foregrounded
calibration_role: absent
---

# Day 6 — Test-set contamination

## TL;DR

A test item is **contaminated** when a model has seen it (or a near-paraphrase of it) during training, so its score on that item reflects memorization rather than generalization. Contamination is the mechanical, byte-level form Goodhart's Law takes for static public benchmarks — and today's anchor, **MMLU-Pro** (Wang et al. 2024), is the canonical "harden MMLU against it" response: 12,032 reasoning-heavy items across 14 disciplines, with 10 answer choices per item instead of 4. The structural lesson is that contamination is not fixed by a smarter metric; it is fixed by benchmark redesigns that make leakage harder by construction.

## Learning objectives

By the end of this lesson, you will be able to:

1. **(L2)** Distinguish the four flavors of contamination — verbatim, paraphrase, indirect/distributional, post-training — and name the detection family that targets each.
2. **(L2)** Describe MMLU-Pro's construction (12,032 items across 14 disciplines, 4→10 answer options, multi-source curation) and the partial contamination defenses it bakes in.
3. **(L3)** *Apply* the Min-K% Prob mechanic to a candidate string — bottom-K% of token log-probabilities, averaged — and explain why it separates seen from unseen text.
4. **(L4)** *Analyze* the MMLU → MMLU-Pro redesign and decompose which choices target contamination, which target saturation, and which target cue exploitation.
5. **(L5)** *Evaluate* a lab's "decontaminated" claim and surface what residual contamination — paraphrase, indirect, post-training — n-gram filtering cannot mitigate.
6. **(L4)** Frame contamination as the canonical Goodhart-collapse mechanism for static public benchmarks and explain why structural defenses (private splits, post-cutoff sampling) beat metric-level fixes.

## Prerequisites & callback

This lesson is load-bearing on two prior days. **[D-1](/lesson/1)** framed an evaluation as a (dataset, scoring rule, reporting convention) pipeline and parked Goodhart's Law as a recurring overlay; today is the first day where Goodhart is *foregrounded* as the lesson's central mechanism, and the answer to "what hides behind the headline 89.5?" we left open in [D-1](/lesson/1)'s *What the headline number doesn't tell you* is "some non-trivial fraction of the test items leaked." **[D-5](/lesson/5)** framed the statistical-hygiene question — sampling noise, confidence intervals, cross-lab comparability — and contamination is the systematic-bias counterpart to that random-error story: a 1-point CI on a contaminated benchmark just gives you a precise estimate of a biased quantity. If you have not internalized the *evaluation-as-pipeline* framing ([D-1](/lesson/1)) and the *systematic vs. random error* distinction ([D-5](/lesson/5)), today will read as forensics; with them, today reads as the diagnosis.

## The opening hook

You measure a meter stick by laying it next to itself. The reading is exactly one meter. Are you a careful experimentalist?

Modern LLMs are trained on essentially the open web, and the open web contains the test sets of the benchmarks they are evaluated on. When GPT-4 scored 86.4 on MMLU on release, some non-trivial fraction of those 14,042 test items had appeared verbatim in pretraining — in textbook PDFs, in Quizlet decks, in StackExchange threads, in the Hugging Face dataset card itself, in countless blog posts that quote sample questions to explain what the benchmark is. **The model wasn't necessarily reasoning. Some of the time it was remembering.**

That is *test-set contamination*. It is the cleanest empirical instance of Goodhart's Law in modern ML: the moment a benchmark becomes the target everyone optimizes against, the benchmark's signal leaks into the training distribution it was supposed to measure against, and the score stops measuring what it claims to measure. Today's lesson is about how that leak happens, how we detect it, and how MMLU-Pro (Wang et al. 2024) tries to harden MMLU against it — while quietly conceding that for any benchmark that lives long enough, the leak is inevitable.

## Defining the problem

A test item is **contaminated** if a model has seen it (or a near-paraphrase of it) during pretraining or fine-tuning. Three flavors are worth distinguishing because they leak at different rates and call for different forensics:

1. **Verbatim contamination.** The exact item — question + options + correct answer — appears in pretraining data. Most damaging, easiest to detect with n-gram overlap.
2. **Paraphrase contamination.** A reworded version of the item appears in pretraining. Harder to detect with substring matching; needs semantic search or membership inference.
3. **Distributional / indirect contamination.** No specific item leaked, but solutions to closely-related items, the answer key, or commentary on the benchmark were in training. Almost impossible to fully exclude for a popular public benchmark.

A subtle fourth flavor matters for the post-2023 fine-tuning era: **post-training contamination**, where the test set sneaks into RLHF or SFT data via crowd-worker prompts or dataset aggregators. Decontaminating pretraining is hard; decontaminating every fine-tune is harder.

```mermaid
flowchart LR
    BM[Benchmark released] --> WEB[Indexed on web<br/>HF, GitHub, blogs]
    WEB --> PT[Pretraining crawl]
    PT --> M[Model]
    M --> EVAL[Evaluated on benchmark]
    EVAL -->|inflated score| LB[Leaderboard]
    LB -->|incentive| MORE[More models target it]
    MORE --> WEB
```

The loop is the point. Once the benchmark is on the leaderboard, every release produces blog posts, Hugging Face dataset cards, Reddit threads explaining sample items — all of which become *next* year's pretraining.

## Anchor: MMLU-Pro (Wang et al. 2024)

MMLU-Pro is the canonical "hardened MMLU" — a re-curated successor designed to push back against both contamination and saturation. It was published at NeurIPS 2024 (Datasets & Benchmarks track; Wang et al. 2024, arXiv:2406.01574) and adopted as the MMLU replacement on the Hugging Face Open LLM Leaderboard v2 in June 2024.

**What MMLU-Pro is:**

- **12,032 questions** across **14 disciplines** (math, physics, chemistry, law, engineering, psychology, business, history, health, economics, philosophy, computer science, biology, "other") — a flatter discipline grouping than MMLU's 57-subject taxonomy.
- **10 answer choices per question**, up from MMLU's 4. This is the single biggest mechanical change.
- Questions are sourced four ways (per the paper):
  - **~57%** from the original MMLU after filtering (6,810 items kept; 5,886 dropped as "too easy" — i.e., answered correctly by more than four of eight evaluated models).
  - **~34%** newly authored from STEM-website problem sets.
  - **~5%** from TheoremQA.
  - **~5%** from SciBench.
- Two-phase expert review: humans verify correctness and remove unsuitable items; Gemini 1.5 Pro flags candidate "false negative" distractors that look plausibly correct, which humans then re-check.

**Why 4 → 10 choices is the headline change.** A 4-choice MC item has a random-guess baseline of 25%. A 10-choice item has a random-guess baseline of 10%. The difference matters in two ways:

1. **Headroom.** Top frontier models scored ~86–90% on MMLU but only ~60–75% on MMLU-Pro at release, restoring the dynamic range that saturation had collapsed (more on this [D-7](/lesson/7)).
2. **Cue exploitation is harder.** With 4 options a model can rule out two and coin-flip; with 10 options it has to actually localize the answer. This is also why the paper reports MMLU-Pro is *less prompt-sensitive* than MMLU: with more distractors, surface-feature heuristics carry less of the score, so the score depends more on the underlying knowledge and less on the prompt template (sensitivity drops from ~4–5% on MMLU to ~2% on MMLU-Pro across 24 prompt styles).

**Where contamination resistance specifically comes in.** MMLU-Pro's contamination defenses are *partial and indirect*, and the paper is honest about this. The four mechanisms:

- **Filtering "too-easy" MMLU items** preferentially removes items most likely to be memorized (memorized items are easier).
- **New STEM/TheoremQA/SciBench items** were less indexed at the time of MMLU-Pro's release than MMLU's items, which had been on the open web since 2020.
- **More distractors** make memorization a harder signal to exploit — a model that vaguely remembers "the answer was the option mentioning 'momentum'" has worse odds with 9 distractors than with 3.
- **Reasoning-heavy authoring** shifts items toward problems where the path-to-answer matters, not just the surface form.

What MMLU-Pro does **not** do: it does not use a private held-out set, does not procedurally generate items, and does not refresh over time. It is a static public benchmark, which means the same Goodhart loop will eventually catch up to it. The paper's own framing is essentially "buy us a few years of headroom while the field figures out structurally contamination-resistant designs" — see ARC-AGI's private split (Chollet 2019; ARC-AGI-2 in Chollet et al. 2025) or LiveCodeBench's post-cutoff sampling (Jain et al. 2024, [D-11](/lesson/11)) for those structurally-resistant designs.

### Example item

MMLU-Pro keeps MMLU's four-way MC scaffolding but expands to **10 options per question**. A representative item from the released `TIGER-Lab/MMLU-Pro` Hugging Face dataset (discipline: Physics; format verbatim from the dataset card):

```
Q: A beam of light is normally incident on a piece of glass of refractive
   index 1.5. About what percentage of the incident light is transmitted
   through the glass?

(A) 100%
(B) 92%
(C) 50%
(D) 25%
(E) 5%
(F) 75%
(G) 65%
(H) 38%
(I) 85%
(J) 15%

Answer: B
```

The 10-option format is the structural change. A vague memory that "about 4% of light reflects per air-glass interface" rules out A and E quickly but still leaves seven plausible options to discriminate. On MMLU (4 options) a model with a coarse prior over "high transmission" would coin-flip between B and the closest distractor; on MMLU-Pro (10 options) the same prior leaves the model an extra five options it must also rule out. Random-guess baseline drops from 25% to 10%, and — per Wang et al. — surface-feature heuristics carry less of the score, so the headline number depends more on the underlying knowledge.

## ⏵ Check yourself — 4-vs-10 mechanics

A pure-guesser scores 25% on MMLU and 10% on MMLU-Pro. A frontier model scores 88% on MMLU and 72% on MMLU-Pro. **Compute** the *signal-to-noise headroom* — defined here informally as (model score − random baseline) / (1 − random baseline) — under each benchmark, and identify which of the two design changes (random-baseline drop vs. item curation) explains more of the headline gap.

<details>
<summary>Show answer</summary>

Headroom on MMLU: $(0.88 - 0.25) / (1 - 0.25) = 0.63 / 0.75 = 0.84$. Headroom on MMLU-Pro: $(0.72 - 0.10) / (1 - 0.10) = 0.62 / 0.90 \approx 0.69$. The frontier model's headroom drops from 0.84 to 0.69 — a 15-percentage-point loss of "fraction-of-room-above-random" capability, even though the raw-accuracy drop is 16 points.

Most of the raw-accuracy drop is *not* from the random-baseline change (the baseline change moves the floor, not the ceiling); it is from item curation — dropping memorized "too-easy" items and adding harder, less-indexed new ones. The 4→10 change does important secondary work (reducing cue exploitation, lowering prompt sensitivity), but the dominant headline-gap driver is the curation, not the option count. The pedagogical point: a redesign that *only* changed the option count would have produced a much smaller gap. Combining the two is what restored the dynamic range.

</details>

## Detection methods

Four families. They differ in what access they require (corpus / weights / API only) and what kind of contamination they detect.

### 1. N-gram overlap

The original method, and still the workhorse. Brown et al. (2020) defined the GPT-3 contamination protocol: an example is "contaminated" if it shares a 13-gram with any document in the training corpus (or has a full-example match for examples shorter than 13 grams). 13 was chosen as a length above which n-gram collisions are very unlikely to be coincidental in natural text.

```python
# Illustrative: 13-gram overlap detection between a test item and a training shard.
# Production decontamination pipelines (e.g., Llama, GPT) are more careful about
# tokenization, normalization, and case/whitespace handling than this sketch.
def ngrams(text: str, n: int = 13) -> set[tuple[str, ...]]:
    toks = text.lower().split()
    return {tuple(toks[i:i + n]) for i in range(len(toks) - n + 1)}

def is_contaminated(test_item: str, train_doc: str, n: int = 13) -> bool:
    return bool(ngrams(test_item, n) & ngrams(train_doc, n))
```

**Strengths.** Simple, exact, fast with hash-based indexing.
**Weaknesses.** Misses paraphrases; misses items that are quoted with a single edit (`"Q: A wave travels at 200 m/s"` → `"Q. A wave is moving at 200 m/s"`); requires access to the training corpus, which proprietary labs do not release.

The GPT-3 paper found, surprisingly, that running on decontaminated splits barely changed the headline numbers — but it also reported >90% contamination rates on Quac, SQuADv2, and DROP, which is hard to read as anything other than "13-gram overlap is a noisy signal at scale" (Brown et al. 2020). Either the test detected too aggressively, or contamination didn't matter for those benchmarks; Brown et al. did not resolve which.

### 2. Min-K% Prob

Shi et al. (2023) introduced **Min-K% Prob** as a black-box contamination test: it works on API-only access without the training corpus.

The hypothesis: **unseen** text contains some low-probability tokens (because the model is genuinely uncertain on parts of it); **seen** text has uniformly high probabilities everywhere because the model has memorized it. So if you take only the *lowest-probability* tokens of a candidate string and average their log-probs, the result will be lower for unseen text than for seen text.

Formally, for a string $x = (x_1, \ldots, x_T)$ and a model with probabilities $P(x_t \mid x_{<t})$, let $L = \{\log P(x_t \mid x_{<t})\}_{t=1}^{T}$, sort ascending, and take the bottom $K\%$:

$$
\text{Min-K\% Prob}(x) = \frac{1}{|S_K|} \sum_{\log p \in S_K} \log p
$$

where $S_K$ is the bottom-$K$% of $L$ by value. Higher (less negative) values suggest membership in the pretraining set; the typical $K$ is 20%. The paper reports a 7.4% AUC improvement on the WIKIMIA membership-inference benchmark over previous methods (Shi et al. 2023).

**Strengths.** Black-box; no corpus needed.
**Weaknesses.** Detects *memorization*, not contamination per se — a model can memorize without test-set leakage and vice versa; later work (Min-K%++, Zhang et al. 2024) refined the calibration. AUCs are typically 0.6–0.75 for typical-length test items, which is "above chance" but not "smoking gun."

### 3. Canary strings

Carlini et al. (2019), *The Secret Sharer* (USENIX Security), formalized the **canary** method. Insert a randomly-generated, low-perplexity-impossible string into your training data — e.g., a 9-digit "social security number" with random digits. After training, query the model: can it complete the canary? The exposure metric quantifies how memorized the canary is, comparing its likelihood to that of equivalently-random non-inserted strings:

$$
\text{exposure}(s) = \log_2 |\mathcal{R}| - \log_2 \text{rank}(s, \mathcal{R})
$$

where $\mathcal{R}$ is the population of equally-random sequences and $\text{rank}(s, \mathcal{R})$ is the canary's rank by model likelihood within that population. High exposure ≈ memorization.

For benchmark contamination specifically, the analog is:

```python
# Illustrative canary check: is a uniquely-formatted answer key string regurgitable?
canary = "BENCHMARK_X_CANARY_2024::a8f3c1::A,C,B,D,A"  # never appeared in legit text
prompt = "BENCHMARK_X_CANARY_2024::a8f3c1::"
completion = model.generate(prompt, max_tokens=20)
if completion.startswith("A,C,B,D,A"):
    print("Model has seen the canary — training data includes the answer key file.")
```

Canaries are how some benchmark authors fingerprint their datasets — BIG-Bench famously embedded a canary GUID specifically asking models *not* to be trained on it (and that GUID is in plenty of training corpora anyway).

**Strengths.** Unambiguous when triggered; quantifies memorization.
**Weaknesses.** Only detects contamination of the specific canary you planted, not all of the test set; requires foresight before training.

### 4. Membership inference attacks (MIA)

The umbrella name for the broader family of techniques that try to decide, for an input $x$, whether $x$ was in the training set — applied to LLMs by Carlini et al. (2021, *Extracting Training Data from Large Language Models*, USENIX Security) and formalized as **LiRA** (Likelihood Ratio Attack) in Carlini et al. (2022, *Membership Inference Attacks From First Principles*, IEEE S&P).

The likelihood-ratio framing:

$$
\Lambda(x) = \frac{P(x \mid \theta_{\text{train}})}{P(x \mid \theta_{\text{ref}})}
$$

where $\theta_{\text{train}}$ is the target model and $\theta_{\text{ref}}$ is a reference model trained on similar data without $x$. If $\Lambda(x)$ is anomalously high, $x$ is likely a training member.

**Strengths.** Statistically principled; works for paraphrase contamination if the reference model is well-chosen.
**Weaknesses.** Strong MIAs require shadow-model training, which is computationally infeasible at LLM scale; recent work (Duan et al. 2024) finds membership inference is *near chance* for typical LLM test items — that is, MIA against frontier LLMs barely works. Min-K% and friends are practical compromises against this difficulty.

A related and increasingly-influential approach: Oren et al. (2023), *Proving Test Set Contamination in Black Box Language Models* (ICLR 2024), uses **exchangeability**. If a model has seen a benchmark in canonical order, it will assign higher likelihood to the canonical ordering than to shuffled orderings. The test is a black-box, finite-sample exact false-positive-rate procedure that has flagged contamination in several published models.

## ⏵ Check yourself — what does Min-K% actually compute?

You compute Min-K% Prob with $K = 20$ on a 50-token candidate string. Walk through the procedure: how many log-probs end up in $S_K$, and why does averaging *only* the bottom 10 (rather than all 50) sharpen the seen/unseen distinction?

<details>
<summary>Show answer</summary>

With $K = 20$ and $T = 50$, $|S_K| = 0.20 \times 50 = 10$. You compute all 50 token log-probabilities $\log P(x_t \mid x_{<t})$, sort them ascending, take the lowest 10, and average those.

Why the bottom and not all 50? The hypothesis is that *seen* text was memorized in its entirety, so even its hardest-to-predict tokens still got above-average probability mass — the floor is high. *Unseen* text contains some genuinely low-probability tokens (rare names, unusual phrasings, surprising answers) that the model could not have predicted from local context alone — the floor is low. Averaging the full 50 tokens lets the easy, high-probability tokens (function words, common collocations) dominate, washing out the seen/unseen signal that lives in the bottom of the distribution. Restricting to $S_K$ amplifies the discriminative slice: you are asking "how predictable was this string at its hardest points?" and that is exactly where memorization shows up.

This is a classic robust-statistics move (use a tail rather than a mean), and it is also why the choice of $K$ matters: too small ($K = 5\%$) and you over-rely on a noisy 2–3 tokens; too large ($K = 50\%$) and you re-include the easy tokens you wanted to exclude. The paper's $K = 20\%$ is the empirically-tuned middle.

</details>

## Decontamination — what labs (claim to) do

Standard practice as of 2026, with the caveat that most lab decontamination protocols are described in model cards rather than peer-reviewed; specifics vary by lab and aren't independently auditable:

- **Pretraining-corpus n-gram filtering** against a list of known benchmark test sets, before pretraining starts. This is what Llama, Mistral, and (per their system cards) Anthropic's Claude family describe. The 13-gram threshold from Brown et al. (2020) remains common.
- **Held-out evaluation pipelines** that test the same checkpoint on both the public benchmark and an internal paraphrase to estimate leakage.
- **Post-hoc audits** using Min-K% Prob or Oren et al.'s exchangeability test on the released model.
- **Deliberate non-disclosure** of certain held-out test sets (FrontierMath's private split; ARC-AGI's private set on Kaggle) so that the canonical test items never appear in public data at all.

What labs don't do, despite claims: full deduplication against every paraphrase or commentary about the benchmark. That is intractable for a popular benchmark like MMLU. The honest framing is *partial decontamination*.

## ⏵ Check yourself — corpus-vs-API forensics

You are an external auditor handed only API access to a closed-weights frontier model. You suspect MMLU contamination. Decompose which detection methods are available to you, which are not, and which is the **load-bearing** one for the API-only setting — and explain why Duan et al. (2024) is the right caveat to keep in mind.

<details>
<summary>Show answer</summary>

Available: Min-K% Prob (needs only per-token log-probs, which the API exposes for many providers), the Oren et al. (2023) exchangeability test (needs only sequence-likelihood comparisons across permutations), and the canary check *if* you happened to plant a canary before training — which, as an external auditor, you almost certainly did not. Not available: n-gram overlap (needs the corpus, which is closed) and standard MIA with shadow models (needs training reference models, which costs the same order of compute as training the target).

The load-bearing one is **the exchangeability test**. Min-K% measures memorization, not contamination per se, and its AUC of 0.6–0.75 makes it suggestive but not conclusive on any single benchmark. The exchangeability test is statistically tighter — it offers an exact finite-sample false-positive-rate guarantee — and its falsifiable null ("the model assigns equal likelihood to every permutation of the benchmark's items") maps directly onto "the model has not seen this benchmark in canonical order."

The Duan et al. (2024) caveat: any per-item membership inference signal is small at frontier scale, because one item's contribution to a 10T-token training run is statistical noise. So aggregate-level tests (a whole benchmark's order-likelihood; many items' Min-K% averaged) work better than per-item ones. The right reflex when an auditor reports "Min-K% flags item 273" is to ask "what happens at the *benchmark* level?" — that is where the signal accumulates.

</details>

## Conceptual contrast: contamination vs. memorization vs. overfitting

Three terms that get conflated:

- **Memorization.** The model has stored a verbatim training-data substring and can regurgitate it. Studied by Carlini et al. (2021, 2022) — large LLMs memorize a measurable fraction of their training data and can be made to emit it under the right prompt.
- **Contamination.** The test set is a subset of (or overlaps with) the training set. Memorization of contaminated items inflates benchmark scores.
- **Overfitting.** The classical ML notion, where train-set loss falls while held-out loss rises. Modern LLM training is data-bounded enough that classical overfitting is rare; the failure mode at scale is contamination, not overfitting.

Memorization is necessary but not sufficient for contamination-driven score inflation; contamination is necessary but not sufficient for inflated scores (a model can be exposed to a test item and still get it wrong if memorization didn't take). The cleanest evidence for contamination-driven inflation is a benchmark redesign: when MMLU-Pro launched, GPT-4-class models dropped 16–33 percentage points, and that gap is the upper bound on the contamination + saturation contribution to MMLU's reported score.

## Goodhart foregrounded

We have been circling Goodhart's Law all week, but [D-6](/lesson/6) is where it becomes mechanical rather than philosophical. Restate it:

> When a measure becomes a target, it ceases to be a good measure.

For a static public benchmark, the *causal mechanism* by which Goodhart bites is contamination. There is no mysterious "the model is now optimizing the wrong thing" — the corruption is concrete, namespaced, and bytewise: the test items end up in the pretraining set. The training-and-evaluation pipeline, viewed end-to-end, is now training-on-the-test-set with extra steps. The benchmark's headline number is no longer an estimate of generalization; it is an estimate of how much of the test set the model memorized, plus a residual generalization signal that gets harder to disentangle as the contamination fraction rises.

Three things follow:

- **Contamination compounds with leaderboard popularity.** The more attention a benchmark gets, the faster it leaks. MMLU was the most-cited LLM benchmark of 2021–2024 ([D-1](/lesson/1)) and consequently among the most-contaminated.
- **Contamination is asymmetric across labs.** Labs that aggressively decontaminate report lower numbers than labs that don't, all else equal. This is one reason cross-lab leaderboard comparisons should be read with caution ([D-5](/lesson/5)).
- **The Goodhart "fix" is not a better metric — it is a benchmark redesign.** MMLU-Pro, GPQA ([D-7](/lesson/7)), LiveCodeBench ([D-11](/lesson/11)), ARC-AGI's private split, and FrontierMath ([D-25](/lesson/25)) are all responses to the same diagnosis: the answer to a contaminated benchmark is not "compute it more carefully" but "build a benchmark that is structurally harder to contaminate."

This is the throughline for the rest of the curriculum, and [D-6](/lesson/6) is the day where the pattern is named. The other foregrounded Goodhart days each instantiate a *different* mechanism by which a measure decouples from the construct it was supposed to track:

- **[D-6](/lesson/6) (today) — leakage.** The test set ends up in the training set. The mechanism is byte-level overlap.
- **[D-15](/lesson/15) (TruthfulQA) — incentive shape.** The benchmark's reward structure rewards refusals over truth on contested items, so optimizing the score teaches the model to refuse rather than to be truthful.
- **[D-17](/lesson/17) (SAD) — situational conditioning.** The model learns what evaluation contexts look like and conditions on the fact that it is being evaluated, behaving differently than it would in deployment.
- **[D-22](/lesson/22) (LLM-as-judge) — measurement-instrument-as-target.** When the judge model is itself a frontier LLM, optimizing the judged score teaches the model to produce text that the judge prefers, not text that humans would prefer.
- **[D-28](/lesson/28) (METR autonomy) — selection pressure.** Frontier-capability benchmarks measure the *envelope* of what current models can do; once we are training to push that envelope, the envelope itself is the optimization target and the measurement-versus-target gap is the entire field's terminal Goodhart problem.

Wherever you see a "v2" benchmark replacing a "v1" — Open LLM Leaderboard v1→v2 ([D-1](/lesson/1)), MMLU→MMLU-Pro (today), HumanEval→LiveCodeBench ([D-11](/lesson/11)), ARC-AGI-1→ARC-AGI-2 ([D-7](/lesson/7)) — the upgrade is, at its core, a Goodhart-collapse response of the [D-6](/lesson/6) leakage variety, retrofitted with one or more of the structural defenses we listed: private splits, post-cutoff sampling, procedural generation, refresh-over-time. The [D-6](/lesson/6) lesson is that *no metric-level fix* is sufficient; the architectural move has to be at the dataset-and-release level.

> **Safety researcher's note.** Contamination matters for safety evals more than for capability evals, and in the opposite direction. On capabilities, contamination *inflates* scores — bad, but the mistake is "this model is more capable than reality." On safety, contamination of red-team prompts and jailbreaks ([D-19](/lesson/19), HarmBench) into post-training data means the model has seen the attack format and learned to refuse it — *deflating* measured attack success rates without genuine robustness gains. A model that refuses every attack pattern in your held-out set might be safer; or it might just have memorized the patterns, with no transfer to novel attacks. The asymmetry: an inflated capability score is embarrassing; a deflated unsafe-response rate is dangerous. Worth carrying into Week 3.

## Cross-references

**Backward.**

- [D-1](/lesson/1) — picks up the "what hides behind the headline number?" thread parked under *What the headline number doesn't tell you*; today instantiates the *contamination* item on that list with mechanism + forensics + benchmark redesign.
- [D-1](/lesson/1) — picks up the *Goodhart's Law* curriculum-wide overlay introduced as a callback there; today is the first **foregrounded** Goodhart lesson and sets the pattern for [D-15](/lesson/15), [D-17](/lesson/17), [D-22](/lesson/22), and [D-28](/lesson/28).
- [D-5](/lesson/5) — picks up the systematic-bias counterpart to [D-5](/lesson/5)'s random-error story: a tight CI on a contaminated benchmark is a precise estimate of a biased quantity, which is not what the CI's framing implied.

**Forward.**

- [D-7](/lesson/7) — picks up *saturation* as the visible leaderboard consequence of the contamination loop; GPQA is the saturation-resistant successor and shares MMLU-Pro's "harder by construction" diagnosis.
- [D-11](/lesson/11) — picks up *contamination on a code benchmark*, where leak rates are even higher because GitHub is in pretraining wholesale; LiveCodeBench's post-cutoff problem sampling is the structurally-resistant design alternative.
- [D-15](/lesson/15) — picks up the *incentive-shape* form of Goodhart on TruthfulQA, where the benchmark's reward structure (refusal beats truth on contested items) is the decoupling mechanism rather than data leakage.
- [D-17](/lesson/17) — picks up the *situational-conditioning* form of Goodhart with SAD: models that recognize evaluation contexts and behave differently when they detect them.
- [D-22](/lesson/22) — picks up the *measurement-instrument-as-target* form of Goodhart with LLM-as-judge, where optimizing for a judge model's preferences decouples from human preference.
- [D-25](/lesson/25) — picks up FrontierMath as a structural-defense exemplar: a private-split benchmark whose canonical items never appear in public data at all.
- [D-28](/lesson/28) — picks up the *selection-pressure* form of Goodhart on METR's autonomy suite, the curriculum-closing instance of the same mechanism.

## Takeaways

1. A test item is contaminated if the model has seen it (or a near-paraphrase) in training; the four flavors — verbatim, paraphrase, indirect/distributional, post-training — leak at different rates and need different forensics. *(LO 1)*
2. MMLU-Pro (Wang et al. 2024) hardens MMLU via 4→10 answer choices, 12,032 reasoning-heavy curated items across 14 disciplines, and removal of the easiest (most-likely-memorized) MMLU items — a partial defense, not a structural one. *(LO 2)*
3. Min-K% Prob averages only the bottom-K% of token log-probabilities because that is where the seen/unseen signal lives — memorized text has a high floor, unseen text has a low floor; the easy tokens above $S_K$ wash the signal out. *(LO 3)*
4. The MMLU → MMLU-Pro redesign decomposes into curation (drops too-easy items, adds harder less-indexed ones — targets contamination + saturation) and option-count (4→10 — targets cue exploitation + raises random-baseline floor); curation is the dominant headline-gap driver. *(LO 4)*
5. A "decontaminated" claim resting only on n-gram filtering cannot mitigate paraphrase contamination, indirect/distributional contamination, or post-training contamination via crowd-worker prompts; the most defensible reading is *partial* decontamination. *(LO 5)*
6. Contamination is the canonical Goodhart-collapse mechanism for static public benchmarks; structural defenses — private splits, post-cutoff sampling, procedural generation, refresh-over-time — beat metric-level fixes because the leak is at the dataset-and-release level, not the scoring level. *(LO 6)*

## Glossary

- **test-set contamination**: the test set (or a paraphrase of it) appears in the model's training data, so scores reflect memorization rather than generalization [introduced D-6](/lesson/6).
- **decontamination**: pre-training pipeline step that filters known benchmark items out of the training corpus, typically via 13-gram overlap; "partial decontamination" is the honest framing because paraphrase and indirect contamination survive [introduced D-6](/lesson/6).
- **paraphrase contamination**: a reworded version of a test item appears in training; defeats n-gram overlap detection and motivates membership-inference and exchangeability tests [introduced D-6](/lesson/6).
- **n-gram overlap**: contamination detection via shared 13-grams between test items and training documents (Brown et al. 2020); the workhorse method when corpus access is available [introduced D-6](/lesson/6).
- **Min-K% Prob**: black-box contamination detector (Shi et al. 2023) that averages the bottom-K% of token log-probabilities under the target model; higher (less negative) values suggest training-set membership [introduced D-6](/lesson/6).
- **canary string**: a uniquely-formatted, low-perplexity-impossible string deliberately inserted into training data to test for memorization after training (Carlini et al. 2019, *The Secret Sharer*) [introduced D-6](/lesson/6).
- **membership inference**: the broader family of techniques (LiRA, Min-K%, exchangeability) that try to decide, for an input, whether it was in the training set; near-chance at frontier-LLM scale per Duan et al. (2024) [introduced D-6](/lesson/6).
- **exchangeability test**: black-box contamination detector (Oren et al. 2023) that compares the model's likelihood of a benchmark in canonical order vs. shuffled orderings; offers an exact finite-sample false-positive-rate guarantee [introduced D-6](/lesson/6).

## References

- **Anchor.** Wang, Y., Ma, X., Zhang, G., Ni, Y., Chandra, A., Guo, S., Ren, W., Arulraj, A., He, X., Jiang, Z., Li, T., Ku, M., Wang, K., Zhuang, A., Fan, R., Yue, X., & Chen, W. (2024). *MMLU-Pro: A More Robust and Challenging Multi-Task Language Understanding Benchmark.* NeurIPS 2024 Datasets & Benchmarks Track. arXiv:2406.01574. https://arxiv.org/abs/2406.01574
- **Harness.** Gao, L., et al. *lm-evaluation-harness* (EleutherAI). https://github.com/EleutherAI/lm-evaluation-harness — supports MMLU-Pro via the standard MC log-likelihood scoring path; the leaderboard adoption used LightEval but the harness implementation is canonical for reproduction.
- **Secondary.** Brown, T., et al. (2020). *Language Models are Few-Shot Learners.* NeurIPS 2020. arXiv:2005.14165 — see §4 / Appendix C for the 13-gram overlap protocol that defines the GPT-3 contamination methodology.
- **Secondary.** Shi, W., Ajith, A., Xia, M., Huang, Y., Liu, D., Blevins, T., Chen, D., & Zettlemoyer, L. (2023). *Detecting Pretraining Data from Large Language Models.* ICLR 2024. arXiv:2310.16789 — Min-K% Prob.
- **Secondary.** Zhang, J., et al. (2024). *Min-K%++: Improved Baseline for Detecting Pre-Training Data from Large Language Models.* arXiv:2404.02936.
- **Secondary.** Carlini, N., Liu, C., Erlingsson, Ú., Kos, J., & Song, D. (2019). *The Secret Sharer: Evaluating and Testing Unintended Memorization in Neural Networks.* USENIX Security 2019. arXiv:1802.08232 — canary strings + the exposure metric.
- **Secondary.** Carlini, N., et al. (2021). *Extracting Training Data from Large Language Models.* USENIX Security 2021. arXiv:2012.07805.
- **Secondary.** Carlini, N., Chien, S., Nasr, M., Song, S., Terzis, A., & Tramèr, F. (2022). *Membership Inference Attacks From First Principles.* IEEE S&P 2022. arXiv:2112.03570 — the LiRA likelihood-ratio framing.
- **Secondary.** Duan, M., et al. (2024). *Do Membership Inference Attacks Work on Large Language Models?* arXiv:2402.07841 — MIA-near-chance critique at frontier scale.
- **Secondary.** Oren, Y., Meister, N., Chatterji, N., Ladhak, F., & Hashimoto, T. B. (2023). *Proving Test Set Contamination in Black Box Language Models.* ICLR 2024. arXiv:2310.17623 — exchangeability test.
- **Secondary.** Chollet, F. (2019). *On the Measure of Intelligence.* arXiv:1911.01547. https://arxiv.org/abs/1911.01547 — introduces the ARC-AGI evaluation framework and its private-split design. Chollet, F., et al. (2025). *ARC-AGI-2: A New Challenge for Frontier AI Reasoning Systems.* arXiv:2505.11831. https://arxiv.org/abs/2505.11831
- **Secondary.** Hugging Face. *Open LLM Leaderboard v2 archive docs* (v2 launched June 2024 with MMLU-Pro replacing MMLU; retired March 2025). https://huggingface.co/docs/leaderboards/en/open_llm_leaderboard/archive
- **Goodhart.** Strathern, M. (1997). *"Improving ratings": audit in the British University system.* European Review, 5(3) — the canonical concise formulation. Goodhart's original 1975 phrasing was longer and about monetary policy; Strathern's compression is the version this lesson uses.
- **Goodhart.** Manheim, D., & Garrabrant, S. (2018). *Categorizing Variants of Goodhart's Law.* arXiv:1803.04585 — the four-mechanism taxonomy (regressional, extremal, causal, adversarial); contamination on a static public benchmark is most cleanly an *adversarial* Goodhart, where the optimizer's incentive structure rewrites the data-generating process the metric was defined over.

## Quiz

**Q1.** Which is the most defensible reading of why contamination is the canonical Goodhart-collapse mechanism for static public benchmarks?

- A. Saturation drags every benchmark's headline accuracy toward 100% over time, leaving no headroom for further capability gains and forcing the leaderboard into ties at the ceiling.
- B. Researchers cherry-pick few-shot prompt templates per task, and the resulting multiple-comparisons effect across templates inflates the headline number with no training-data leakage required.
- C. Reference answers in popular benchmarks are written by crowd workers with inconsistent rubrics, so different graders disagree about edge cases and any reported number carries a large grader-variance term.
- D. It becomes an optimization target, gets indexed online, and leaks into pretraining — so the score reflects memorization rather than generalization.

**Q2.** Which option best captures the structural difference MMLU-Pro introduces vs. MMLU?

- A. It uses generative scoring instead of log-likelihood.
- B. It expands answer choices from 4 to 10.
- C. It drops to a 5-subject subset.
- D. It moves to a chat-template-only prompt.

**Q3.** What does Min-K% Prob compute, and why is it "low for unseen text, high for seen text"? **Compute** the procedure step by step before reading the options.

- A. It averages log-probs of the bottom-K% tokens; unseen text has some genuinely-low-probability tokens that drag the mean down, while memorized text stays uniformly high even at its weakest tokens.
- B. It computes a Bayesian posterior over training-set membership by integrating across the full pretraining corpus, using the model's perplexity ratio against a held-out reference distribution as the likelihood term.
- C. It is the rank of an inserted canary string among equivalently-random non-inserted sequences, normalized by population size to give an exposure score in bits of memorization.
- D. It is the 13-gram overlap fraction between a candidate test string and the training corpus, scaled by document length to estimate the verbatim contamination rate at corpus scale.

**Q4.** A lab decontaminates against a benchmark using 13-gram overlap on its pretraining corpus. Which type of contamination is **least** mitigated, and why is paraphrase the load-bearing failure mode of n-gram detection?

- A. A test item appearing verbatim in a Common Crawl page.
- B. A test item appearing on a Hugging Face dataset card.
- C. A reworded version of a test item appearing in a textbook PDF.
- D. The test items appearing in a published JSON answer key.

**Q5.** Duan et al. (2024) find that membership inference attacks against frontier LLMs are near chance. Which option best explains the load-bearing reason and its implication for contamination forensics?

- A. Strong MIAs require an infinite ensemble of shadow models trained without each candidate item, which is theoretically impossible to construct under the standard learning-theoretic assumptions used by LiRA.
- B. Each training item contributes too little to a frontier-scale loss landscape for the membership signal to be detectable. Implication: pre-training decontamination beats post-hoc detection.
- C. MIAs only work on small models because the per-parameter membership signal vanishes with model width, and frontier LLMs sit well past the parameter count where the LiRA test retains measurable AUC.
- D. Frontier LLMs are now routinely trained with differential-privacy noise injection at the optimizer level, which provably bounds membership-inference advantage to near zero across input distributions.

**Q6.** A safety researcher reports that a frontier model's measured attack-success rate on HarmBench dropped from 30% (last quarter) to 12% (this quarter). The model card mentions that HarmBench prompts were used in red-team training. Why is the 12% number not necessarily evidence of improved safety?

- A. HarmBench's 400-prompt test set is too small for the reported quarter-over-quarter difference to clear a Wilson confidence interval at the 95% level, so the change sits within sampling noise.
- B. HarmBench scoring requires an LLM judge, which has a documented refusal-classification bias toward false negatives that grows with judge-model scale and explains the apparent quarter-over-quarter drop.
- C. HarmBench uses multiple-choice scoring across ten harm categories, so 12% sits at the random-baseline floor and any sub-15% number is statistically indistinguishable from random guessing on the format.
- D. The test prompts were in training, so the drop partly reflects pattern-matching rather than transfer to novel attacks. Contamination deflates safety scores the same way it inflates capability scores.

<details>
<summary>Answers</summary>

1. **D** — the contamination loop (benchmark → leaderboard target → web indexing → pretraining → inflated score) is the mechanism. See "Goodhart foregrounded." The other options describe real but distinct phenomena: A is saturation ([D-7](/lesson/7)), C is grader variance ([D-3](/lesson/3) / [D-22](/lesson/22)), B is the prompt-template multiple-comparisons artifact ([D-1](/lesson/1) / [D-4](/lesson/4)) — none is the *Goodhart* mechanism on a static public benchmark.
2. **B** — 4 → 10 answer choices is the headline mechanical change; it raises the random baseline from 25% to 10% and reduces cue-exploitation room. The other changes (reasoning-heavy items, 14-discipline grouping) are downstream of the questions and the curation, not of the format change.
3. **A** — Min-K% averages the *bottom* K% of token log-probs. Memorized text lacks the genuinely-low-probability tokens that unseen text has. (B describes a fully Bayesian approach that's intractable; C is the canary exposure metric; D is n-gram overlap.)
4. **C** — paraphrase contamination is the failure mode of n-gram overlap detection. A reworded textbook PDF would not share a 13-gram with the original test item but is still contamination. Min-K% Prob and exchangeability tests are the partial counters; that paraphrase contamination is the *load-bearing* failure of the n-gram method is exactly why the field developed those black-box alternatives.
5. **B** — the Duan et al. result is the empirical version of the obvious information-theoretic point: one item's contribution to the loss landscape of a 10T-token training run is tiny, so distinguishing "trained on" from "not trained on" from likelihoods alone is statistically near impossible at frontier scale. Implication: pre-training decontamination is more reliable than post-hoc detection. (A misstates the LiRA assumptions; C reverses the direction of the scale dependence; D is not standard practice for frontier LLMs in 2026.)
6. **D** — the safety-researcher's-note point. Contamination of safety prompts into training data deflates measured attack success without genuine robustness gains, the mirror image of capability-score inflation.

</details>
