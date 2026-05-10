---
day: 8
slug: reasoning-evaluation
title: "Reasoning evaluation: when knowing isn't enough"
week: 2
week_theme: Capability benchmarks
anchor_benchmark: ARC-Challenge
harness: lm-evaluation-harness
reading_time_minutes: 28
---

# Day 8 — Reasoning evaluation: when knowing isn't enough

## Week 2 opens

Week 1 was about *how to read a number*. The pipeline (D1), MC scoring mechanics (D2), free-form scoring (D3), prompting (D4), statistical hygiene (D5), contamination (D6), and saturation (D7) gave you the toolkit to look at any benchmark report and ask the right four questions: what pipeline produced it, is it statistically real, was the test in the training data, and is the benchmark anywhere near its ceiling.

Week 2 turns the question around. Instead of asking *how do you measure a model*, you start asking *what does the model do*. The seven capability suites of this week — reasoning (today), math (D9), retrieval (D10), code (D11), software engineering (D12), multimodal (D13), long context (D14) — are each a different answer to that question.

Today's anchor is the oldest and methodologically simplest: **ARC-Challenge** (Clark et al. 2018), the AI2 Reasoning Challenge. ARC's questions look almost trivial — fourth-grade science exams. The methodological move is what makes it interesting: ARC was the first widely adopted benchmark to *separate* knowledge-lookup from reasoning by construction. The Easy/Challenge split is engineered specifically so that the Challenge subset cannot be solved by pattern-matching against a corpus. That construction is the lesson.

## Knowledge eval vs. reasoning eval

Both MMLU (D1) and HellaSwag (D2) are 4-way multiple choice. So is ARC-Challenge. Format does not tell you what kind of capability is being measured. The discriminator is what the model needs to do *to score above chance*.

| Benchmark | Format | Capability tested | Failure mode it catches |
| --- | --- | --- | --- |
| MMLU | 4-way MC | breadth of factual knowledge | model doesn't *know* the fact |
| HellaSwag | 4-way MC | commonsense plausibility ranking | model doesn't have grounded common sense |
| ARC-Challenge | 4-way MC | multi-step deductive reasoning over known facts | model knows the facts but can't compose them |

The MMLU failure mode is "doesn't know A". The ARC-Challenge failure mode is "knows A and B and the rule that connects them, but doesn't *apply* the rule." The shift is from *retrieval* to *composition*. This matters for what the score tells you about the model: an MMLU score of 90 says the model has read a lot; an ARC-Challenge score of 90 says the model has read a lot *and* can chain inferences over what it has read. The two scores can come apart, and historically they did — early bag-of-words IR systems did fine on knowledge MC but collapsed on items that required two-step inference, which is exactly the gap ARC was built to expose.

## Anchor: ARC and the AI2 Reasoning Challenge (Clark et al. 2018)

**Citation.** Clark, P., Cowhey, I., Etzioni, O., Khot, T., Sabharwal, A., Schoenick, C., & Tafjord, O. (2018). *Think you have Solved Question Answering? Try ARC, the AI2 Reasoning Challenge.* arXiv:1803.05457.

ARC ships **7,787 multiple-choice questions** drawn from natural grade-school science exams (questions written by humans for human test-takers, not synthesized). Most items are 4-way MC, and a small minority are 3- or 5-way; harness implementations handle the variable choice count rather than discarding the off-format items. The dataset is partitioned into two non-overlapping subsets:

- **ARC-Easy: 5,197 questions** (2,251 train / 570 dev / 2,376 test).
- **ARC-Challenge: 2,590 questions** (1,119 train / 299 dev / 1,172 test).

When papers say "ARC" without qualification they almost always mean **ARC-Challenge test** — the 1,172-item slice that frontier-model reports cite. ARC also ships an **ARC Corpus** of ~14M science-related sentences, intended as a retrieval source for IR-style baselines; modern LM evaluations ignore the corpus and run the questions closed-book.

### The split criterion is the methodology

The Easy/Challenge partition is not difficulty-rated by humans. It is defined operationally by two baselines:

1. An **information-retrieval (IR) baseline** that scores each candidate answer by how well it matches a top retrieval hit from the ARC Corpus.
2. A **word co-occurrence baseline** (PMI-style) that scores each candidate by how often its content words co-occur with the question's content words in a large background corpus.

