---
day: 1
slug: what-is-an-eval
title: "What is an LLM evaluation?"
week: 1
week_theme: Foundations of LLM evaluation
anchor_benchmark: MMLU
harness: lm-evaluation-harness
reading_time_minutes: 30
---

# Day 1 — What is an LLM evaluation?

## The opening question

When you read that "GPT-5 scores 89.5 on MMLU", four things have happened that the headline number quietly hides:

1. Someone picked a dataset (MMLU).
2. Someone picked a way to feed each item to the model (5-shot, a particular prompt template).
3. Someone picked a way to score the model's output (accuracy on a log-likelihood argmax over the four options).
4. Someone reported the resulting number on a leaderboard.

Change any of those four and *89.5* becomes *86.2* or *91.0* — same model, different number, both "correct." **An evaluation is not a number; it is the entire pipeline that produced the number.** The first job of this curriculum is to teach you to read that pipeline directly so you can tell when two reports disagree because the *models* disagree, vs. when they disagree because the *pipelines* do.

## The pipeline, visualized

An evaluation is a stochastic process (the model) wrapped in a deterministic harness (everything else):

```mermaid
flowchart LR
    DS[Dataset item] -->|prompt template| FP[Formatted prompt]
    FP --> M{{"Model<br/>(stochastic)"}}
    M -->|logits / continuation| SR[Scoring rule]
    SR --> PS[Per-item score]
    PS -->|aggregation| HN[Headline number]
```

*Everything outside the model is deterministic code. Two papers reporting different MMLU numbers for the same model checkpoint almost always disagree on something inside one of the deterministic boxes — not on the model itself.*

## What an evaluation actually consists of

Three pieces, every time:

1. **A dataset.** A finite collection of items, each with an input and a reference answer. For MMLU this is 15,908 multiple-choice questions across 57 subjects, grouped into four high-level categories — humanities, social sciences, STEM, and "other" (professional + miscellaneous). The reference answer is a single letter — A, B, C, or D.
2. **A scoring rule.** A function that maps the model's output and the reference answer to a number. For MMLU the rule is "accuracy = fraction of items where the model's predicted letter equals the reference letter."
3. **A reporting convention.** How per-item scores roll up to a headline number. MMLU reports unweighted *macro*-average accuracy across the 57 subjects, which is *not* the same as *micro*-average accuracy across all 14,042 items because subjects have different sizes.

A **benchmark** is the (dataset, scoring rule, reporting convention) triple. An **evaluation** is the result of running a specific model against that triple. People say "MMLU score" to mean both; we will be precise where it matters and loose where it doesn't.

## Anchor: MMLU (Hendrycks et al. 2021)

MMLU — *Measuring Massive Multitask Language Understanding* — is the most-cited LLM benchmark. It compressed the field's "what does the model know?" question into one number, and five years on it is still on every model's report card.

Format:

- 15,908 4-way multiple-choice questions across 57 subjects.
- The test set is held out for evaluation; a dev set (5 exemplars per subject = 285 items) provides the few-shot examples; a separate validation set (~1,540 items) is used for hyperparameter selection.
- A typical prompt (subject = high school physics) looks like:

```
The following are multiple choice questions (with answers) about high school physics.

Q: A wave travels at 200 m/s with a frequency of 50 Hz. What is its wavelength?
(A) 4 m  (B) 0.25 m  (C) 10000 m  (D) 0.04 m
A: A

Q: [four more shots elided]
A: ...

Q: <test question>
(A) ...  (B) ...  (C) ...  (D) ...
A:
```

The model is asked to produce one of A/B/C/D. There are two standard ways to score this:

- **Letter-only / generative.** Sample the model, take the first letter of the continuation, compare to gold. Cheap; sensitive to prompt template; assumes the model will produce a letter.
- **Log-likelihood.** Compute the model's log-probability of each of the four full answer strings, take the argmax. Doesn't require the model to actually generate the letter; works on base models that haven't been instruction-tuned.

Day 2 unpacks the difference between these (and why `acc` and `acc_norm` in `lm-evaluation-harness` output report two slightly different numbers).

