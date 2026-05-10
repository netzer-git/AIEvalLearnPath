---
day: 3
slug: open-ended-scoring
title: "Open-ended generation scoring: EM, F1, BLEU/ROUGE, and beyond"
week: 1
week_theme: Foundations of LLM evaluation
anchor_benchmark: TriviaQA
harness: lm-evaluation-harness
reading_time_minutes: 28
---

# Day 3 — Open-ended generation scoring: EM, F1, BLEU/ROUGE, and beyond

## The opening question

D1 ended with a sharp trade-off: multiple-choice scoring is automatic and cheap, but it only tests whether the model can pick a letter. Free-form generation tests what users actually do — typing a question and reading prose back — but somebody now has to decide whether the prose is *right*. That "somebody" used to be a regex. Then it was BLEU. Then it was ROUGE. Today it's increasingly another language model. None of these is a free lunch, and the failure modes are different for each.

This lesson is the deep dive on the free-form side of D1's contrast. We'll use **TriviaQA** (Joshi et al. 2017) as the lab — short-form factoid QA where the gold answer is one or a few tokens, so you can directly observe why exact match is too strict, why F1 helps a little, and why $n$-gram overlap metrics are a poor proxy for reasoning the moment outputs get longer than a noun phrase.

## What changes when the answer is free-form

In MMLU-style MC, the model's output space is `{A, B, C, D}` and scoring is set membership. In free-form, the output space is "any string the tokenizer can emit" and scoring becomes a *similarity function* — a deterministic-but-imperfect map from (prediction, reference) to a number in $[0, 1]$:

```mermaid
flowchart LR
    Q[Question] --> M{{"Model<br/>(stochastic)"}}
    M -->|free-form string| P[Prediction]
    R[Reference answer<br/>one or many] --> S[Similarity function]
    P --> S
    S --> Score[Per-item score in 0,1]
    Score --> Agg[Aggregation]
```

Every choice on the right of that diagram is a research argument. EM, F1, BLEU, ROUGE, BERTScore, and LLM-as-judge are five different similarity functions, and they disagree on which outputs count as correct. The rest of the lesson walks through them in roughly historical order.

## Anchor: TriviaQA (Joshi et al. 2017)

**TriviaQA** — *A Large Scale Distantly Supervised Challenge Dataset for Reading Comprehension* — was introduced by Mandar Joshi, Eunsol Choi, Daniel S. Weld, and Luke Zettlemoyer at ACL 2017 (arXiv:1705.03551).

Format and stats:

- **95K** human-authored question-answer pairs sourced from 14 trivia websites.
- **~650K** question-answer-evidence triples in total (the dataset pairs each QA with ~6 distantly-supervised evidence documents — Wikipedia articles or Web search results).
- The released `rc` (reading-comprehension) split has **138,384 train / 18,669 validation / 17,210 test** examples; the `unfiltered` split (where evidence isn't guaranteed to contain the answer) has **87,622 / 11,313 / 10,832**. Test labels are held out — evaluation goes through the official server.
- Each configuration has a `nocontext` variant that strips the evidence documents. `rc.nocontext` and `rc.wikipedia.nocontext` are how modern LLMs are evaluated: **closed-book**, no retrieval, the model has to know the answer from its parameters.

Why TriviaQA for *this* lesson? Three reasons:

1. **Answers are short** — usually 1–4 tokens (a person, a place, a date). That makes EM and F1 mechanically clean to demonstrate; you can compute both by hand on a single example.
2. **Answers have natural surface variation** — `Barack Obama` vs. `Obama` vs. `President Obama` vs. `Barack Hussein Obama II`. The dataset releases an *alias list* per question (Wikipedia redirects + manually curated) precisely because exact match against a single string would be unfair.
3. **It contrasts with MMLU on D1.** Same kind of "factual knowledge" probe, but the model now has to *produce* the answer, not pick it. The gap between a model's MMLU score and its TriviaQA closed-book score tells you something about generation vs. recognition.

A canonical lm-evaluation-harness run:

```bash
lm_eval \
  --model hf \
  --model_args pretrained=meta-llama/Llama-3.1-8B \
  --tasks triviaqa \
  --num_fewshot 5 \
  --batch_size 8
```

The harness's `triviaqa` task is closed-book by default (the `rc.nocontext` Wikipedia subset), prompts the model with the question, takes the generated continuation up to a stop string, and scores it with **exact match against the alias set**, ignoring case and punctuation. That's the official metric — which we'll now show is a deliberate choice, not the only one.

## Exact match (EM)

EM is the strictest possible scoring rule for free-form output:

$$
\text{EM}(\hat{y}, Y) = \mathbb{1}\bigl[\, \text{norm}(\hat{y}) \in \{\text{norm}(y) : y \in Y\} \,\bigr]
$$

where $\hat{y}$ is the model's prediction, $Y$ is the set of gold aliases, and $\text{norm}(\cdot)$ is a *normalization function* that lowercases, strips punctuation, removes English articles (`a`, `an`, `the`), and collapses whitespace. The normalization pipeline used in TriviaQA evaluation is the one inherited from SQuAD (Rajpurkar et al. 2016) and reused almost everywhere downstream.

**Why EM is too strict.** Consider the question *"Who painted the Mona Lisa?"*

| Prediction | Gold aliases | EM |
| --- | --- | --- |
| `Leonardo da Vinci` | {`Leonardo da Vinci`, `da Vinci`, `Leonardo`} | 1 |
| `Leonardo` | same | 1 |
| `It was Leonardo da Vinci.` | same | 0 (extra tokens) |
| `Leonardo di ser Piero da Vinci` | same | 0 (alias not in set) |
| `Da Vinci, Leonardo` | same | 0 (ordering) |

Normalization handles capitalization, articles, and punctuation, but it can't handle word-order variation, additional context tokens, or aliases that weren't pre-collected. EM systematically under-credits correct answers that don't match the canonical surface form.

The blunt mitigation is **alias expansion**: TriviaQA ships Wikipedia-redirect-derived alias sets per question, and modern QA harnesses (NaturalQuestions, HotpotQA) do the same. This raises EM by several points but doesn't fix the structural problem — the alias set is necessarily finite, and any free-form answer has infinite valid surface forms.

## Token-level F1

F1 relaxes EM from set membership to bag-of-tokens overlap. Treat both prediction and reference as multisets of (normalized) tokens; compute precision, recall, and their harmonic mean:

$$
P = \frac{|\hat{T} \cap T|}{|\hat{T}|}, \quad R = \frac{|\hat{T} \cap T|}{|T|}, \quad F_1 = \frac{2 P R}{P + R}
$$

where $\hat{T}$ and $T$ are the token bags. When multiple gold aliases exist, the reported F1 is the *max* over aliases.

On the Mona Lisa example with prediction `It was Leonardo da Vinci.` and gold `Leonardo da Vinci`:

- Normalized prediction tokens: `{it, was, leonardo, da, vinci}`
- Normalized reference tokens: `{leonardo, da, vinci}`
- Overlap: 3 tokens. $P = 3/5 = 0.6$, $R = 3/3 = 1.0$, $F_1 = 0.75$.

EM scores this 0; F1 scores it 0.75. F1 is mostly an improvement, but inherits structural problems. It is still:

- **Bag-of-words** — `dog bites man` and `man bites dog` get F1 = 1. Fine for short factoid answers, catastrophic for anything longer.
- **Tokenization-dependent** — the same answer scores differently under different tokenizers, and "tokens" in the SQuAD evaluation script means *whitespace-split words* after normalization, not BPE tokens. Subtle, and a source of harness disagreement.
- **Insensitive to entity boundaries** — `New York` (one place) shares tokens with `York` (a different place); F1 overweights overlap on common-word entities.

EM and F1 are the official TriviaQA metrics, and they are the *right* metrics for short-form factoid QA. The trouble starts when researchers reach for them on longer outputs.

## $n$-gram overlap: BLEU and ROUGE

Once outputs are sentence- or paragraph-length (machine translation, summarization, long-form QA), people generally reach for **BLEU** (Papineni et al. 2002) for translation-flavored tasks and **ROUGE** (Lin 2004) for summarization-flavored tasks. Both are $n$-gram overlap metrics; they differ mainly on which side of the precision/recall axis they emphasize.

### BLEU in 60 seconds

BLEU computes *modified $n$-gram precision* — for each $n$ in $\{1, 2, 3, 4\}$, the fraction of $n$-grams in the hypothesis that appear in any reference, capped by the reference's count of that $n$-gram (so a hypothesis that repeats `the the the the` doesn't get free credit). Then it geometric-means across $n$ and applies a brevity penalty to discourage truncated outputs:

$$
\text{BLEU} = \text{BP} \cdot \exp\left( \sum_{n=1}^{4} w_n \log p_n \right)
$$

with $w_n = 1/4$ uniform and brevity penalty $\text{BP} = \min(1, e^{1 - r/c})$ where $r$ is reference length and $c$ is candidate length. BLEU is **corpus-level**: the $p_n$ are aggregated over the whole test set before the geometric mean, which is why per-sentence BLEU is a different (and generally worse-correlated) thing from corpus BLEU.

### ROUGE in 60 seconds

**ROUGE-N** is the recall-oriented analog: the fraction of $n$-grams in the *reference* that appear in the hypothesis. **ROUGE-L** uses the longest common subsequence rather than fixed $n$. Summarization people prefer recall-orientation because they care that the reference's content is covered, not that the hypothesis stays brief.

### The well-known failure modes

Both metrics fail in the same families of ways. Pick any of these and you can construct a hypothesis that scores well while being wrong, or scores badly while being right:

1. **Paraphrase blindness.** `The bank refused the loan` and `The loan was denied by the bank` share almost no $n$-grams beyond unigrams. The 2006 EACL critique (Callison-Burch, Osborne, & Koehn) demonstrated this with translation systems where higher BLEU did *not* track human judgments — a result later formalized in Reiter's (2018) structured review of 284 BLEU-vs-human correlations across 34 papers.
2. **Ordering insensitivity** *(unigram BLEU/ROUGE-1)*. Bigram and higher partially fix this, but not robustly — `dog bites man` and `man bites dog` share all unigrams and most bigrams under loose tokenization.
3. **Brittleness to formatting.** A trailing period, a different quotation-mark style, or a tokenizer that splits contractions differently can move BLEU by points without changing semantics. This is why BLEU implementations (`sacrebleu`, NLTK's `bleu_score`, the original Moses script) report different numbers on the same outputs — there is no canonical BLEU.
4. **Reference-count sensitivity.** BLEU was designed for *multiple* references per item; with one reference the score is much noisier and lower. Most modern LLM-eval setups have one reference. Ehud Reiter's review concludes BLEU is defensible for *system-level* MT comparison with multiple references and indefensible for individual-text scoring or non-MT tasks — which is the regime most LLM evaluation now operates in.

The deeper point: $n$-gram overlap is a proxy for "writes the same words in roughly the same order." For short factoid answers (TriviaQA), there's not much room for the proxy to fail. For anything longer, the proxy starts measuring fluency and surface form rather than meaning.

> **Safety researcher's note.** A model trained to optimize BLEU (rare today, common in pre-2019 MT work) is a small instance of a recurring pattern: an imperfect proxy metric becomes a training objective and the model finds the cheapest way to maximize it — typically by producing $n$-grams that pattern-match the reference distribution rather than the reference *meaning*. This is the entry-level Goodhart story, and it generalizes: if you train against an LLM-as-judge (D22) or a reward model (D24), the model finds judge/RM-specific shortcuts. The metric drift is not a hypothetical — it's the default outcome unless you actively defend against it. We don't foreground Goodhart on D3, but this is where the curriculum starts collecting examples.

## Modern semantic alternatives

Three categories of metric tried to fix $n$-gram overlap's semantic blindness, in roughly chronological order.

### 1. Embedding-based: BERTScore

**BERTScore** (Zhang, Kishore, Wu, Weinberger, & Artzi, ICLR 2020; arXiv:1904.09675) replaces $n$-gram matching with cosine similarity between contextual embeddings:

1. Run the candidate and reference through a pretrained BERT-family model.
2. For each token in the candidate, find the reference token with the highest cosine similarity (greedy match).
3. Aggregate to precision (candidate-side max), recall (reference-side max), and F1.

This handles paraphrase — `denied` and `refused` end up close in embedding space — and partial credit for near-synonyms. It still struggles with negation (`the loan was denied` vs. `the loan was approved` are embedding-close), with longer outputs where small embedding differences accumulate, and with the choice of underlying encoder (BERTScore numbers from RoBERTa-large and from DeBERTa-xlarge are not directly comparable).

Other embedding-based metrics — **MoverScore**, **BLEURT** (a BERT fine-tuned on MT human judgments), **COMET** (the modern MT-eval workhorse) — sit on the same axis with different aggregation choices and different supervision signals. They're better than BLEU at correlating with human judgments; they're not perfect, and they require GPU at eval time.

### 2. Reward-model-based scoring

After RLHF, every aligned LLM ships with (or near) a **reward model** — a classifier trained on pairwise human preferences that scores any (prompt, response). Stiennon et al. (2020) showed reward models trained on human comparisons of summaries produced summaries that humans preferred over those optimizing ROUGE — early, direct evidence that the RM was a better target than the $n$-gram metric.

You can use a reward model as an evaluator: score each candidate response, aggregate. The catch is **calibration** — RMs are confident in ways that don't always match human judgments, and they encode the preferences of whoever labeled them. D24 is a full reprise on RewardBench and the calibration thread; the takeaway here is just that "use a trained scorer instead of a hand-coded metric" is the modern alternative.

### 3. LLM-as-judge

The frontier of automatic open-ended evaluation is **LLM-as-judge**: prompt a strong model (GPT-4, Claude) with the question, the reference (or not), and the candidate, and ask it to score or compare. Zheng et al. (2023, NeurIPS) — *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena* — established this methodology and documented its biases (position, verbosity, self-preference, bandwagon). On agreeable open-ended tasks, GPT-4-as-judge agrees with humans at roughly the level humans agree with each other (~80%).

This is the metric that's eaten the field for open-ended evaluation since 2023. **D22** is the full lesson; the pointer here is that when you see a paper score Llama-3 against GPT-4 on a free-form benchmark, the scorer is increasingly another LLM rather than BLEU/ROUGE, with all that implies for cost, reproducibility, and judge-specific systematic error.

## Where each metric earns its keep

For the rest of the curriculum, the rule of thumb is:

| Task shape | Metric | Why |
| --- | --- | --- |
| Short factoid QA (TriviaQA, NQ) | EM + F1 with alias expansion | Answers are short; alias sets handle most surface variation. |
| Math/code with verifiable answers (GSM8K, HumanEval) | Exact match on extracted answer / `pass@k` | Answer is a number or a program output — checkable. (D9, D11) |
| Long-form generation (summarization, open-ended) | LLM-as-judge with multiple judges or reward-model scoring | $n$-gram overlap is too weak; embedding-based is better but still misses meaning-level errors. (D22, D24) |
| Translation, system-level comparison | BLEU + COMET | BLEU is defensible *at system level* with multiple references; COMET is the modern complement. |
| Anything where you need fast, cheap, reproducible | The simplest sufficient metric — usually EM or F1 if you can get away with it | Cost and reproducibility matter. Don't reach for an LLM judge if regex would do. |

Most modern capability evals deliberately pick tasks with checkable answers (GSM8K, MATH, HumanEval, GPQA) precisely so they can avoid this whole question. The price is that "checkability" filters out the most realistic generation tasks — which is why D22 and D24 exist.

## Takeaways

1. Free-form scoring is a similarity function from (prediction, reference) to $[0, 1]$. EM, F1, BLEU, ROUGE, BERTScore, and LLM-as-judge are all candidates with different failure modes.
2. **EM** is too strict; **F1** with bag-of-tokens overlap is the workable default for short-form QA when paired with **alias expansion**. TriviaQA's official metrics are EM and F1 over Wikipedia-redirect alias sets.
3. **BLEU** (Papineni et al. 2002) and **ROUGE** (Lin 2004) are $n$-gram overlap metrics — paraphrase-blind, ordering-fragile, formatting-brittle. Defensible at *system level* with *multiple references* on the tasks they were designed for; misleading otherwise (Callison-Burch et al. 2006; Reiter 2018).
4. **Semantic alternatives** trade off compute and reproducibility for better human-judgment correlation: embedding-based (BERTScore, BLEURT, COMET), reward-model-based (Stiennon et al. 2020 lineage; D24), LLM-as-judge (Zheng et al. 2023; D22).
5. Pick the simplest metric your task admits. Reach for an LLM judge only when nothing cheaper captures the property you care about — and budget for the judge's biases and cost.

## References

- **Anchor.** Joshi, M., Choi, E., Weld, D. S., & Zettlemoyer, L. (2017). *TriviaQA: A Large Scale Distantly Supervised Challenge Dataset for Reading Comprehension.* ACL. arXiv:1705.03551. https://aclanthology.org/P17-1147/
- **SQuAD evaluation conventions.** Rajpurkar, P., Zhang, J., Lopyrev, K., & Liang, P. (2016). *SQuAD: 100,000+ Questions for Machine Comprehension of Text.* EMNLP. arXiv:1606.05250.
- **BLEU.** Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). *BLEU: a Method for Automatic Evaluation of Machine Translation.* ACL. https://aclanthology.org/P02-1040/
- **ROUGE.** Lin, C.-Y. (2004). *ROUGE: A Package for Automatic Evaluation of Summaries.* Text Summarization Branches Out (ACL workshop). https://aclanthology.org/W04-1013/
- **BLEU critiques.** Callison-Burch, C., Osborne, M., & Koehn, P. (2006). *Re-evaluating the Role of Bleu in Machine Translation Research.* EACL. https://aclanthology.org/E06-1032/ — and Reiter, E. (2018). *A Structured Review of the Validity of BLEU.* Computational Linguistics 44(3). https://aclanthology.org/J18-3002/
- **BERTScore.** Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). *BERTScore: Evaluating Text Generation with BERT.* ICLR. arXiv:1904.09675.
- **Reward-model scoring lineage.** Stiennon, N., Ouyang, L., Wu, J., Ziegler, D., Lowe, R., Voss, C., Radford, A., Amodei, D., & Christiano, P. (2020). *Learning to Summarize from Human Feedback.* NeurIPS. arXiv:2009.01325.
- **LLM-as-judge.** Zheng, L., Chiang, W.-L., Sheng, Y., et al. (2023). *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena.* NeurIPS Datasets and Benchmarks. arXiv:2306.05685. (Full treatment on D22.)
- **Harness.** EleutherAI, *lm-evaluation-harness*, `triviaqa` task. https://github.com/EleutherAI/lm-evaluation-harness/tree/main/lm_eval/tasks/triviaqa