A question lands in **ARC-Challenge if and only if both baselines answer it incorrectly**. If either one solves it, it goes to Easy. (The original prompt for this lesson had the criterion inverted; the paper's actual rule is "incorrect on both baselines" — a stronger filter than "incorrect on either", because it requires that *neither* shallow strategy works.)

This is a tighter operationalization of "reasoning required" than it looks. Both baselines are *surface-feature* solvers: IR finds a sentence that looks like the answer; co-occurrence finds words that travel with the question's words. The intersection of "IR fails" and "co-occurrence fails" is the slice where you cannot win by *finding similar text*. Whatever the model is doing on the Challenge set, it is not lexical pattern-matching against a known corpus. By construction.

The Challenge set is, in effect, a **negative-filter benchmark**: items aren't selected because they are reasoning-heavy, they are selected because they survive a filter that removes items the shallow baselines can solve. That's a different design discipline from "ask experts to write hard questions" (GPQA, D7) or "construct novel task types" (ARC-AGI, D7's contrast). Filter-based difficulty is cheaper to build but yields a benchmark whose difficulty is bounded by the strength of the filter — better baselines would yield a smaller, harder Challenge set. This is worth holding onto: ARC-Challenge difficulty is calibrated to *2018-era* IR and co-occurrence systems.

### A worked example of why retrieval fails

A representative ARC-Challenge item — paraphrased to avoid quoting the held-out test set verbatim — looks like this:

> Which of the following best explains why a metal spoon left in a hot bowl of soup eventually feels hot at the handle, even though only the bowl end is in the soup?
>
> (A) The handle radiates heat from the surrounding air.
> (B) Kinetic energy is transferred from the soup molecules to the spoon's metal atoms, which transfer it along the spoon by conduction.
> (C) Convection currents carry heat through the spoon.
> (D) The spoon emits infrared light from its hot end to its cold end.

A retrieval baseline searching the ARC Corpus on the keywords *spoon, soup, heat* will surface sentences that mention all three — including correct definitions of conduction, convection, and radiation. The retrieved sentences score similarly against all four options because each option contains a real physics term. A co-occurrence baseline does no better: the words *kinetic energy*, *convection*, *radiates*, and *infrared* all co-occur with *heat* in physics text. The shallow baselines cannot tell which term is the right one *for this scenario*. Picking (B) requires recognizing that solids are involved (rules out convection), that no light source is implied (rules out radiation), and that direct contact is the transfer mode (selects conduction). That is two-step reasoning over known facts — the failure mode the Challenge filter is designed to surface.

## Mechanics: how `lm-evaluation-harness` runs ARC-Challenge

The canonical run on EleutherAI's harness:

```bash
lm_eval \
  --model hf \
  --model_args pretrained=meta-llama/Llama-3.1-8B \
  --tasks arc_challenge \
  --num_fewshot 25 \
  --batch_size 8
```

The harness's `arc_challenge` task config inherits from `arc_easy.yaml`. The relevant settings:

- `output_type: multiple_choice` — log-likelihood scoring over the option strings, not generative letter extraction.
- `doc_to_text: "Question: {{question}}\nAnswer:"` — the prompt template.
- `doc_to_target: "{{choices.label.index(answerKey)}}"` — gold is the index of the correct option.
- `metric_list`: `acc` and `acc_norm`.
- `should_decontaminate: true` — the harness flags potential train-test contamination if you pass the appropriate train corpus.

The 25-shot convention comes from the Open LLM Leaderboard v1, not from the harness defaults — the YAML itself doesn't pin `num_fewshot`. Different reports use 0-shot, 5-shot, or 25-shot, which is a D1-style pipeline difference: same model, same dataset, different number on the scoreboard. When you read an ARC-Challenge score, check the n-shot before comparing it to anything else.

**`acc` vs. `acc_norm` on ARC-Challenge.** From D1: `acc` is the argmax over each option's summed log-likelihood; `acc_norm` divides by byte length first to remove the length bias toward shorter options. ARC-Challenge options are typically full sentences with significantly varying length (compare option B above to options A, C, D). `acc_norm` is the metric the Open LLM Leaderboard reports for ARC-Challenge, and it is the one to quote unless you have a specific reason not to — the option-length distribution makes the unnormalized number meaningfully biased.

## Saturation: where ARC-Challenge stands in 2026

ARC-Challenge is a 2018 benchmark. The trajectory since then is the textbook saturation curve from D7:

- **2018 (release).** The strongest baselines in the original paper were below 30% — barely above the 25% random floor.
- **2019–2021.** BERT-era and early GPT-3 models pushed into the 50–70% range.
- **2023–2024.** Frontier models cleared 90% on standard 25-shot evaluations.
- **As of May 2026.** Public leaderboards report top frontier models in the **95–96%** range, with the upper tail tightly clustered. The benchmark's average across the cohort of frontier-class models tracked on public leaderboards is reported in the low-90s.

By the D7 SNR argument, this is squarely in the saturation regime. With $n = 1{,}172$ test items and $p \approx 0.95$, the per-model 95% CI is roughly $\sqrt{0.95 \cdot 0.05 / 1172} \approx 0.0064$, so $\pm 1.3$ percentage points. The headroom is about $5$ points. Two frontier models scoring 94.8 and 96.0 on ARC-Challenge are statistically distinguishable on a single run — barely — but the gap carries almost no information about reasoning capability differences. ARC-Challenge has gone from "reasoning-required filter" to "frontier-model rounding error" in eight years.

This is the D7 lesson made concrete. ARC's filter-based construction was a real methodological advance in 2018 — it ruled out shallow IR and shallow co-occurrence as solvers. But the filter was calibrated to 2018-era baselines, and modern LMs are not just better IR systems; they have internalized far more world knowledge and can chain inference over it. The benchmark is *clean* — no contamination story like MMLU's, no Goodhart-flavored leaderboard retirement story like the Open LLM Leaderboard's — but it has aged out of usefulness for ranking frontier models. It still serves as a *floor check*: any modern model that can't clear 90% on ARC-Challenge has a basic-reasoning problem worth investigating.

## Forward pointer: D9 and the chain-of-thought gap

ARC-Challenge with 25-shot direct prompting was the original protocol. It does *not* use chain-of-thought (D4): the model sees 25 (question, answer) pairs as exemplars and is scored on log-likelihood of each option. There is no "think step by step" prompt and no place to put one inside the multiple-choice scoring frame.

This matters for tomorrow. **D9 (GSM8K + MATH)** is where the CoT-vs-direct gap explodes — on grade-school arithmetic word problems, switching from direct to CoT prompting can swing accuracy by 30+ points on the same model. ARC-Challenge shows a much smaller CoT gap, partly because its items are short enough that most of the reasoning happens in a single forward pass and partly because the multiple-choice format constrains the answer space to four options. The contrast — small CoT gap on ARC, large CoT gap on GSM8K — is itself a finding about *what kind of reasoning each benchmark exercises*. ARC is single-step or two-step inference over factual knowledge; GSM8K is multi-step arithmetic with intermediate state that benefits from being written down. Two reasoning evals, very different reasoning shapes.

D4 introduced CoT as a *prompting strategy*; D9 will show why the strategy's effect size is itself diagnostic of the underlying reasoning structure of the benchmark.

## Conceptual frame: filter benchmarks vs. construction benchmarks

ARC-Challenge sits at one end of a methodological spectrum that recurs through Week 2 and Week 4.

```mermaid
flowchart LR
    F["Filter-based<br/>(remove items<br/>baselines solve)"]
    F -->|"ARC-Challenge<br/>(2018)"| F2[" "]
    G["Gatekept-difficulty<br/>(experts pass items<br/>through panels)"]
    G -->|"GPQA Diamond<br/>(2023, D7)"| G2[" "]
    S["Structural-novelty<br/>(task type itself<br/>resists memorization)"]
    S -->|"ARC-AGI<br/>(2019, D7)"| S2[" "]
    P["Post-cutoff sourcing<br/>(items literally<br/>didn't exist at training)"]
    P -->|"LiveCodeBench<br/>(2024, D11)"| P2[" "]

    style F fill:#fef
    style G fill:#fef
    style S fill:#fef
    style P fill:#fef
```

Each is a different answer to the question "how do you make a benchmark resist being solved by surface-feature pattern-matching?". Filter-based is the cheapest and the most readily saturated: a stronger filter would yield a harder benchmark, but the filter has to actually exist in the form of running baselines. Gatekept-difficulty buys more headroom but depends on a panel and is gameable as benchmark-shaped problems leak into training. Structural-novelty has the longest clock but is hardest to construct. Post-cutoff sourcing is the cleanest contamination story but tells you nothing about whether the items are *hard*, only that they're *unseen*.

The point of holding these four against each other is that "reasoning eval" is not a single design problem. ARC-Challenge's 2018 construction was the right move for 2018; it would not be the right move today. D11 (LiveCodeBench) and D7 (GPQA, ARC-AGI) make the same argument from different angles.

> **Safety researcher's note.** Reasoning evals like ARC-Challenge are not safety evals, but the *gap* between knowledge-MC scores and reasoning-MC scores on the same model is a useful capability signal. A model that scores 88 on MMLU and 95 on ARC-Challenge is, oddly, better at *applying* what it knows than at *knowing* it — an unusual profile that is worth flagging. The more common direction (high MMLU, lower ARC-Challenge) is the historical pattern: models accumulate facts faster than they accumulate inference machinery. From a safety standpoint, the inference-machinery axis is the one that matters more for downstream agentic capability, because chaining inferences is what an autonomous system has to do to plan. Week 3 returns to this when we look at SAD (D17) and dangerous-capability evaluation (D21, WMDP), both of which require multi-step inference over partial information rather than retrieval over a closed-book corpus. ARC-Challenge is no longer a frontier capability eval, but the *shape* of capability it measures — composition over knowledge — is the shape that matters most for the safety questions Week 3 asks.

## Takeaways

1. ARC-Challenge (Clark et al. 2018) is 2,590 grade-school science MC questions filtered from a 7,787-item parent set; the test split is 1,172 items.
2. The Challenge set is defined as questions answered incorrectly by **both** an IR baseline and a word co-occurrence baseline — a filter-based "reasoning-required" criterion, calibrated to 2018-era shallow solvers.
3. Knowledge eval (MMLU) tests *what the model knows*; reasoning eval (ARC-Challenge) tests *what the model can compose from what it knows*. Same MC format, different capability axis.
4. `lm-evaluation-harness` runs ARC-Challenge as multiple-choice log-likelihood with `acc` and `acc_norm`; the 25-shot convention comes from the Open LLM Leaderboard, not the YAML default. `acc_norm` is the right metric for ARC because option lengths vary substantially.
5. ARC-Challenge has been saturating since 2024 and frontier models cleared 95% by 2026. With ~5 points of headroom on a 1,172-item test, ranking frontier models on it is mostly noise (D7's SNR argument). It still works as a floor check: a sub-90 score on a frontier model is a red flag.
6. Filter-based difficulty (ARC), gatekept difficulty (GPQA), structural novelty (ARC-AGI), and post-cutoff sourcing (LiveCodeBench) are four distinct methodologies for resisting surface-feature solvers. Each has a different saturation clock.

## References

- **Anchor.** Clark, P., Cowhey, I., Etzioni, O., Khot, T., Sabharwal, A., Schoenick, C., & Tafjord, O. (2018). *Think you have Solved Question Answering? Try ARC, the AI2 Reasoning Challenge.* arXiv:1803.05457. https://arxiv.org/abs/1803.05457
- **Dataset card.** Allen Institute for AI. *AI2 Reasoning Challenge (ARC) 2018 Dataset.* https://huggingface.co/datasets/allenai/ai2_arc
- **Harness.** EleutherAI. *lm-evaluation-harness — `arc_challenge` task.* https://github.com/EleutherAI/lm-evaluation-harness/blob/main/lm_eval/tasks/arc/arc_challenge.yaml
- **Open LLM Leaderboard archive (25-shot ARC convention).** Hugging Face. https://huggingface.co/docs/leaderboards/en/open_llm_leaderboard/archive
- **Direct-answer follow-up.** Bhakthavatsalam, S., Khashabi, D., Khot, T., Mishra, B. D., Richardson, K., Sabharwal, A., Schoenick, C., Tafjord, O., & Clark, P. (2021). *Think you have Solved Direct-Answer Question Answering? Try ARC-DA, the Direct-Answer AI2 Reasoning Challenge.* arXiv:2102.03315. https://arxiv.org/abs/2102.03315 (Pointer: ARC-DA reframes ARC as free-form QA, removing the MC scaffold; not used as today's anchor but referenced for context.)
- **Frontier-model SOTA tracking.** Public leaderboards (e.g. https://pricepertoken.com/leaderboards/benchmark/arc-challenge) — specific scores drift; cite primary system cards rather than leaderboard snapshots when quoting numbers.

## Quiz

**Q1.** What is the operational definition of "ARC-Challenge" — i.e., what filter selects an item into the Challenge subset rather than the Easy subset?

- A. A panel of grade-school science teachers rates the question "hard" on the AI2 four-level difficulty rubric.
- B. Both an IR baseline and a word co-occurrence baseline answer it incorrectly.
- C. The question requires at least one numerical computation step combined with a unit conversion.
- D. Domain-expert PhDs validate the question and a Google-with-internet pilot consistently fails to solve it.

**Q2.** A model scores 89 on MMLU and 78 on ARC-Challenge. A second model scores 78 on MMLU and 89 on ARC-Challenge. What does the gap tell you, holding all else equal?

- A. The first model has more world knowledge but composes inferences less reliably; the second has the inverse profile.
- B. The first model is better-calibrated on multiple-choice log-likelihood scoring; the second has higher Brier loss.
- C. The first model is contaminated on the ARC-Challenge train split; the second was filtered with a clean-decontamination protocol.
- D. Both models are equivalent because the average across both benchmarks is identical, and averaging is the standard frontier-model summary.

**Q3.** You evaluate Llama-3.1-8B on ARC-Challenge with `lm-evaluation-harness` and see `acc = 0.543` and `acc_norm = 0.577`. Which is the right metric to report for an Open LLM Leaderboard-style comparison?

- A. `acc`, because raw accuracy is the only meaningful metric on multiple-choice tasks under log-likelihood scoring.
- B. `acc_norm`, because ARC option lengths vary and length-normalization removes that bias.
- C. The mean of `acc` and `acc_norm`, because either metric alone is statistically unstable on small test sets.
- D. Neither — the harness should be run with `output_type: generate_until` and answer-letter regex extraction instead.

**Q4.** ARC-Challenge has 1,172 test items. A frontier model scores 0.951. What is the approximate 95% CI on its score under a binomial model, and what does that imply about ranking it against a model scoring 0.962?

- A. CI is roughly $\pm 1.3$ pp; the $\sim 1.1$ pp gap is borderline on a single run and a paired test on shared items is needed.
- B. CI is roughly $\pm 0.05$ (i.e. $\pm 5$ pp); the gap is small relative to the CI and is clearly noise.
- C. CI is roughly $\pm 0.005$ ($\pm 0.5$ pp); the 1.1-pp gap is more than two CI widths and is highly significant.
- D. The binomial confidence interval is undefined for length-normalized accuracy because the score is no longer a proportion of binary trials.

**Q5.** A reviewer claims that "ARC-Challenge tests reasoning, while MMLU tests knowledge — so a high ARC score guarantees genuine reasoning capability." What is the most precise critique?

- A. ARC's filter only rules out 2018-era IR and co-occurrence baselines, so a high score shows absence of shallow-baseline solvability, not presence of reasoning.
- B. MMLU also requires multi-step inference on its harder subdomains, so the knowledge-versus-reasoning dichotomy is wrong by definition and ARC adds nothing.
- C. ARC-Challenge can only be scored via free-form generation with regex letter extraction rather than log-likelihood, so accuracy numbers are not directly interpretable across harnesses.
- D. The Easy/Challenge split is randomized at dataset construction, so the distinction is meaningless and any score gap is just sampling variance across splits.

**Q6.** ARC-Challenge has a small chain-of-thought gap (CoT vs. direct prompting changes the score by only a few points), while GSM8K (D9 anchor) has a large CoT gap. What does this contrast tell you about the *kind* of reasoning each benchmark exercises?

- A. ARC-Challenge cannot be evaluated under chain-of-thought prompting because its multiple-choice scoring frame leaves no place for reasoning traces; GSM8K can.
- B. ARC items are mostly one- or two-step inferences in a single forward pass; GSM8K items are multi-step arithmetic where externalized state helps.
- C. CoT gap sizes are determined by the harness's decoding parameters and few-shot count, not by anything intrinsic to the benchmark or its reasoning shape.
- D. GSM8K is contaminated by web-scale text whereas ARC-Challenge is not, and the gap is purely the contamination differential being amplified by chain-of-thought decoding.

<details>
<summary>Answers</summary>

1. **B** — the Challenge filter is "incorrect on *both* the IR and co-occurrence baselines." (A) is gatekept-difficulty (GPQA-style); (D) is also GPQA. The intersection of the two baselines failing is the actual operational rule.
2. **A** — MMLU's failure mode is "doesn't know"; ARC-Challenge's is "knows but doesn't compose." The two scores can come apart, and the direction tells you which capability axis is weaker.
3. **B** — `acc_norm` is the leaderboard convention for ARC, and the option-length variance on ARC items makes the unnormalized `acc` length-biased. (D) confuses the harness's `output_type` settings.
4. **A** — $\sqrt{0.95 \cdot 0.05 / 1172} \approx 0.00637$, so $\pm 1.96 \times 0.00637 \approx \pm 0.0125$ (≈ $\pm 1.3$ pp). The 1.1-pp gap between 0.951 and 0.962 is at the edge of single-run distinguishability; paired McNemar (D5) on the same items is the right test.
5. **A** — the filter rules out *2018-era* shallow solvers. A modern LM that beats those baselines need not be doing what the filter was designed to require. This is the D7 saturation argument applied to construction methodology rather than headroom.
6. **B** — the CoT gap's *size* reflects the benchmark's reasoning shape: short single-pass items (ARC) gain little from externalized scratchwork; multi-step arithmetic (GSM8K) gains a lot. D9 develops this directly.

</details>
