# 28-day curriculum — topic + benchmark grid

This is the **Stage 1a** deliverable. It maps each of 28 daily lessons to one core principle/technique and one anchor benchmark. **Review gate: please read through and propose swaps before we move to lesson drafting.**

Format constraint: 28 distinct benchmarks, ~30 min/day, four 7-day weeks.

## Week themes

| Week | Theme | What you'll walk away with |
| --- | --- | --- |
| 1 | **Foundations of LLM evaluation** | Vocabulary, scoring formats, statistical hygiene, contamination, saturation. By Friday you can read any eval-paper methods section. |
| 2 | **Capability benchmarks** | The canonical "what can the model do" suites — knowledge, reasoning, math, code, SWE, multimodal, long-context. |
| 3 | **Alignment, safety, robustness** | Truthfulness, bias, toxicity, instruction-following, jailbreaks, sycophancy, dangerous capabilities. The safety-relevant eval landscape. |
| 4 | **Frontier evaluation methods** | LLM-as-judge, human preference, reward-model evals, reasoning-model / inference-time-scaling evaluation, agent / tool-use / web / OS benchmarks, contamination-resistant design. |

## Tooling threaded through the curriculum

Knowing the benchmark is half of evaluation literacy; knowing the harness that runs it is the other half. Each lesson surfaces the canonical harness for its anchor benchmark; the `Harness` column in each week's table records the per-lesson default. The three we lean on:

- **`lm-evaluation-harness`** (EleutherAI) — de-facto standard for static MC/log-likelihood evals (MMLU, HellaSwag, ARC, TruthfulQA, GSM8K, IFEval, …).
- **Inspect** (UK AI Safety Institute) — safety-leaning harness with first-class support for tool use, agents, and graders; canonical for HarmBench, GAIA, agentic + situational-awareness evals.
- **LightEval** (Hugging Face) — newer, leaderboard-aligned harness; useful when reproducing the Open LLM Leaderboard or comparing harness implementations.

Where a benchmark ships its own runner (HumanEval, SWE-Bench, RULER, WebArena, OSWorld), the lesson uses that and notes the harness mapping.

## Recurring thread: Goodhart's Law

> *"When a measure becomes a target, it ceases to be a good measure."*

Goodhart's Law is the central tension in LLM evaluation and a recurring overlay across the 28 lessons. Five days where it's foregrounded explicitly:

- **D6 (MMLU-Pro / contamination)** — the measure leaks into the training distribution, so the target shifts.
- **D15 (TruthfulQA)** — the benchmark's incentive structure rewards refusal/safety over truth.
- **D17 (SAD / situational awareness)** — the model learns it is *being evaluated* and conditions on that fact.
- **D22 (LLM-as-judge)** — systemic judge biases turn the measurement instrument itself into the optimization target.
- **D28 (METR autonomy suite)** — measuring "dangerous agency" without selecting for it is the open frontier-safety problem.

Lessons that don't foreground Goodhart still carry it as a sub-thread (e.g. HumanEval contamination on D11, judge-game incentives on D24, cost-axis gaming on D25).

## Recurring thread: calibration

Calibration is introduced on **D2** (HellaSwag — ECE, reliability diagrams as the framing for why log-likelihood scoring matters) and reprised at three later points so it accumulates rather than vanishes:

- **D15 (TruthfulQA)** — selective prediction / abstention vs. truth (the abstention move that TruthfulQA's incentive structure rewards is a calibration story, not a truth story).
- **D20 (Sycophancy)** — light callback: position-holding under challenge as a confidence-calibration question.
- **D24 (RewardBench)** — full reprise: reward-model confidence and how it composes with downstream sampling.

D18 (IFEval) intentionally does *not* carry the thread — it's constraint satisfaction, not confidence.

## Default anchor reading

For lessons whose canonical citations are not the benchmark paper itself, the curriculum defaults to:

- **D2 (calibration overlay):** Guo et al. 2017, *On Calibration of Modern Neural Networks*.
- **D9 (process supervision / math):** Lightman et al. 2023, *Let's Verify Step by Step* (PRM800K).
- **D15 (factuality landscape):** Ji et al. 2023, *Survey of Hallucination in Natural Language Generation*.
- **D17 (situational awareness / model organisms):** Anthropic, *Model Organisms of Misalignment* (Hubinger et al. 2024) + Laine et al. 2024, *Towards Evaluating AI Situational Awareness* (SAD). Apollo's *Frontier Models are Capable of In-Context Scheming* (Meinke et al. 2024) is referenced as a closing pointer, not a parallel anchor.
- **D20 (sycophancy):** Sharma et al. 2023, *Towards Understanding Sycophancy in Language Models* (Anthropic), with Perez et al. 2022 *Discovering Language Model Behaviors with Model-Written Evaluations* as the methodological forerunner.
- **D25 (reasoning / inference-time scaling):** OpenAI o1 system card (2024) for the methodological framing; Glazer et al. 2024 (FrontierMath) for the difficulty-ceiling overlay.

## The 28 lessons

### Week 1 — Foundations of LLM evaluation

| Day | Topic / Principle | Anchor benchmark | Harness | One-line rationale |
| --- | --- | --- | --- | --- |
| 1 | What is an LLM evaluation? Multiple-choice vs. free-form, leaderboards, model "ranking" vs. "scoring" | **MMLU** | lm-eval-harness | The most-cited LLM benchmark — best on-ramp for the rest of the field. |
| 2 | Multiple-choice scoring mechanics: log-likelihood, "letter-only", normalized vs. unnormalized (acc vs. acc_norm in lm-eval-harness output). Calibration as framing — why log-likelihoods matter (ECE, reliability diagrams). (Selective prediction moves to D15.) | **HellaSwag** | lm-eval-harness | Canonical 4-way commonsense MC; small enough to compute reliability curves and motivate calibration as a safety property (Kadavath et al., "Language Models (Mostly) Know What They Know"). |
| 3 | Open-ended generation scoring: EM, F1, $n$-gram metrics (BLEU/ROUGE) and their failure modes; modern semantic alternatives (BERTScore, embedding/RM/judge-based) | **TriviaQA** | lm-eval-harness | Short-form QA — clean lab for seeing why $n$-gram overlap is a poor proxy for reasoning and where semantic metrics take over. |
| 4 | Prompting strategies in evals: zero-shot, few-shot, chain-of-thought | **BIG-Bench Hard (BBH)** | lm-eval-harness | 23 tasks specifically curated for CoT-vs-direct gap. |
| 5 | Statistical hygiene in evals: sample size, error bars, scenario coverage | **HELM** (Stanford) | HELM (own harness) | Built explicitly around statistical rigor and breadth-of-scenario reporting. |
| 6 | Test-set contamination — definitions, detection (n-gram overlap, Min-K% Prob, canary strings, membership inference), decontamination | **MMLU-Pro** | lm-eval-harness | Re-curated MMLU specifically aimed at reducing contamination + raising difficulty; pairs with hands-on leakage forensics. |
| 7 | Benchmark saturation — why benchmarks "die" and we keep building new ones | **GPQA (Diamond)** | lm-eval-harness | Graduate-level science questions designed to be Google-proof and saturation-resistant. |

### Week 2 — Capability benchmarks

| Day | Topic / Principle | Anchor benchmark | Harness | One-line rationale |
| --- | --- | --- | --- | --- |
| 8 | Reasoning evaluation — deductive, multi-step | **ARC-Challenge** (AI2) | lm-eval-harness | Grade-school science questions that still require non-trivial reasoning. |
| 9 | Mathematical reasoning — CoT-vs-direct gap; LaTeX answer-extraction & equivalence; outcome- vs. process-supervised verifiers | **GSM8K + MATH (Hendrycks)** | lm-eval-harness | Two reference math benchmarks taught together: GSM8K for the CoT gap on saturated arithmetic, MATH for hard answer-extraction and PRM800K-style process supervision (Lightman et al., "Let's Verify Step by Step"). |
| 10 | Retrieval-Augmented Generation evaluation — noise robustness, negative rejection, information integration, **counterfactual robustness** (poisoned/conflicting retrieved context) | **RGB** (Chen et al. 2023, arXiv:2309.01431) | benchmark-native (RGB repo) + RAGAS | Reference RAG-robustness benchmark (Chen et al. 2023, *Benchmarking Large Language Models in Retrieval-Augmented Generation*) with the four explicit safety-adjacent dimensions; **RAGAS** is used as the metric scaffold (faithfulness, answer relevance, context precision/recall) on top of RGB's data. |
| 11 | Code generation — pass@k, exec-based scoring; **HumanEval contamination** and the contamination-resistant successor (LiveCodeBench, problems sampled post-cutoff) | **HumanEval** (+ **LiveCodeBench** as contamination-resistant overlay) | benchmark-native | HumanEval is where pass@k was defined (Chen et al. 2021) — the cleanest pedagogical anchor; LiveCodeBench (Jain et al. 2024) demonstrates the same methodology on uncontaminated post-cutoff problems. |
| 12 | Software-engineering tasks — real-world bug fixes | **SWE-Bench (Verified)** | benchmark-native (SWE-Bench harness) | Real GitHub issues + tests; the modern frontier of "agentic" code eval. |
| 13 | Multimodal — vision + language reasoning | **MMMU** | benchmark-native | College-level multi-discipline multimodal questions; tests reasoning, not perception alone. |
| 14 | Long-context evaluation — RULER's NIAH variants, multi-key/multi-value, variable tracking, common/frequent words, QA; explicit *effective context length* metric. Foils noted in a 1-paragraph design-space sidebar (LongBench-v2, ∞-Bench, BABILong); downstream lessons should not equate "long-context eval" with RULER alone. | **RULER** (Hsieh et al. 2024) | benchmark-native | Methodologically cleanest entry point for long-context: controllable difficulty, multiple sub-tasks, explicit effective-context-length metric. Long-context eval is multi-axis; RULER anchors the retrieval axis. |

### Week 3 — Alignment, safety, robustness

| Day | Topic / Principle | Anchor benchmark | Harness | One-line rationale |
| --- | --- | --- | --- | --- |
| 15 | Factuality vs. truthfulness — imitative falsehood (TruthfulQA's design and its critiques); selective prediction / abstention vs. truth (calibration reprise from D2); atomic-fact decomposition (FActScore, HaluEval) | **TruthfulQA** | lm-eval-harness | Anchor for the canonical "imitative falsehood" failure mode; the lesson then critiques its incentive structure (rewards refusal over truth) and traces where the field went next. |
| 16 | Bias evaluation — stereotype / social-group bias | **BBQ** (Bias Benchmark for QA) | lm-eval-harness | Tests bias in ambiguous and disambiguated contexts; the standard for stereotyping eval. |
| 17 | **Situational awareness** — does the model know it's being evaluated? SAD's three sub-suites (Facts / Influence / Identity-leverage from Laine et al. 2024); out-of-context reasoning (Berglund et al.). Apollo's *Frontier Models are Capable of In-Context Scheming* (Meinke et al. 2024) referenced in the closing as "what SA enables that we don't yet know how to measure cleanly" — pointer, not parallel anchor. | **Situational Awareness Dataset (SAD)** | Inspect | Pillar safety eval (Laine et al. 2024 + Berglund et al. on out-of-context reasoning); the "frontier safety" anchor of Week 3. (Replaces RealToxicityPrompts — toxicity-under-prompting absorbed into D19 HarmBench.) |
| 18 | Instruction-following / refusal calibration | **IFEval** | lm-eval-harness | Verifiable instructions ("answer in 3 bullet points") — automatic, no LLM-judge needed. |
| 19 | Jailbreaks — adversarial robustness of safety guardrails; **toxicity-under-prompting** as a special case of harm elicitation | **HarmBench** | benchmark-native (HarmBench runner); Inspect for adjacent jailbreak evals (StrongREJECT, AgentHarm) | Standardized red-teaming framework covering attack methods + automated harm classifiers; absorbs the RealToxicityPrompts thread (Perspective-API-scored continuations) as one harm category among many. |
| 20 | Sycophancy — does the model cave when challenged? Light calibration callback: position-holding under challenge as a confidence-calibration question. | **Anthropic Sycophancy Evals** | Inspect | Demonstrates the failure mode + offers reusable probes; foundational safety eval. |
| 21 | Dangerous-capability evaluation — bio / chem / cyber | **WMDP** (Weapons of Mass Destruction Proxy) | Inspect | Open proxy benchmark for hazardous knowledge; lets labs eval without releasing actual hazards. |

### Week 4 — Frontier evaluation methods

| Day | Topic / Principle | Anchor benchmark | Harness | One-line rationale |
| --- | --- | --- | --- | --- |
| 22 | LLM-as-a-judge — using a strong model to score open-ended outputs; systemic judge biases (self-preference, position, verbosity/length, bandwagon); **Arena-Hard-Auto** as an Arena-derived auto-judge eval | **WildBench** (with **MT-Bench** taught historically and **Arena-Hard-Auto** as overlay) | Inspect | WildBench (Lin et al. 2024) uses real WildChat-derived prompts and WB-Score/WB-Reward with explicit length-bias mitigation — the modern, less-saturated anchor. MT-Bench is covered as the methodology's origin (and to make the biases tangible); Arena-Hard-Auto contrasts as an auto-judge derived from human-preference data. |
| 23 | Pairwise human preference at scale — ELO / Bradley-Terry, why **human** preference is a different eval philosophy from auto-judging | **Chatbot Arena (LMSYS)** | benchmark-native (LMSYS Arena) | The de-facto industry leaderboard; the pedagogical contrast with D22 is precisely that Arena keeps the *human* in the loop — Arena-Hard-Auto (covered on D22) is the auto-judge derivative, not a substitute. |
| 24 | Reward-model evaluation — evaluating the evaluator. Full calibration reprise (D2 → D15 → D20 → D24): reward-model confidence is a calibration story, and how it composes with downstream sampling determines whether RM scores are usable. | **RewardBench** | benchmark-native (allenai/reward-bench); Inspect for adjacent safety/agent evals | The first systematic eval of reward models themselves; closes the RLHF loop. |
| 25 | Reasoning-model / inference-time-scaling evaluation — pass@1 vs. pass@1024 vs. cons@N, "think-time" budgets, accuracy-vs-cost Pareto frontiers; why a single scalar score no longer suffices once tokens/$ are an axis. | **AIME 2024/2025** (+ **FrontierMath** and the o1 system card as overlays) | benchmark-native (chain-budget instrumented) | Canonical o1/o3 evaluation; the methodological shift is cost-aware Pareto evaluation — accuracy can no longer be reported without tokens/$ on the x-axis. FrontierMath (Glazer et al. 2024) extends the difficulty ceiling; the o1 system card formalizes cost-axis reporting. |
| 26 | Agent benchmarks — tool use + multi-step task completion; **indirect prompt injection** as the frontier agent-safety threat model. GAIA covered as the historical predecessor (real-world questions requiring browsing/files/tools); WebArena is the anchor; AgentDojo (and InjecAgent secondary) as indirect-PI overlay. | **WebArena** (+ **GAIA** as historical predecessor, + **AgentDojo** as indirect-PI overlay) | benchmark-native (WebArena); Inspect for GAIA tasks | Self-hostable replica websites + reproducible task scoring; AgentDojo overlays attacker-controlled retrieved content — the threat surface that only exists once you have a real web agent. GAIA is the pedagogical and methodological forerunner. |
| 27 | Computer-use / OS-level agents; cross-application indirect-PI surfaces (files, clipboard, system dialogs) | **OSWorld** | Inspect | Cross-application tasks across real OS environments; the hardest agent benchmark today and the largest indirect-PI surface. |
| 28 | Autonomous-capability evaluation — horizon length, AI R&D, self-proliferation risk; the frontier-safety/policy lens | **METR autonomy suite (RE-Bench + general autonomous tasks)** | Inspect | Current gold standard for measuring "agency" and self-proliferation; the policy-relevant closer. (ARC-AGI considered and rejected — covered briefly under D7 saturation/D6 contamination instead.) |

## What's intentionally NOT in the grid (and why)

A 28-day broad survey can't cover everything. Worth flagging the second-priority topics that didn't make the cut so we can decide together whether to swap any in:

- **Multilingual eval** (e.g. MGSM, FLORES) — important but most safety work is English-first.
- **Mechanistic-interpretability evals** (SAE quality, feature evals) — adjacent field, deserves its own track.
- **Robustness benchmarks** (AdvGLUE, PromptBench) — partially covered by HarmBench (D19) and indirect-PI on D26.
- **GLUE / SuperGLUE / BIG-Bench (full)** — historical / saturated; will be referenced in D7 discussion.
- **Specialist domains** (medical: MedQA; legal: LegalBench) — too narrow for a survey.
- **ARC-AGI** — considered as the D28 closer; replaced by METR's autonomous-capability suite as the more policy-relevant frontier eval. ARC-AGI's contamination-resistant design is referenced under D6 (decontamination forensics) and D7 (saturation).

## Review checklist for you

Before we move to Stage 1b, please confirm or comment on:

1. **Week themes** — resolved: order kept (Foundations → Capabilities → Safety → Frontier).
2. **Benchmark choices** — resolved through expert review: RGB, LiveCodeBench, WildBench, Arena-Hard-Auto folded in; Anthropic Sycophancy retained with Sharma et al. 2023 as the canonical anchor.
3. **Math days** — resolved: collapsed to a single D9 covering both GSM8K and MATH (with PRM800K-style process supervision); D10 freed for RAG (RGB + RAGAS).
4. **Day 28 closer** — resolved: METR autonomy suite replaces ARC-AGI.
5. **Anchor papers** — resolved: defaults recorded above (Guo et al. on D2, Lightman et al. on D9, Ji et al. on D15, Anthropic Model Organisms + Laine et al. on D17, Sharma et al. on D20, o1 system card + Glazer et al. on D25). Per-lesson canonical paper + 1–2 secondary links chosen at draft time.
6. **Reasoning-model / inference-time-scaling evals** — resolved: added as new D25 (anchor AIME 2024/2025; FrontierMath + o1 system card as overlays). To make room, the original D25 (GAIA) and D26 (WebArena) were merged into a single agents-and-tool-use lesson at the new D26, with WebArena as the anchor and GAIA as the historical predecessor.
7. **Lesson scope clarifications** — resolved: D2 reframed as MC-scoring-dominant with calibration as framing (selective prediction moved to D15); D14 RULER kept as single anchor with foils sidebar (LongBench-v2, ∞-Bench, BABILong); D17 SAD as anchor with Apollo scheming (Meinke et al. 2024) as a closing "see also" pointer rather than a parallel anchor; D20 carries a light calibration callback; D24 carries the full calibration reprise.
8. **Harness mapping** — resolved: per-lesson default harness recorded in a new column on each week's table. Defaults: lm-eval-harness for static-MC weeks (1 + most of 2–3), Inspect for safety/agent (D17, D19, D20, D21, D22, D24, D27, D28), benchmark-native where the benchmark ships its own runner (D5 HELM, D10 RGB, D11 HumanEval, D12 SWE-Bench, D13 MMMU, D14 RULER, D23 Arena, D25 AIME, D26 WebArena).

**Stage 1a sign-off:** awaiting your explicit approval to lock the grid and move to Stage 1b (drafting `learning-plan/lessons/d01-what-is-an-eval.md`, which will lock the lesson template).