## Quiz

**Q1.** A model is asked *"Who wrote Hamlet?"*. The gold alias set is `{Shakespeare, William Shakespeare}`. The model outputs `It was William Shakespeare.` Under the standard SQuAD-style normalization (lowercase, strip punctuation, drop articles), what are EM and F1?

- A. EM = 1, F1 = 1.0
- B. EM = 0, F1 = 1.0
- C. EM = 0, F1 ≈ 0.67
- D. EM = 1, F1 ≈ 0.67

**Q2.** Which of the following is **not** a documented failure mode of BLEU on individual-sentence scoring?

- A. Paraphrase blindness — semantically equivalent rewrites share few $n$-grams.
- B. Brittleness to formatting and tokenization differences.
- C. Length bias toward shorter hypotheses, even after the brevity penalty corrects for it.
- D. Sensitivity to the number of references — single-reference BLEU is much noisier than multi-reference BLEU.

**Q3.** TriviaQA's `rc.nocontext` configuration is the standard subset for evaluating modern LLMs. What does the `nocontext` part change?

- A. It strips the questions and replaces them with cloze-style fill-ins drawn from the evidence document spans, recasting the task as span prediction.
- B. It removes the evidence documents, forcing closed-book evaluation against parametric knowledge.
- C. It removes the gold answers and requires an LLM-as-judge to verify free-form predictions against the retrieved Wikipedia evidence.
- D. It removes the alias lists, forcing strict exact match against the single Wikipedia-canonical answer string per question.

