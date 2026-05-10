---
day: 4
slug: prompting-strategies
title: "Prompting strategies in evals: zero-shot, few-shot, chain-of-thought"
week: 1
week_theme: Foundations of LLM evaluation
anchor_benchmark: BIG-Bench Hard (BBH)
harness: lm-evaluation-harness
reading_time_minutes: 28
---

# Day 4 — Prompting strategies in evals: zero-shot, few-shot, chain-of-thought

## The opening question

Day 1 ended on a quiet observation: two papers can report different MMLU numbers for the same model checkpoint and both be "correct." Day 2 traced one source of that drift to the scoring rule (`acc` vs. `acc_norm`). Day 3 traced another to the metric on free-form output. Today's source is the one most likely to swing a headline number by ten points or more, and it lives entirely on the input side.

If you take the same model, the same dataset, and the same scoring rule, and change only **how the prompt is constructed** — zero-shot vs. five-shot, with reasoning steps vs. answer-only — you can move the score from below random to above the average human. On BIG-Bench Hard, switching Codex (`code-davinci-002`) from answer-only few-shot to chain-of-thought few-shot moves it from **56.6%** to **73.9%** averaged across 23 tasks (Suzgun et al. 2022). Same model, same data, same scoring; the prompt is the experiment.

The pedagogical job of today's lesson is to convince you that the **prompting strategy is not separate from the eval — it is part of the eval**, on the same footing as the dataset and the scoring rule.

## The three strategies, in one frame

```mermaid
flowchart LR
    Q[Test question] --> ZS[Zero-shot:<br/>question only]
    Q --> FS[Few-shot:<br/>k exemplar QA pairs<br/>+ question]
    Q --> CoT[CoT few-shot:<br/>k exemplars with<br/>worked reasoning<br/>+ question]
    ZS --> M[Model]
    FS --> M
    CoT --> M
    M --> A[Predicted answer]
```

Every prompting strategy is a function from a test item to a formatted string the model conditions on. The three canonical choices:

- **Zero-shot.** Show the model the question alone, optionally with a task instruction.
- **Few-shot ($k$-shot).** Prepend $k$ worked exemplars of the form `(question, answer)`. The model conditions on those before seeing the test item.
- **Chain-of-thought few-shot (CoT).** Same as few-shot, but each exemplar's "answer" is replaced by *reasoning steps followed by the answer*. The model imitates the format and produces its own reasoning trace before the final token.

A fourth, **zero-shot CoT**, drops the exemplars but appends a trigger like `Let's think step by step.` to elicit reasoning without imitation (Kojima et al. 2022). It is cheaper than few-shot CoT but generally weaker; harnesses expose it as `bbh_cot_zeroshot`.

The harness change between any two of these is a few lines of YAML. The score change can be 10–30 points.

## Why the choice matters

There are three independent reasons a prompting strategy moves the score, and a literate reader of an eval-paper methods section will recognize all three.

### 1. Format induction

Few-shot exemplars do not teach the model the task in any meaningful sense. What they do is **demonstrate the answer format**. If the gold answer is `"(C)"` and the model's untuned tendency on a zero-shot prompt is to produce a paragraph that contains the word "carbon," then zero-shot scoring will fail not because the model lacks knowledge but because the harness's letter-extraction regex misses. Adding three exemplars where each ends with `So the answer is (X).` collapses that variance — the model now produces a string the regex can parse.

This is why the gap between zero-shot and few-shot is often *larger* on base (non-instruction-tuned) models, where the format-inducing role of exemplars matters most. Instruction-tuned chat models can usually be coaxed into the right format zero-shot, which compresses the gap but does not eliminate it.

### 2. Task identification

For ambiguous tasks, exemplars also disambiguate **what is being asked**. The BBH task `disambiguation_qa` has a question template like *"In the sentence 'The lawyer hired the assistant because she needed help', who needed help?"* — there are at least three reasonable readings (resolve to the lawyer, resolve to the assistant, "ambiguous"). Three exemplars where the gold answer is consistently `"Ambiguous"` for sentences that are in fact ambiguous tells the model both *the answer space* (a small set of options) and *the convention* (when in doubt, say "ambiguous"). Zero-shot, the model has to guess the convention.

### 3. Reasoning elicitation

This is the part CoT changes. For tasks where the answer is one token but the work is many tokens — multi-step arithmetic, object tracking, logical deduction — a model that is *forced* to produce a single answer token at decoding time has no scratchpad. CoT reframes the problem: the model is allowed (in fact, demonstrated) to produce intermediate state. This is not a property of the model's weights; it is a property of what the decoding loop allows the model to compute over. Wei et al. (2022) named the technique; Suzgun et al. (2022) curated the benchmark that demonstrates exactly which kinds of tasks this matters for.