**Why the harness exists.** Without an evaluation harness, every researcher writes their own MMLU loader: their own prompt template, their own letter-extraction logic, their own subject-aggregation. Researcher A formats prompts as `"Question: ... Answer:"`, Researcher B as `"Q: ... A:"`. Researcher A treats `"A. yes"` as match-on-letter; Researcher B treats it as match-on-stripped-string. These trivial divergences produce the *89.5 vs. 86.2* drift. The harness is **evaluation-as-code**: a standard library of prompt templates, scoring rules, and aggregation logic so that Llama-3 and Gemma-2 are compared on the same pipeline rather than on two researchers' personal Python scripts. `lm-evaluation-harness` is the de-facto standard for static MC; we'll meet Inspect (Day 17 onward) and LightEval where they fit better.

A canonical run:

```bash
lm_eval \
  --model hf \
  --model_args pretrained=meta-llama/Llama-3.1-8B \
  --tasks mmlu \
  --num_fewshot 5 \
  --batch_size 8
```

The output reports two numbers, and the difference between them is pedagogically important.

`acc` is the argmax over each option's *summed* log-likelihood. The problem: a sum of log-probabilities is biased toward shorter strings, because every additional token contributes a $\log P < 0$ term that drags the sum down. Concretely, if a question's options are:

```
(A) Yes
(B) Under certain specific circumstances, depending on the framing
```

a model can prefer (A) not because it knows the answer is (A) but because (A) is shorter — every extra token in (B) is a negative number added to its score. This is **length bias** — a mechanical artifact of unnormalized log-likelihood scoring, not a property of the model's knowledge.

`acc_norm` fixes this by dividing each option's summed log-likelihood by the total *byte length* of its tokens before taking the argmax. The EleutherAI implementation uses byte length specifically — not token count — so the score doesn't penalize models whose tokenizers split words differently (e.g., a model that sees `apple` as 1 token vs. 2). The result is a per-byte average log-probability, comparable across options of different lengths and across models with different tokenizers.

The two scores can disagree by a couple of points on the same model and data. Which one to trust depends on the option-length distribution: MMLU options are usually roughly equal-length, so the gap is small; HellaSwag has wildly varying option lengths and the gap is meaningful — Day 2 returns to this.

## Multiple-choice vs. free-form

MMLU's MC format is what made it the field's lingua franca. The trade-off is sharp:

**MC strengths**

- Scoring is automatic, deterministic, cheap.
- Comparable across models without an LLM-judge in the loop.
- Removes generation-quality confounds — you are testing whether the model *knows* the answer, not whether it can phrase one.

**MC weaknesses**

- **Cue exploitation.** Surface features (longest option, presence of "all of the above") can correlate with the answer.
- **Format hacking.** A model that always picks C beats random.
- **Doesn't test generation.** A model that aces MMLU might still produce ungrammatical free-form text.

**Free-form (open-ended) strengths**

- Tests what users actually do — asking questions and reading prose.
- No cue exploitation; the model has to produce the answer end-to-end.

**Free-form weaknesses**

- Scoring is hard. Exact-match, F1, BLEU, and ROUGE all have known failure modes (Day 3). Semantic metrics (BERTScore, judge-based) introduce their own issues (Day 22).

Most modern capability suites mix both: MMLU and ARC for MC, GPQA for harder MC, GSM8K and HumanEval for free-form-with-checkable-answers (the model generates, but the answer is exact-match-able).

## Leaderboards: what they hide

Leaderboards are the "Leetcode" of the AI world — everyone wants to be at the top, but nobody wants to show you the raw `main.py` that got them there. You will encounter at least three:

- **Open LLM Leaderboard** (Hugging Face, *retired March 2025*) — the most-cited public leaderboard while it ran. v1 used `lm-evaluation-harness` and included plain MMLU; v2 (launched June 2024) switched to LightEval and replaced MMLU with MMLU-Pro after the original saturated. The team retired v2 in March 2025, citing concern that models were optimizing toward the leaderboard's targets rather than the underlying capabilities — the retirement itself is a Goodhart-flavored object lesson, and one we'll return to on Day 7 (saturation).
- **HELM** (Stanford) — reports many scenarios per model with explicit confidence intervals (Day 5 returns to this).
- **Self-reports in papers and model cards** — vary widely. A paper claiming "X scores 80.4 on MMLU" has chosen its prompt template, n-shot, and scoring rule.