**Q4.** BERTScore improves on BLEU primarily because:

- A. It aggregates corpus-level rather than per-sentence statistics, which stabilizes the geometric mean of $n$-gram precisions on short outputs.
- B. It replaces hard $n$-gram matching with cosine similarity over contextual embeddings, handling paraphrase.
- C. It removes the need for a reference by scoring the candidate against a fluency model fine-tuned on web text.
- D. It is symmetric in precision and recall — unlike BLEU, which is precision-only and bolts on a separate brevity penalty for length.

**Q5.** A team reports a 4-point BLEU improvement on a translation system. Which of the following is **least** supported by Reiter (2018)'s structured review?

- A. The improvement may not correspond to a human-judged quality improvement at the system level if measured with a single reference.
- B. Per-sentence BLEU correlates poorly with human judgment even when corpus-level BLEU does not.
- C. BLEU is reasonably defensible for diagnostic, system-level MT comparison with multiple references.
- D. A 4-point BLEU improvement is statistically guaranteed to be a meaningful gain in translation quality.

**Q6.** You're evaluating a long-form summarization system. Your team is choosing between ROUGE-L, BERTScore, and an LLM-as-judge setup. Which framing matches modern practice on this curriculum's terms?

- A. ROUGE-L's longest-common-subsequence formulation remains the gold standard for summarization; embedding- and judge-based alternatives add compute without measurably improving human correlation.
- B. LLM-as-judge is strictly dominant on long-form outputs; ROUGE-L and BERTScore are obsolete and should not appear in modern summarization papers.
- C. Each metric trades cost, reproducibility, and human-correlation differently — report the simplest sufficient one your task and budget admit.
- D. Reward-model scoring (D24) is the only defensible option for long-form generation, since $n$-gram and embedding metrics provably fail to track human preference.