## Anchor: BIG-Bench Hard (Suzgun et al. 2022)

BIG-Bench Hard is a 23-task subset of BIG-Bench (Srivastava et al. 2022/2023, ~204 tasks contributed by 450 authors). The selection criterion is sharp and *makes the benchmark explicitly about prompting*:

> The 23 tasks are precisely those BIG-Bench tasks where the **best prior language-model performance failed to exceed the average human-rater baseline** in the original BIG-Bench evaluation.

The BIG-Bench evaluation used few-shot prompting *without* chain-of-thought. So BBH is, by construction, the slice of BIG-Bench where answer-only few-shot demonstrably underestimates what the field's best models can do. The pedagogical hook is that the benchmark exists *to surface the CoT-vs-direct gap*. If you don't believe prompting strategy is part of the eval, BBH is the benchmark designed to change your mind.

Headline numbers on BBH (Suzgun et al. 2022, Codex `code-davinci-002`, averaged across 23 tasks):

| Setting | Score |
| --- | --- |
| Random baseline | 25.7% |
| Average human-rater | 67.7% |
| Few-shot answer-only | 56.6% |
| Few-shot **with CoT** | **73.9%** |

The +17.3 point gap on Codex is what the paper exists to document. CoT moved Codex from "below the average human" to "above the average human on 17 of 23 tasks." PaLM 540B (also reported in the paper) shows the same direction: with CoT it surpasses the average human on 10 of 23 tasks, reaching ≈65% averaged across BBH. The PaLM 540B answer-only baseline is reported per-task in the paper rather than as a single aggregate, so we don't quote it as a number; the qualitative pattern is the same — answer-only underperforms the human average on most tasks; CoT closes the gap.

### A concrete CoT vs. direct contrast

The BBH task `tracking_shuffled_objects_three_objects` asks the model to track which of three objects each player ends up with after a sequence of pairwise swaps. Both prompt formats use $k = 3$ worked exemplars; only the exemplar content differs.

**Direct (answer-only) exemplar — `direct-prompts/`:**

```text
Q: Alice, Bob, and Claire are playing a game. At the start, they each
hold a ball: Alice has yellow, Bob has blue, and Claire has pink.
First, Claire and Alice swap. Then, Alice and Bob swap. Finally,
Claire and Bob swap. At the end, Bob has the
Options:
(A) yellow ball
(B) blue ball
(C) pink ball
A: (A)
```

**CoT exemplar — `cot-prompts/`:**

```text
Q: Alice, Bob, and Claire are playing a game. At the start, they each
hold a ball: Alice has yellow, Bob has blue, and Claire has pink.
First, Claire and Alice swap. Then, Alice and Bob swap. Finally,
Claire and Bob swap. At the end, Bob has the
Options:
(A) yellow ball
(B) blue ball
(C) pink ball
A: Let's think step by step.
(0) At the start: Alice: yellow, Bob: blue, Claire: pink.
(1) Claire and Alice swap: Alice: pink, Bob: blue, Claire: yellow.
(2) Alice and Bob swap:    Alice: blue, Bob: pink, Claire: yellow.
(3) Claire and Bob swap:   Alice: blue, Bob: yellow, Claire: pink.
At the end of the game, Bob has the yellow ball. So the answer is (A).
```

The dataset, the scoring rule (exact match on `(A)` / `(B)` / `(C)`), and the model are identical. Only the exemplar style changes. On `tracking_shuffled_objects_three_objects`, that change is the difference between near-random performance and near-perfect performance for the strongest models in the paper.

### The per-task pattern is the lesson

If you average over BBH, CoT helps. If you read it task by task, the picture is more interesting and more *pedagogically* useful: CoT does not help uniformly. The paper sorts the 23 tasks into three rough buckets:

1. **CoT unlocks the task.** Multi-step reasoning where the answer requires holding intermediate state: `tracking_shuffled_objects_*`, `multistep_arithmetic`, `dyck_languages`, `web_of_lies`, `logical_deduction_*`. Gaps of +20 to +60 points are common. These tasks have *flat scaling curves* under answer-only prompting (more parameters don't help) and *steep* scaling curves under CoT.
2. **CoT is roughly neutral.** Single-step recognition tasks where the answer is essentially a lookup or a one-step inference: parts of `sports_understanding`, `causal_judgement`. CoT neither helps nor much hurts.
3. **CoT can hurt.** A small number of tasks where reasoning out loud lets the model talk itself into a wrong answer, or where the format of "reasoning then answer" disrupts a strong direct-recognition signal. The paper notes this is rare on BBH but real, and it is the seed of a much larger story about CoT failure modes (faithfulness — does the verbalized reasoning actually drive the answer? — gets a full treatment on D9 with GSM8K and process supervision).

The takeaway: *whether to use CoT in your evaluation pipeline is a per-task design decision, not a global default.* Picking one strategy for the whole benchmark and reporting a single aggregate number throws away the information BBH was designed to surface.

## Few-shot mechanics, in detail

The mechanical implementation of few-shot is exemplar prepending, but two non-obvious choices live inside that:

**Where do exemplars come from?** They are typically a separate held-out dev/train split, not items from the test set. MMLU draws its 5-shot exemplars from a per-subject 5-item dev set. BBH ships hand-curated exemplars in `cot-prompts/` and `direct-prompts/` directories — the *same* exemplars are used for every test item in a given task, which means the few-shot prompt is constant across the test set. This is a deliberate choice: it makes the eval reproducible (no exemplar-sampling variance) at the cost of giving up the variance reduction you'd get from rotating exemplars.

**Are exemplars selected, or fixed?** "Fixed exemplars" is the default; "selected exemplars" (retrieving the $k$ most similar dev items per test item) is a stronger but pipeline-heavy variant that is *not* what `lm-evaluation-harness` defaults to. If a paper claims few-shot performance with selected exemplars, that is a different pipeline.

`lm-evaluation-harness` exposes BBH through four configs that map directly onto the matrix above:

```text
bbh_zeroshot      — k=0, no reasoning trace
bbh_fewshot       — k=3, answer-only exemplars
bbh_cot_zeroshot  — k=0, "Let's think step by step." trigger
bbh_cot_fewshot   — k=3, CoT exemplars  (alias: bbh)
```

A canonical run:

```bash
lm_eval \
  --model hf \
  --model_args pretrained=meta-llama/Llama-3.1-8B-Instruct \
  --tasks bbh_cot_fewshot \
  --batch_size 8
```

Switching `--tasks bbh_cot_fewshot` to `--tasks bbh_fewshot` is the entire pipeline change required to reproduce the CoT-vs-direct gap on your own model. It is a one-token edit in YAML and the most informative single experiment a Week 1 reader can run.

## A small piece of math: why CoT is a *compute* knob

A useful way to read CoT is as moving compute from the inside of the model to the outside. A standard decoding step computes one forward pass per output token. If the answer is one token, answer-only prompting buys exactly one forward pass to do the work. If the answer is preceded by 200 tokens of reasoning, the model gets 201 forward passes — each conditioned on the previous tokens — to compute the answer.

Roughly, with $T$ output tokens generated under temperature-zero greedy decoding:

$$
\text{compute per item} \;\propto\; T \cdot N_\text{params}.
$$

Doubling $T$ doubles the compute. *Where CoT helps, it does so partly by buying more sequential compute per item.* This is the seed of the entire **inference-time-scaling** thread: if more decoded tokens means more compute means more correct answers on reasoning-heavy tasks, then a model's accuracy is no longer a single number — it is a curve over decoding budget. We pick this back up on D25 (AIME, FrontierMath, the o1 system card) where the budget axis becomes a first-class reporting axis.

> **Safety researcher's note.** CoT is a double-edged tool for a safety practitioner. On one side, the verbalized reasoning trace is a *transparency surface*: you can read it, grep it for refusals, train a process-supervision reward model on it (Lightman et al. 2023, previewed on D9). On the other side, **CoT faithfulness is not guaranteed** — recent work (Turpin et al. 2023; Anthropic 2025 "Reasoning models don't always say what they think") shows that models routinely produce reasoning that does not in fact drive the final answer. Optimizing for legible CoT can produce models whose visible reasoning looks aligned while their actual decision is something else — a Goodhart move on the transparency channel itself. Today's BBH-flavored takeaway is narrower: CoT changes scores. The deeper question of whether the reasoning trace is a real window into the model is an open problem we'll pick up on D9 (process supervision) and again on D25 (reasoning models).

## What the headline number doesn't tell you

Three things that the single number `BBH = 73.9%` quietly hides, and that any reader of an eval paper should reach for:

- **Which prompting variant?** A paper that reports "BBH = 73.9" without saying *which of the four variants* is unfalsifiable. The same model can plausibly score anywhere from 35% (zero-shot, answer-only) to 75%+ (3-shot CoT) depending on the variant. The methods section must specify.
- **Per-task vs. aggregate?** The aggregate number averages over tasks where CoT swung +60 and tasks where it swung -2. The per-task table is doing far more work than the average.
- **Whose exemplars?** Different papers using BBH have occasionally re-written the CoT exemplars (e.g., to fit a chat template). The "BBH score" of one model under one paper's exemplars is not strictly comparable to the same model under another paper's exemplars. The Suzgun et al. (2022) shipped exemplars in `cot-prompts/` are the canonical reference; deviation from them is methodologically meaningful and should be flagged.

## Forward pointer

Today established that the prompting strategy is part of the eval pipeline. **D9** picks up the thread on math reasoning, where the CoT-vs-direct gap is even larger — saturated arithmetic on GSM8K is the cleanest demonstration of CoT moving a model from below random to near-ceiling, and the failure mode of unfaithful CoT (the model's stated reasoning doesn't drive its answer) becomes the central problem rather than a footnote. **D25** is the eventual frontier of this thread: when "produce more reasoning tokens" stops being a prompting trick and becomes a model property (o1, o3, R1), the entire evaluation contract has to change to put compute-per-item on the x-axis.

## Takeaways

1. The prompting strategy (zero-shot, few-shot, CoT) is part of the eval pipeline, not separate from it. Same model, same data, same scoring; the prompt is the experiment.
2. Few-shot exemplars do three things at once: induce the answer format, identify the task, and (with CoT) elicit reasoning. The first two often dominate on simple tasks; the third dominates on multi-step ones.
3. BBH is the 23-task BIG-Bench slice where prior LMs underperformed the average human under answer-only few-shot — it exists *to surface the CoT-vs-direct gap*.
4. On BBH, Codex moves from 56.6% (answer-only) to 73.9% (CoT) averaged across 23 tasks — the +17.3 point gap is the canonical magnitude of "prompting strategy is part of the eval."
5. The aggregate hides the per-task pattern: CoT unlocks some tasks, is neutral on others, and can hurt on a few. Choosing one strategy globally throws away that information.
6. Reading CoT as a compute-budget knob (more decoded tokens = more sequential compute per item) prepares the reader for the inference-time-scaling story (D25).

## References

- **Anchor.** Suzgun, M., Scales, N., Schärli, N., Gehrmann, S., Tay, Y., Chung, H. W., Chowdhery, A., Le, Q. V., Chi, E. H., Zhou, D., & Wei, J. (2022). *Challenging BIG-Bench Tasks and Whether Chain-of-Thought Can Solve Them.* arXiv:2210.09261. (Findings of ACL 2023.)
- **CoT origin.** Wei, J., Wang, X., Schuurmans, D., Bosma, M., Ichter, B., Xia, F., Chi, E. H., Le, Q. V., & Zhou, D. (2022). *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models.* NeurIPS 2022. arXiv:2201.11903.
- **Zero-shot CoT.** Kojima, T., Gu, S. S., Reid, M., Matsuo, Y., & Iwasawa, Y. (2022). *Large Language Models are Zero-Shot Reasoners.* NeurIPS 2022. arXiv:2205.11916.
- **Parent benchmark.** Srivastava, A., et al. (2022/2023). *Beyond the Imitation Game: Quantifying and extrapolating the capabilities of language models* (BIG-Bench). TMLR.
- **CoT faithfulness (forward pointer).** Turpin, M., Michael, J., Perez, E., & Bowman, S. R. (2023). *Language Models Don't Always Say What They Think: Unfaithful Explanations in Chain-of-Thought Prompting.* NeurIPS 2023. arXiv:2305.04388.
- **BBH dataset + canonical prompts.** `suzgunmirac/BIG-Bench-Hard` GitHub repo (`bbh/`, `cot-prompts/`, `direct-prompts/`). https://github.com/suzgunmirac/BIG-Bench-Hard
- **Harness configs.** `EleutherAI/lm-evaluation-harness`, `lm_eval/tasks/bbh/` (`bbh_zeroshot`, `bbh_fewshot`, `bbh_cot_zeroshot`, `bbh_cot_fewshot`). https://github.com/EleutherAI/lm-evaluation-harness/tree/main/lm_eval/tasks/bbh

## Quiz

**Q1.** A paper reports "BBH = 71.2" for a model checkpoint. Which piece of information is **most likely** missing from that headline that you should reach for first?

- A. Which GPU type was used during the evaluation run.
- B. Which of the four `bbh_*` prompting variants was used.
- C. The model's parameter count and pre-training corpus size.
- D. The decoding temperature and top-$p$ used to sample answers.

**Q2.** BIG-Bench Hard's 23 tasks were selected because:

- A. They are the easiest BIG-Bench tasks, chosen so that small open-source models could solve them at near-ceiling without exemplars.
- B. They are the BIG-Bench tasks where prior LMs under answer-only few-shot failed to beat the average human-rater baseline.
- C. They cover exactly 23 mutually disjoint reasoning domains, one task per domain, balanced between arithmetic and language.
- D. They are the BIG-Bench tasks with multiple-choice format and a fixed four-option layout, selected for harness compatibility.

**Q3.** On BBH, switching from answer-only few-shot to CoT few-shot moves Codex (`code-davinci-002`) from 56.6% to 73.9% averaged across tasks. Which of these is **not** a contributing reason CoT helps on this benchmark?

- A. CoT lets the model produce intermediate state on multi-step reasoning tasks where one decoded token is not enough compute.
- B. CoT exemplars demonstrate a richer answer format than direct exemplars.
- C. The CoT condition uses a different test set than the answer-only condition.
- D. The benchmark was specifically curated to surface tasks where CoT helps.

**Q4.** A safety practitioner reads a model's chain-of-thought and concludes it is reasoning honestly to a refusal. Which assumption are they implicitly making, and which Day 4 reference flags it as not always justified?

- A. They are assuming CoT is faithful to the model's actual decision; Turpin et al. 2023 shows this is often false.
- B. They are assuming CoT reduces decoding latency, which Wei et al. 2022 report is offset by the longer reasoning trace.
- C. They are assuming the model must be instruction-tuned to refuse, which contradicts Suzgun et al. 2022's results on base Codex.
- D. They are assuming the harness uses log-likelihood scoring on the full trace; in practice CoT requires generative decoding throughout.

**Q5.** Which of the following correctly describes the relationship between zero-shot CoT (`Let's think step by step.`) and few-shot CoT?

- A. They are equivalent prompting techniques given different names by Wei et al. 2022 and Kojima et al. 2022 in the same NeurIPS proceedings.
- B. Few-shot CoT prepends $k$ worked-reasoning exemplars; zero-shot CoT instead appends a trigger phrase, and is usually weaker.
- C. Zero-shot CoT is strictly stronger on BBH because the trigger phrase generalizes across tasks while hand-written exemplars overfit.
- D. Few-shot CoT only works on instruction-tuned chat models; zero-shot CoT is the only variant compatible with base pre-trained checkpoints.

**Q6.** On BBH, you observe that on the 23-task average CoT beats answer-only by +17 points, but on a specific sub-task (e.g., `causal_judgement`) the two prompting strategies are within noise. What is the right takeaway?

- A. The sub-task's evaluation pipeline is broken: its scoring rule is silently rejecting CoT outputs that don't match the regex format.
- B. The aggregate hides the per-task pattern: CoT helps on multi-step-reasoning tasks and is neutral on single-step recognition tasks.
- C. The model is overfitting to the CoT exemplars on the sub-task, memorizing their reasoning style without generalizing to the test items.
- D. The sub-task should be removed from BBH because it dilutes the headline CoT-vs-direct gap reported by Suzgun et al. 2022.

<details>
<summary>Answers</summary>

1. **B** — the four BBH variants in `lm-evaluation-harness` can produce scores that span 30+ points on the same model. A reader who doesn't know which variant was used cannot interpret the headline number.
2. **B** — see "Anchor: BIG-Bench Hard." The selection criterion is exactly the slice of BIG-Bench where answer-only few-shot underestimated frontier model capability against the human-rater baseline.
3. **C** — the test set is identical across conditions; that's the whole point of the comparison. A and B are the format-induction and reasoning-elicitation mechanisms; D is the curation criterion.
4. **A** — CoT is a transparency *surface*, not a guaranteed *window*. Turpin et al. 2023 demonstrate models producing rationalizations that do not drive their final answer (the "unfaithful CoT" failure mode). D9 returns to this with process supervision.
5. **B** — Kojima et al. 2022 introduced zero-shot CoT as the trigger-phrase variant; Wei et al. 2022 introduced few-shot CoT with hand-written exemplars. Both work; the few-shot variant is generally stronger when the exemplars are good.
6. **B** — BBH's per-task table tells a finer story than its aggregate. CoT unlocks multi-step-reasoning tasks (large gaps), is neutral on recognition tasks, and occasionally hurts. Reporting only the aggregate is what makes "BBH = 73.9" a less informative number than the underlying 23 numbers.

</details>