Two papers reporting different MMLU numbers for the same model checkpoint usually differ on:

- **n-shot:** 0-shot vs. 5-shot can swing 5+ points.
- **Prompt template:** "Question:" vs. "Q:" vs. an instruction-tuned chat template.
- **Scoring:** `acc` vs. `acc_norm` vs. generative letter extraction.
- **Subset:** the full 14k vs. a 5-subject slice or the per-subject macro vs. micro average.

When you read a benchmark number, the right reflex is to ask **"what pipeline?"** before "is that good?".

## Ranking vs. scoring

A subtle but important distinction:

- **Scoring** asks: what is the model's *absolute* number on this benchmark?
- **Ranking** asks: how does this model *order* relative to other models on this benchmark?

Ranking is more robust than scoring under pipeline drift. If a prompt-template change shifts every model down by three points, the ordering is preserved even though the magnitudes are not. Most leaderboards default to rank-based comparisons for headline claims; HELM reports both. The implication for the rest of this curriculum: when you see "improved from 82.3 to 84.1", check whether the rank changed too.

This sets up the curriculum's recurring overlay, **Goodhart's Law**:

> When a measure becomes a target, it ceases to be a good measure.

If MMLU is a *score* you optimize, you eventually train on it (intentionally or not), and the score stops measuring "language understanding" — it measures "fit to MMLU." If it is a *rank*, the same problem appears more slowly, but it appears.

## What the headline number doesn't tell you

The single MMLU number conceals at least four things, each of which gets its own day this week:

- **Calibration** (Day 2). Does a model that says "70% confident" actually get 70% right? Two models with identical accuracy can have very different calibration profiles.
- **Statistical hygiene** (Day 5). What is the confidence interval on "89.5"? With ~14k test items, sampling noise alone is around ±0.4 points; subject-level reporting is much noisier than that.
- **Contamination** (Day 6). Was MMLU in the training data? Modern models almost certainly saw at least some of it. Detection (n-gram overlap, Min-K% Prob, canary strings) and decontamination are open problems.
- **Saturation** (Day 7). Once frontier models score >90%, headroom collapses and small differences are noise. MMLU has been near saturation since 2024; MMLU-Pro (Day 6) is the contamination-and-saturation-resistant successor.

You cannot read any of these four off the headline number. Reading them off the *pipeline* is what the rest of Week 1 is teaching.