<details>
<summary>Answers</summary>

1. **C** — after normalization, prediction tokens are `{it, was, william, shakespeare}` and the best-matching alias `william shakespeare` normalizes to `{william, shakespeare}`. EM = 0 (extra tokens). $P = 2/4 = 0.5$, $R = 2/2 = 1.0$, $F_1 = 2/3 \approx 0.67$. The takeaway: EM penalizes extra tokens, F1 forgives them via recall.
2. **C** — BLEU's brevity penalty is specifically the correction for length bias. The other three are well-documented failure modes (Callison-Burch et al. 2006; Reiter 2018).
3. **B** — `nocontext` strips the evidence documents so the model must answer from its parameters; this is how lm-evaluation-harness's `triviaqa` task is configured by default.
4. **B** — soft contextual-embedding similarity is the core idea; A and D are false (BERTScore is per-sentence and reports P/R/F1), and C is wrong (BERTScore needs a reference).
5. **D** — Reiter's review is precisely an argument *against* assuming BLEU deltas equate to quality gains, especially at sentence level or with single references. A, B, and C all match the review's conclusions.
6. **C** — the lesson's "where each metric earns its keep" framing: ROUGE-L is the cheap reproducible baseline, BERTScore adds paraphrase tolerance, LLM-as-judge correlates best with humans on long-form but costs more and brings its own biases (D22). A, B, and D each overclaim a single metric.

</details>