> **Safety researcher's note.** MMLU isn't a safety benchmark — it measures world-knowledge breadth. But for a safety-leaning practitioner, the capability score tells you something *relative*: if a model's MMLU score jumps significantly while its safety-eval scores stay flat, the model has gained planning and world-knowledge without gaining guardrail compliance. That delta — capability up, safety flat — is where risk concentrates. The shorthand for this in safety research is **capability overhang**: capability outpacing alignment. We'll return to it on Day 21 (WMDP, dangerous-capability evaluation) and Day 28 (METR's autonomy suite). The reason a curriculum on *evaluation* spends Week 1 on capability benchmarks before turning to safety is that you can't read the safety delta without first reading the capability number it's relative to.

## Takeaways

1. An evaluation is a (dataset, scoring rule, reporting convention) pipeline plus a model run — not a number.
2. MMLU is the canonical knowledge benchmark — 4-way MC, 5-shot, 57 subjects, accuracy macro-averaged across subjects.
3. MC formats are cheap and automatic but exploitable; free-form is realistic but hard to score.
4. Leaderboards differ on n-shot, prompt template, and scoring rule — same model, different numbers, all "correct."
5. Ranking is more robust than scoring. Goodhart's Law is the central tension: optimized scores degrade as measures.

The rest of Week 1 unpacks the four hidden properties — calibration, scoring hygiene, contamination, saturation — that the headline number conceals.

## References

- **Anchor.** Hendrycks, D., Burns, C., Basart, S., Zou, A., Mazeika, M., Song, D., & Steinhardt, J. (2021). *Measuring Massive Multitask Language Understanding.* ICLR. arXiv:2009.03300.
- **Harness.** Gao, L., et al. *lm-evaluation-harness* (EleutherAI). https://github.com/EleutherAI/lm-evaluation-harness
- **Leaderboard (archive).** Hugging Face. *Open LLM Leaderboard v1 + v2 archive docs.* https://huggingface.co/docs/leaderboards/en/open_llm_leaderboard/archive
- **Goodhart.** Strathern, M. (1997). *"Improving ratings": audit in the British University system.* European Review, 5(3) — the canonical concise formulation. (Goodhart's original 1975 phrasing was longer and about monetary policy.)

## Quiz

**Q1.** What does "an evaluation is a pipeline" mean?

- A. A continuous-integration job that runs the benchmark whenever a new model checkpoint is pushed to the registry.
- B. The (dataset, scoring rule, reporting convention) triple plus a specific model run.
- C. A sequence of prompts fed to the model in fixed order, with the final response taken as the headline score.
- D. The model's averaged ranking position across all public leaderboards that report on that benchmark.

**Q2.** Two papers report MMLU scores for the *same model checkpoint*: 80.4 and 78.1. Which of the following is **not** a typical source of the difference?

- A. One report used 5-shot, the other 0-shot.
- B. One used `acc`, the other `acc_norm`.
- C. One used a different prompt template.
- D. The model was retrained between the two reports.

**Q3.** Why is ranking more robust than scoring under prompt-template changes?

- A. Ranking is derived from log-likelihoods while scoring uses raw generative output, which is template-sensitive.
- B. A uniform shift in every model's score preserves the ordering.
- C. Ranking is computed by averaging accuracy across many prompt templates per model before sorting.
- D. Scoring is computed on the held-out test split rather than the few-shot dev set used to format prompts.

**Q4.** Which is a **weakness** of multiple-choice formats like MMLU's?

- A. They are far more expensive to run than free-form prompts because of the per-option likelihood passes.
- B. They require an LLM-judge in the loop because letter extraction from continuations is unreliable.
- C. Surface cues can substitute for genuine knowledge.
- D. They cannot be batched across subjects without breaking the macro-average aggregation rule.

**Q5.** Goodhart's Law applied to MMLU says that:

- A. MMLU's accuracy is mathematically bounded above by 1, since accuracy is a probability over a finite item set.
- B. Once MMLU is optimized as a target, it stops being a good measure.
- C. MMLU's headline score saturates at 100% once frontier models reach the test-set ceiling.
- D. MMLU is contaminated by definition because its items appear on publicly crawled web pages.

**Q6.** You are evaluating a model on MMLU using log-likelihood scoring. You change the prompt template from `"A:"` to `"The correct answer is:"`. The model's weights are unchanged. Why might the score change?

- A. The conditioning context changes, which can shift the argmax over option log-likelihoods.
- B. Log-likelihood scoring is only compatible with the literal `A:` prompt format used in the original MMLU paper.
- C. Switching the prompt suffix triggers a different quantization layer in the model's serving stack.
- D. MMLU only supports generative letter-extraction scoring; log-likelihood is reserved for free-form benchmarks.

<details>
<summary>Answers</summary>

1. **B** — see "What an evaluation actually consists of."
2. **D** — A/B/C are all standard pipeline differences for the same checkpoint. Retraining produces a different checkpoint, which contradicts the stem.
3. **B** — a uniform shift in scores preserves the ordering even when it changes the magnitudes.
4. **C** — cue exploitation is the named MC failure mode.
5. **B** — the canonical Goodhart formulation in evaluation context.
6. **A** — log-likelihood is computed *conditional on the prompt*: the model is scoring $P(\text{option} \mid \text{prompt})$. Changing the prompt changes the prior context the next-token logits are conditioned on, even with frozen weights. This is one of the major sources of pipeline drift between papers.

</details>
