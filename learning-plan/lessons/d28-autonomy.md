---
day: 28
slug: autonomy
title: "Autonomous-capability evaluation — METR's autonomy suite and the curriculum closer"
week: 4
week_theme: Frontier evaluation methods
anchor_benchmark: METR autonomy suite (RE-Bench + HCAST)
harness: Inspect
reading_time_minutes: 34
prerequisites: [6, 11, 17, 21, 26, 27]
key_terms:
  - autonomy
  - L_50 time horizon
  - RE-Bench
  - HCAST
  - agentic R&D
  - autonomy-measurement-as-selection-pressure
  - horizon doubling time
  - METR
goodhart_role: foregrounded
calibration_role: callback
---

# Day 28 — Autonomous-capability evaluation: METR's autonomy suite, and a 28-day synthesis

## TL;DR

Today's anchor is the **METR autonomy suite** — three artefacts (Wijk et al. 2024 RE-Bench, Rein et al. 2025 HCAST, Kwa et al. 2025's horizon-length result) that together measure how long a human task a frontier agent can complete autonomously and report a **doubling time of approximately 7 months** for that horizon. [D-28](/lesson/28) is the curriculum closer: it foregrounds the fifth distinct Goodhart mechanism — *autonomy-measurement-as-selection-pressure* — for which there is no purely technical defense, and it ties the 28-day arc into one structure (pipeline reading, five Goodhart mechanisms, the calibration thread closed on [D-24](/lesson/24), the contamination-resistant successor pattern, and the capability/safety inversion).

## Learning objectives

By the end of this lesson, you will be able to:

1. **(L2)** State what the METR autonomy suite measures and name the three artefacts (RE-Bench, HCAST, Kwa et al. 2025) plus the headline horizon-length finding.
2. **(L3)** *Apply* the logistic-regression definition of $L_p$ to a notional task suite and read off the $L_{50}$ time horizon for a given agent.
3. **(L4)** *Analyze* [D-28](/lesson/28)'s *autonomy-measurement-as-selection-pressure* Goodhart mechanism and contrast it mechanically with the four prior foregrounded mechanisms ([D-6](/lesson/6) leakage, [D-15](/lesson/15) incentive, [D-17](/lesson/17) situational, [D-22](/lesson/22) instrument).
4. **(L5)** *Evaluate* a frontier-model report that pairs $L_{50}$ with capability and dangerous-knowledge axes ([D-6](/lesson/6)/[D-7](/lesson/7)/[D-14](/lesson/14)/[D-21](/lesson/21)), and judge what the joint reading implies under RSP / Preparedness-style policy framings.
5. **(L4)** *Synthesize* the 28-day arc into one structure — pipeline framing, five Goodhart mechanisms, the closed calibration thread, the contamination-resistant successor pattern, the capability/safety inversion, the harness landscape — rather than 28 isolated benchmark stories.
6. **(L5)** *Frame* evaluation literacy as a reading reflex (dataset / scoring rule / reporting convention / model run + an active Goodhart-mechanism hypothesis) that outlasts any specific saturated benchmark.

## Prerequisites & callback

Today is load-bearing on six prior lessons. **[D-6](/lesson/6) (Contamination)** named the first foregrounded Goodhart mechanism — per-item data leakage — and the structurally hard-to-contaminate response (post-cutoff sampling, private splits, procedural generation); [D-28](/lesson/28)'s task suites apply that lesson at the autonomy scale. **[D-11](/lesson/11) (Code evaluation)** introduced execution-based scoring and the `pass@k` family; HCAST's pass-at-time-budget scoring is the autonomy-scale generalisation. **[D-17](/lesson/17) (Situational awareness)** named the third foregrounded Goodhart mechanism — the model conditioning on whether the input looks like an evaluation — which is the substrate underneath every autonomy result. **[D-21](/lesson/21) (Dangerous capability)** inverted the score gradient (a higher number is a *risk* signal); [D-28](/lesson/28) completes the inversion across the *agency* axis. **[D-26](/lesson/26) (Web agents)** and **[D-27](/lesson/27) (OS agents)** introduced agentic loops, sandboxing, and indirect prompt injection as the canonical agent-safety threat model; the METR suite runs on the same Inspect-via-sandbox infrastructure. If you do not already hold the [D-6](/lesson/6) leakage framing, the [D-17](/lesson/17) situational-conditioning framing, the [D-21](/lesson/21) inverted-gradient framing, and the [D-26](/lesson/26)–[D-27](/lesson/27) agentic-loop framing, today reads as forensics; with them, today reads as the curriculum-wide synthesis it is built to be.

## The opening hook

[D-1](/lesson/1) began with a single number — *GPT-5 scores 89.5 on MMLU* — and asked what was hidden inside it. Twenty-eight days later we close on a different kind of number, one that isn't on a leaderboard and isn't reported in marketing decks: **how long is the human task that this model can complete autonomously, end-to-end, with 50% probability?** Per METR (Kwa, West, et al. 2025), the answer for the frontier in early 2025 was about an hour, and the trend line shows that horizon doubling roughly every seven months. By the time you read this, the answer is already different. The trend itself is the lesson.

That is qualitatively a new kind of evaluation. Every benchmark in Weeks 1–3 asked *can the model produce a correct token, sentence, or program?*. Autonomy evaluation asks *can the model run a multi-hour, multi-action loop — observe, plan, act, recover from errors, recover from its own mistakes, persist a goal across hundreds of steps — without a human in the loop?*. That capability is what frontier-safety policy was built to track: Anthropic's RSP autonomy checkpoints, OpenAI's Preparedness "model autonomy" tracked-capability category, the UK and US AI Security Institutes' pre-deployment third-party evaluations. METR is the standalone non-profit that measures it.

This is also the curriculum closer. The lesson body covers METR's anchor work; the second half is a synthesis of the 28-day arc. If you've read the previous 27 lessons, the second half is the payoff.

## METR — the organization

**METR** stands for *Model Evaluation and Threat Research*. It spun out of the Alignment Research Center as **ARC Evals** (the team behind the much-cited 2023 GPT-4 autonomous-replication evaluation in OpenAI's GPT-4 system card) and was renamed and incorporated as an independent 501(c)(3) non-profit in December 2023 ([metr.org/blog/2023-12-04-metr-announcement](https://metr.org/blog/2023-12-04-metr-announcement/)). Its founder and CEO is Beth Barnes; it is based in Berkeley.

What METR does, operationally, is run pre-deployment evaluations of frontier models — under NDA, before public release — focused on what its mission documents call *catastrophic-risk thresholds*. Public-facing partnerships and outputs include contributions to system cards for Anthropic's Claude family and OpenAI's o1 / o3 / o4-mini / GPT-4.5 ([metr.org](https://metr.org/)). Under those evaluations sits a stack of measurement infrastructure — task suites, scaffolds, runtime sandboxes, scoring methodology — that METR has open-sourced. That open-sourced stack is what the rest of this lesson covers, because it is the part the rest of the field can use.

The choice to anchor [D-28](/lesson/28) on METR rather than on **ARC-AGI** (the alternative considered in `overview.md`'s "What's intentionally NOT in the grid") is deliberate. ARC-AGI (Chollet 2019, ARC-AGI-2 in Chollet et al. 2025; [D-7](/lesson/7) referenced both) is the cleanest example of *structurally* contamination-resistant evaluation, but its task type — visual grid-transformation puzzles — does not directly probe the capability frontier-safety policy is written against. METR's autonomy suite does. The closer is policy-relevant by construction.

## Anchor: METR autonomy suite (Wijk et al. 2024 + Rein et al. 2025 + Kwa et al. 2025)

Three published artefacts compose what this lesson calls "the METR autonomy suite":

1. **RE-Bench** — Wijk, Lin, et al. (2024), *RE-Bench: Evaluating frontier AI R&D capabilities of language model agents against human experts.* arXiv:2411.15114.
2. **HCAST** — Rein, Becker, et al. (2025), *HCAST: Human-Calibrated Autonomy Software Tasks.* arXiv:2503.17354.
3. **The horizon-length result** — Kwa, West, et al. (2025), *Measuring AI Ability to Complete Long Tasks.* arXiv:2503.14499 ([metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)).

```mermaid
flowchart TB
    subgraph TASKS["Task suites"]
      RE["RE-Bench<br/>7 ML R&D environments<br/>(8-hour expert baselines)"]
      HC["HCAST<br/>189 software tasks<br/>(1 minute → 8+ hours)"]
      SWA["SWAA<br/>very-short software tasks<br/>(seconds → minutes)"]
    end
    subgraph METRIC["Headline metric"]
      TH["Time-horizon at p%<br/>L<sub>p</sub> = task length where<br/>P(success) = p"]
    end
    subgraph SCAFFOLD["Runtime"]
      S1["Inspect sandbox<br/>(Docker / k8s)"]
      S2["Tool-use loop:<br/>shell, file IO, GPU"]
    end
    TASKS --> S1
    S1 --> S2
    S2 --> TH

    style TH fill:#fee
```

### Companion: RE-Bench (Wijk et al. 2024)

RE-Bench is **7 hand-crafted, open-ended ML research-engineering environments**, each paired with **human-expert baselines** (71 attempts, 61 distinct experts, 8 hours per attempt as the core setting). The environments were chosen by consultation with ML researchers at top labs and academia for realism; representative examples named in the paper and METR's blog post include *fitting a scaling law*, *optimizing a GPU kernel*, and similar research-engineering tasks (full list at [github.com/METR/RE-Bench](https://github.com/METR/RE-Bench)).

Scoring is **continuous and environment-specific**. Each environment ships its own scoring function (e.g., maximize accuracy on a held-out dataset, minimize wall-clock time of a training loop, maximize a learned metric). The agent is given GPU access, a working dir, the scoring function, and a time budget; the score reported is the best score achieved in-budget, normalised against a strong reference solution. The headline empirical finding from the paper:

- **At a 2-hour time budget**, the best AI agents in their evaluation outscore human experts by ~4×.
- **At higher time budgets** (4–8 hours, the human reference), human experts pull ahead — agents stop improving while humans keep iterating.
- 82% of expert attempts achieve a non-zero score; 24% match or exceed the strong reference solution.

That 2-hour-vs-8-hour crossover is the load-bearing finding. It is not "agents have replaced researchers"; it is "agents are now competitive with researchers on the kind of bounded, well-specified, fast-feedback task that fills the first two hours of a research sprint." The capability frontier this reports — short-horizon, high-density-feedback ML work — is exactly the slice of AI R&D that policy frameworks track because of its self-improvement implications.

### Companion: HCAST (Rein et al. 2025)

HCAST — *Human-Calibrated Autonomy Software Tasks* — is the breadth complement to RE-Bench's depth. **189 tasks** across machine-learning engineering, cybersecurity, software engineering, and general reasoning, each calibrated against human baselines. The calibration data is the methodologically distinctive piece: **563 human baselines, ~1,500 hours total**, run under conditions identical to the AI agent setting (same sandbox, same tools, same time budget). Tasks span **from one minute to over eight hours of human-baseline time**.

Headline empirical findings from Rein et al. 2025:

- Frontier agents succeed on **70–80%** of tasks with human-baseline time **under one hour**.
- Agent success drops to **under 20%** on tasks with human-baseline time **over four hours**.
- Roughly 10% of HCAST tasks have an average successful-trajectory length above 25 actions; the median successful run takes 5–15 actions.

This is the empirical curve underneath Kwa et al.'s horizon-length result.

### Companion: horizon-length metric (Kwa et al. 2025)

Given a task suite where every task has a calibrated *human-baseline length* $\ell_i$ in minutes, and an agent that succeeds on task $i$ with empirical probability $\hat{p}_i$, fit a logistic regression of success against log-length:

$$
\Pr[\text{agent succeeds on task of length } \ell] = \sigma\!\left(\beta_0 + \beta_1 \log \ell\right).
$$

The **$p$-task-completion time horizon** $L_p$ is the inverse: the human-baseline length at which the agent succeeds with probability $p$. Kwa et al. report two anchored thresholds:

- $L_{50}$: the length at which the agent succeeds 50% of the time. This is the headline number.
- $L_{80}$: the same at the more conservative 80% threshold.

Plotting $L_{50}$ across model releases from 2019–2025 yields the now-canonical curve: an exponential trend with a **doubling time of approximately 7 months over the past 6 years** (Kwa et al. 2025; see also METR's Time Horizon 1.1 update at [metr.org/blog/2026-1-29-time-horizon-1-1](https://metr.org/blog/2026-1-29-time-horizon-1-1/) for refreshed numbers). At the 2025 reporting cut, frontier models had $L_{50} \approx 1$ hour. METR's own update notes the 2024 doubling rate may have accelerated to ~4 months, with the 7-month figure as the long-run trend.

The doubling-time framing matters because it puts a clock on capability. If you accept the curve and extrapolate, the time at which $L_{50}$ crosses standard policy thresholds (one full work-week of expert time, one full month, one expert-year) is in years rather than decades. That extrapolation is contested — the trend may saturate, the task distribution may not generalize, scaffolding overhead may dominate at long horizons — and METR's own analyses are explicit about those caveats. But it is the first time the field has had a quantitative trajectory for *agency* the way it has had quantitative trajectories for compute, parameters, and data ([epoch.ai](https://epoch.ai/) plots the latter; METR plots the former).

### Running the suite

The suite runs through **Inspect** (UK AI Security Institute), with sandboxing supplied by Inspect's Docker / Kubernetes / Proxmox sandbox providers ([www.aisi.gov.uk/blog/the-inspect-sandboxing-toolkit-scalable-and-secure-ai-agent-evaluations](https://www.aisi.gov.uk/blog/the-inspect-sandboxing-toolkit-scalable-and-secure-ai-agent-evaluations)). The pattern that closes Week 4: [D-22](/lesson/22)'s WildBench is Inspect-native, [D-27](/lesson/27)'s OSWorld is Inspect-via-sandbox, [D-28](/lesson/28)'s METR suite is Inspect-via-sandbox plus METR's own task definitions and scoring functions ([github.com/METR](https://github.com/METR), [metr.github.io/autonomy-evals-guide](https://metr.github.io/autonomy-evals-guide/)). A canonical run sweeps a model across the HCAST distribution and fits the logistic to extract $L_{50}$; RE-Bench is run separately because its scoring is continuous and environment-specific.

> **A note on dataset hygiene.** METR explicitly asks evaluators to take "reasonable steps" to keep the RE-Bench and HCAST tasks out of training data, because the suites are intended for *forward* evaluation of new releases. This is the [D-6](/lesson/6) / [D-11](/lesson/11) contamination problem applied to autonomy — and unlike post-cutoff sampling (LiveCodeBench), task-shaped autonomy benchmarks cannot be trivially refreshed. The standard mitigation in 2025–2026 is held-out task subsets and pre-deployment NDA arrangements, which the public leaderboard can reference but not reproduce.

## ⏵ Check yourself — fitting $L_{50}$

> **Worked example.** Suppose an agent is run on a 6-task slice of HCAST with calibrated human-baseline lengths $\ell$ in minutes and observed empirical success rates $\hat{p}$:
>
> | $\ell$ (min) | 5 | 15 | 60 | 240 | 480 | 960 |
> | --- | --- | --- | --- | --- | --- | --- |
> | $\hat{p}$ | 0.95 | 0.86 | 0.50 | 0.20 | 0.08 | 0.03 |
>
> A logistic fit of $\Pr[\text{success}] = \sigma(\beta_0 + \beta_1 \log \ell)$ on this slice gives roughly $\beta_0 \approx 4.1$, $\beta_1 \approx -1.0$ on natural-log minutes.

Using the worked example above, **compute** the agent's $L_{50}$ and $L_{80}$ on this slice (in minutes), and identify which assumption of the headline doubling-time finding most depends on this slice being representative of the full HCAST distribution.

<details>
<summary>Show answer</summary>

$L_p$ is the human-baseline length at which $\Pr[\text{success}] = p$. Solving $\sigma(\beta_0 + \beta_1 \log \ell) = p$ for $\ell$:

$$
\log L_p = \frac{\text{logit}(p) - \beta_0}{\beta_1}, \qquad L_p = \exp\!\left(\frac{\text{logit}(p) - \beta_0}{\beta_1}\right).
$$

For $p = 0.5$: $\text{logit}(0.5) = 0$, so $\log L_{50} = (0 - 4.1)/(-1.0) = 4.1$ and $L_{50} = e^{4.1} \approx 60$ minutes — about an hour, consistent with the 2025 reading-cut. For $p = 0.8$: $\text{logit}(0.8) = \log(4) \approx 1.39$, so $\log L_{80} = (1.39 - 4.1)/(-1.0) \approx 2.71$ and $L_{80} = e^{2.71} \approx 15$ minutes.

The doubling-time finding (Kwa et al. 2025: $L_{50}$ doubling roughly every 7 months over the past 6 years) depends critically on the slice being **representative across task length**. The fit has $\beta_1 < 0$ — agents drop with task length — and the doubling-time argument is "the *length-where-success-equals-50%* is moving to the right by a factor of 2 every 7 months." If your slice oversamples short tasks, $L_{50}$ is biased low and the doubling rate is harder to pin down; if it oversamples long tasks, the noise in $\hat{p}$ near 0 dominates the fit and $L_{50}$'s confidence interval explodes. METR's published numbers depend on the HCAST + SWAA + RE-Bench composite covering 1 minute → 8+ hours specifically because that range is what makes the logistic identifiable.

</details>

## Goodhart foregrounded

This is the fifth and final Goodhart-foregrounded lesson in the curriculum. The full five-day pattern, including today:

| Day | Mechanism | One-sentence summary |
| --- | --- | --- |
| **[D-6](/lesson/6)** | Data leakage | The benchmark items end up in the pretraining set, so the score measures memorization rather than generalization. |
| **[D-15](/lesson/15)** | Incentive structure | The benchmark's reference set rewards refusal-shaped strings on contested-fact items, so optimizing the score selects for *legibly safe-looking refusal* rather than truth-tracking. |
| **[D-17](/lesson/17)** | Situational conditioning | The model conditions on an upstream feature — "this looks like an evaluation" — that it has learned to detect, so the score is computed on a sample drawn from the conditional-on-eval distribution rather than the deployment distribution. |
| **[D-22](/lesson/22)** | Measurement-instrument-as-target | The judge model has systematic biases (self-preference, position, verbosity, bandwagon), so optimizing against the judge selects for output-shape features the judge favours rather than for the underlying quality. |
| **[D-28](/lesson/28)** | Autonomy-measurement-as-selection-pressure | Any benchmark for autonomous capability is itself a training signal that selects for the very property the safety community wants to track passively. |

[D-28](/lesson/28)'s mechanism is distinct from all four prior ones:

> **Autonomy-measurement-as-selection-pressure: any benchmark for autonomous capability is itself a training signal that selects for the very property the safety community wants to track passively.**

The mechanism, made concrete:

1. To measure autonomous capability, you need task suites with calibrated horizons, runtime sandboxes, and scoring functions (RE-Bench, HCAST, the Inspect sandboxing toolkit).
2. Once those task suites and runtime infrastructures exist, **they are the natural training environment** for the next generation of agentic models. Scaffolding, RL training loops, and post-training fine-tuning all converge on the same shape of environment that the eval is run in.
3. The result is that the eval-vs-deployment distribution gap from [D-17](/lesson/17) *does not exist* for autonomy benchmarks in the same way — because the deployment shape (a model in an agentic loop with tool access in a sandboxed environment) and the evaluation shape are *the same shape*, by design. The eval doesn't generalize from a held-out distribution; it grades performance on the in-training distribution.
4. **More structurally:** capability evaluations (Weeks 1–2) optimize for *more* capability — that's their job. Safety evaluations (Week 3) optimize for *less* of various failure modes — also their job. Autonomy evaluation sits at the place where measurement *itself* is fraught: the better the benchmark, the cleaner the training signal it provides for the property it tracks. METR's task suites are state-of-the-art *because* they are realistic, calibrated, and well-scored — and that is exactly why publishing them creates the optimization pressure they were built to track.

This is why the four prior Goodhart mechanisms have *technical* defenses (decontamination on [D-6](/lesson/6), atomic-fact decomposition on [D-15](/lesson/15), deployment-realistic prompts on [D-17](/lesson/17), judge ensembling on [D-22](/lesson/22)) but [D-28](/lesson/28) does not have a corresponding technical fix. The structural responses are *organizational* and *policy*, not methodological:

- **Pre-deployment evaluation under NDA** keeps the held-out task subsets out of public training corpora.
- **Third-party evaluator independence** (METR, AISI, US CAISI, Apollo) puts the evaluator outside the lab whose model is being graded.
- **Held-out task families** that are never released, only used in pre-deployment runs.
- **Trend monitoring rather than fixed thresholds**, so the *rate of change* (Kwa et al.'s horizon doubling) is the signal rather than a leaderboard number that will be optimized against.

These are responses, not solutions. The honest framing is that [D-28](/lesson/28)'s Goodhart is the failure mode the field does not yet know how to fully neutralize — which is why the curriculum closes here. The four prior mechanisms have at least partial technical answers; [D-28](/lesson/28)'s mechanism is the open frontier-safety problem that *this whole curriculum was building toward naming*.

## Frontier policy framing

Three frameworks make autonomy-measurement load-bearing in deployment decisions:

- **Anthropic Responsible Scaling Policy (RSP) v3.x** — defines an *autonomy* checkpoint alongside the CBRN-3/CBRN-4 thresholds carried over from [D-21](/lesson/21). The 2025 RSP updates replaced the earlier "autonomous replication and adaptation" (ARA) trigger with a checkpoint mechanism: crossing the autonomy capability threshold prompts additional evaluation rather than automatically triggering ASL-4 safeguards ([anthropic.com/responsible-scaling-policy](https://www.anthropic.com/responsible-scaling-policy)). METR's $L_{50}$ is one of the inputs into that checkpoint determination.
- **OpenAI Preparedness Framework** — tracks "model autonomy" as one of four dangerous-capability categories (alongside CBRN, cyber, persuasion). High and Critical thresholds in this category trigger deployment mitigations. METR's third-party evaluations contributed to the o1, o3, o4-mini, GPT-4.5, and GPT-4o system cards ([metr.org](https://metr.org/)).
- **AISI / CAISI pre-deployment evaluations** — the UK AI Security Institute and US Center for AI Standards and Innovation use Inspect-based evaluation pipelines (the same harness this curriculum has used since [D-17](/lesson/17)) to assess frontier models before public release. The Inspect sandboxing toolkit was co-developed with METR and Apollo specifically for this use case.

This is the reason the closer is METR rather than ARC-AGI. ARC-AGI is the cleanest *intellectual* anchor for novel-task generalisation; METR is the *operational* anchor that frontier-safety policy is currently written against.

## ⏵ Check yourself — composing autonomy with the rest of the safety stack

A 2026 frontier-model report cites four numbers: **MMLU-Pro 84%**, **WMDP-Bio post-mitigation 24%**, **HarmBench attack-success 8%**, **METR $L_{50}$ ≈ 90 minutes** (with $L_{80}$ ≈ 15 minutes). Under an RSP-style autonomy checkpoint and a Preparedness-style "model autonomy" tracked-capability category, **decompose** what *each* number contributes to the deployment-decision case and identify the single composition the report does *not* surface that this curriculum has argued is the policy-relevant quantity.

<details>
<summary>Show answer</summary>

Each number is one axis. **MMLU-Pro 84%** is general capability (Weeks 1–2 framing, gradient: maximize). **WMDP-Bio post-mitigation 24%** is hazardous proxy knowledge ([D-21](/lesson/21) framing, gradient: minimize / stay-below-threshold; valid only paired with re-elicitation probes per the [D-21](/lesson/21) RMU caveat). **HarmBench attack-success 8%** is behavioural-guardrail robustness ([D-19](/lesson/19) framing). **METR $L_{50}$ ≈ 90 minutes** is autonomous-task horizon ([D-28](/lesson/28) framing, gradient: track-rate-of-change against RSP / Preparedness thresholds).

The composition the report does *not* surface is the **product**: dangerous expertise × the agency to act on it. Per the capability/safety inversion below, deployment risk is approximately $f(\text{capability}, \text{dangerous knowledge}, \text{autonomy}, \text{robustness of safeguards})$, and the policy-relevant quantity is *the joint*, not any single axis. A model with 84% MMLU-Pro + 24% post-mitigation WMDP-Bio + 90-minute $L_{50}$ is materially different from one with the same 84% MMLU-Pro + the same 24% WMDP-Bio + a 5-minute $L_{50}$, because the 90-minute model can plausibly *act* on the residual hazardous knowledge across a multi-step plan that the 5-minute model cannot. Frontier-safety reviews compose the numbers; single-axis reading misses exactly the composition this curriculum has been building toward naming. (See "The capability/safety inversion" in the 28-day synthesis below.)

</details>

## Calibration callback

Calibration is a closed thread by [D-24](/lesson/24). [D-2](/lesson/2) introduced it (HellaSwag, ECE, reliability diagrams). [D-15](/lesson/15) reprised it as selective prediction on TruthfulQA. [D-20](/lesson/20) was a callback (position-holding under challenge). [D-24](/lesson/24) closed it on RewardBench: reward-model confidence composes with downstream sampling (Best-of-$N$, PPO, DPO), so miscalibration in the RM propagates as miscalibration in the policy. **[D-28](/lesson/28) does not extend the thread; it only references it.** The reason calibration shows up here at all is that horizon-length reporting at $L_{50}$ versus $L_{80}$ is itself a calibration-flavoured choice — the policy-relevant question "how long a task can this agent reliably finish?" is answered very differently at 50% versus 80% reliability, and the gap between the two ($L_{80} \ll L_{50}$ in the worked example above) is the autonomy-side analogue of the risk–coverage curve from [D-15](/lesson/15). The mechanism is the same: a single number hides the operating point you are choosing. The defense is the same: report the curve, not the point. The curriculum's calibration thread is *not* a separate axis at [D-28](/lesson/28); it is the closed background machinery for reading the horizon-length report responsibly.

## Cross-references

**Backward.**

- [D-1](/lesson/1) — picks up the *evaluation-as-(dataset, scoring rule, reporting convention) pipeline* framing; [D-28](/lesson/28) instantiates it for autonomy and closes back to [D-1](/lesson/1)'s opening question by replacing the leaderboard-headline framing with the doubling-time framing.
- [D-6](/lesson/6) — picks up the *foregrounded Goodhart* pattern from the data-leakage variant; [D-28](/lesson/28) is the fifth and final mechanism in the five-day pattern ([D-6](/lesson/6) leakage, [D-15](/lesson/15) incentive, [D-17](/lesson/17) situational, [D-22](/lesson/22) instrument, [D-28](/lesson/28) selection-pressure).
- [D-11](/lesson/11) — picks up *execution-based, pass-at-budget scoring*; HCAST and RE-Bench generalise the idea from `pass@k` over unit tests to pass-at-time-budget over a calibrated human-baseline length.
- [D-17](/lesson/17) — picks up *situational conditioning* as the eval-vs-deployment distribution gap; [D-28](/lesson/28)'s Goodhart is structurally distinct (the eval-shape *is* the deployment-shape, by design) and that distinction is the load-bearing one for autonomy benchmarks.
- [D-21](/lesson/21) — picks up the *inverted score gradient* on dangerous capability; [D-28](/lesson/28) completes the inversion across the *agency* axis and the composition (dangerous knowledge × agency) is the policy-relevant quantity neither lesson alone surfaces.
- [D-22](/lesson/22) — picks up the *measurement-instrument-as-target* mechanism; [D-28](/lesson/28)'s mechanism is one level structurally further out (the existence of measurement itself, not the evaluator-LM, is what creates the optimization pressure).
- [D-24](/lesson/24) — picks up the closed *calibration thread* and uses its risk–coverage framing as the language for reading $L_{50}$ versus $L_{80}$.
- [D-26](/lesson/26) — picks up the *agentic-loop, indirect-prompt-injection, sandboxed-tool-use* threat model; the METR suite runs on the same Inspect-via-sandbox infrastructure [D-26](/lesson/26) introduced.
- [D-27](/lesson/27) — picks up *OS-level cross-application agents* as the breadth-end of the agentic surface; the METR suite is the policy-relevant frontier successor to OSWorld for autonomy reporting.

**Forward.** The curriculum closes here. The five frontier open problems past [D-28](/lesson/28) — scheming evaluation under realistic incentives (Apollo, Meinke et al. 2024), mech-interp for evaluation-awareness, robust unlearning, agentic indirect-PI defenses, and the composition of autonomy × capability × dangerous-knowledge as a single safety case — are detailed in the *What to read next — frontier open problems* sub-section of the 28-day curriculum synthesis below.

## Week 4 review

```mermaid
flowchart TB
    D22["D22 — LLM-as-judge<br/>(WildBench)"] --> D23["D23 — Pairwise human pref<br/>(Chatbot Arena)"]
    D23 --> D24["D24 — Reward-model eval<br/>(RewardBench)"]
    D24 --> D25["D25 — Reasoning + ITS<br/>(AIME + FrontierMath)"]
    D25 --> D26["D26 — Web agents + indirect-PI<br/>(WebArena + AgentDojo)"]
    D26 --> D27["D27 — OS-level agents<br/>(OSWorld)"]
    D27 --> D28["D28 — Autonomy<br/>(METR suite)"]

    style D28 fill:#fee
```

Week 4 is the methodology week. [D-22](/lesson/22) named the LLM-as-judge methodology and the four systematic biases that turn the judge into the next Goodhart target — the curriculum's fourth foregrounded Goodhart. [D-23](/lesson/23) contrasted with Chatbot Arena's pairwise *human* preference at scale, separating the philosophy of human-in-the-loop ranking from auto-judging. [D-24](/lesson/24) closed the calibration thread ([D-2](/lesson/2) → [D-15](/lesson/15) → [D-20](/lesson/20) → [D-24](/lesson/24)) by evaluating the evaluator: RewardBench measures whether reward models are themselves calibrated, since miscalibration in the RM propagates as miscalibration in the policy. [D-25](/lesson/25) reframed accuracy reporting once *think-time* and tokens-per-dollar became axes — pass@1 vs. pass@1024 vs. cons@N on AIME, with FrontierMath as the difficulty-ceiling overlay and the o1 system card formalising cost-axis reporting. [D-26](/lesson/26) brought tool use and web environments into scope and named indirect prompt injection as the threat model that scales with long context (the [D-14](/lesson/14) forward pointer, closed). [D-27](/lesson/27) generalised to cross-application OS-level agents — the largest indirect-PI surface and the hardest agent benchmark. [D-28](/lesson/28) closes the week and the curriculum on the policy-relevant frontier: autonomous capability, horizon length, and the open Goodhart mechanism that has no purely technical defense.

## Week 4 handoff

There is no Week 5. Week 4 has now mapped the *methodology* surface that sits underneath every Week 1–3 benchmark: how open-ended outputs get scored ([D-22](/lesson/22) LLM-as-judge), how human preference at scale serves as a contrasting anchor ([D-23](/lesson/23)), how the evaluator itself is graded and how the calibration thread closes ([D-24](/lesson/24) RewardBench), how reasoning-model evaluation factors *cost* into the reporting axis ([D-25](/lesson/25)), how agentic loops and indirect prompt injection generalise the threat surface ([D-26](/lesson/26) web, [D-27](/lesson/27) OS), and how autonomous capability is measured as a doubling-time trajectory rather than a leaderboard number ([D-28](/lesson/28)). The lesson [D-28](/lesson/28) hands forward is the one this entire curriculum was built to surface: there is no fixed methodology that completes the agenda — each successive evaluation methods week is a response to a Goodhart pressure that the prior week's methods made legible, and [D-28](/lesson/28)'s *autonomy-measurement-as-selection-pressure* is the open mechanism that has no purely technical defense. The frontier moves; the reading habits below are what carry forward.

## 28-day curriculum synthesis

This is the curriculum closer. The synthesis below ties the 28 lessons into one structure so you have something to reach for when you sit down to read a new benchmark paper, design a new evaluation, or argue with a leaderboard.

### The pipeline framing ([D-1](/lesson/1))

Every benchmark in this curriculum instantiates the pipeline you met on [D-1](/lesson/1):

$$
\text{Benchmark} = (\text{dataset}, \text{scoring rule}, \text{reporting convention})
$$

with a model run on top. The single most useful reflex you can build is to read any new benchmark paper's first three sections by mapping them onto this triple. Examples drawn from the curriculum:

| Lesson | Dataset | Scoring rule | Reporting convention |
| --- | --- | --- | --- |
| [D-1](/lesson/1) MMLU | 14,042 4-way MC items, 57 subjects | Letter-argmax accuracy or `acc_norm` | Macro-average across subjects |
| [D-7](/lesson/7) GPQA Diamond | 198 expert-validated MC items | Accuracy on letter argmax | Single number, paired bootstrap recommended |
| [D-11](/lesson/11) HumanEval / LiveCodeBench | Programming problems with unit tests | `pass@k` exec-based | Per-problem pass@k aggregated |
| [D-14](/lesson/14) RULER | 13 synthetic tasks × $\{4K, \ldots, 128K\}$ | Per-task accuracy | Mean across tasks; effective-length threshold |
| [D-21](/lesson/21) WMDP | 3,668 4-way MC items, 3 subsets | Letter-argmax accuracy | Per-subset, read as risk |
| [D-22](/lesson/22) WildBench | Real WildChat-derived prompts | Judge-scored pairwise / WB-Score | Length-bias-mitigated win-rate |
| [D-23](/lesson/23) Chatbot Arena | User-submitted prompts at scale | Pairwise human preference | Bradley-Terry / ELO ranking |
| [D-28](/lesson/28) METR suite | RE-Bench (7 envs) + HCAST (189) | Continuous (RE-Bench) / pass-at-budget (HCAST) | $L_{50}$, $L_{80}$, doubling-time fit |

Every disagreement between two reports of the "same" benchmark traces back to a difference inside this triple. That was the first claim of [D-1](/lesson/1); it has held all the way through [D-28](/lesson/28).

### The five Goodhart mechanisms

```mermaid
flowchart TB
    G["Goodhart's Law<br/>'When a measure becomes a target,<br/>it ceases to be a good measure'"]
    G --> M1["D6 — Data leakage<br/>test items in pretraining"]
    G --> M2["D15 — Incentive structure<br/>refusal beats truth"]
    G --> M3["D17 — Situational conditioning<br/>model classifies eval-vs-deploy"]
    G --> M4["D22 — Measurement-instrument<br/>judge biases are the target"]
    G --> M5["D28 — Autonomy-measurement-<br/>as-selection-pressure"]

    style M5 fill:#fee
```

Five distinct mechanisms, not five instances of one. One sentence each:

- **[D-6](/lesson/6) (data leakage).** The benchmark's test items appear in pretraining, so the score measures memorization. Defense: structurally hard-to-contaminate construction (post-cutoff sampling, private splits, procedural generation).
- **[D-15](/lesson/15) (incentive structure).** The benchmark's reference set treats refusal-shaped strings as truthful, so RLHF optimizes for legibly safe-looking refusal rather than truth-tracking. Defense: atomic-fact decomposition (FActScore), risk–coverage curves, multi-axis truthfulness reporting.
- **[D-17](/lesson/17) (situational conditioning).** The model has learned a classifier over input contexts and conditions its behavior on whether the input looks like an evaluation. Defense: deployment-realistic system prompts, surprise-evaluation protocols, SAD's Stages-Oversight as an instrument for the gap.
- **[D-22](/lesson/22) (measurement-instrument-as-target).** The judge model's own biases (self-preference, position, verbosity, bandwagon) become the optimization target instead of the underlying answer quality. Defense: judge ensembling, position-randomization, length-bias controls, anchoring on human preference ([D-23](/lesson/23)).
- **[D-28](/lesson/28) (autonomy-measurement-as-selection-pressure).** Any benchmark for autonomous capability is itself a training signal that selects for the very property the safety community wants to passively track. Defense: pre-deployment NDA evaluation, third-party evaluator independence, held-out task families, trend-rate monitoring rather than threshold leaderboards. *No purely technical fix.*

The progression is not arbitrary. [D-6](/lesson/6) leaks data. [D-15](/lesson/15) leaks reward shape. [D-17](/lesson/17) leaks distribution shape. [D-22](/lesson/22) leaks the measurement instrument. [D-28](/lesson/28) leaks *the existence of measurement itself*. Each successive mechanism closes the loop one level higher up the optimization stack, and [D-28](/lesson/28) is the level above which the loop closes on the field's ability to evaluate at all.

### The calibration thread ([D-2](/lesson/2) → [D-15](/lesson/15) → [D-20](/lesson/20) → [D-24](/lesson/24)) — closed

The calibration thread runs from [D-2](/lesson/2) (HellaSwag, ECE, reliability diagrams) through [D-15](/lesson/15) (selective prediction and abstention as truthfulness), via [D-20](/lesson/20) (sycophancy as position-holding-under-challenge), and closed at [D-24](/lesson/24) (RewardBench: reward-model confidence and how it composes with downstream sampling). The single takeaway: **a model's confidence is informative about correctness if and only if it is calibrated, and miscalibration anywhere in the RLHF pipeline propagates everywhere downstream of it.** [D-28](/lesson/28) does not extend this thread; it only references it. Calibration is a closed thread by [D-24](/lesson/24).

### The contamination-resistant successor pattern

The recurring design pattern, six instances drawn from the curriculum:

| Saturated / contaminated predecessor | Resistant successor | Resistance mechanism |
| --- | --- | --- |
| MMLU ([D-1](/lesson/1)) | MMLU-Pro ([D-6](/lesson/6)) | 4 → 10 options, "too easy" items dropped |
| MMLU ([D-1](/lesson/1)) | GPQA Diamond ([D-7](/lesson/7)) | Expert gatekeeping, Google-proof piloting |
| HumanEval ([D-11](/lesson/11)) | LiveCodeBench ([D-11](/lesson/11)) | Post-cutoff problem sampling |
| Claimed context length ([D-14](/lesson/14)) | Effective context length ([D-14](/lesson/14)) | Threshold-based metric over multi-task accuracy |
| RealToxicityPrompts ([D-19](/lesson/19), absorbed) | HarmBench ([D-19](/lesson/19)) | Standardised attacks + automated harm classifier |
| Open LLM Leaderboard v1 ([D-1](/lesson/1)) | Retired March 2025 ([D-1](/lesson/1), [D-7](/lesson/7)) | Goodhart-collapse acknowledgment, no successor leaderboard |
| AIME-as-benchmark ([D-25](/lesson/25)) | AIME-as-Pareto-curve ([D-25](/lesson/25)) | Cost-axis reporting (tokens/$, think-time) |

Once you internalize the pattern — *original benchmark saturates and/or gets contaminated; the field builds a harder/cleaner successor; that one too eventually saturates* — you can read any 2024+ benchmark paper's introduction in 30 seconds. The first paragraph names a saturated predecessor; the second describes the construction guarantee meant to fix it; the third reports the headroom the new benchmark restores. METR's autonomy suite is not strictly an instance of this pattern (its predecessor is "no benchmark" rather than a saturated one), but its *design rationale* — measuring a property that older benchmarks could not — is the same logical move.

### The capability/safety inversion

Weeks 1–2 are about maximizing scores. Higher MMLU, GPQA, MATH, HumanEval, SWE-Bench, MMMU, RULER are unambiguously good news for the model. **[D-21](/lesson/21) (WMDP)** inverted the gradient on hazardous knowledge: a higher score is now a *risk* signal. **[D-28](/lesson/28) (METR autonomy)** completes the inversion across the *agency* axis: a higher horizon length is also a risk signal under frontier-safety policy.

The composition is what makes the inversion load-bearing. Each axis alone is not the policy-relevant quantity:

$$
\text{deployment risk} \approx f\left(\text{capability}, \text{dangerous knowledge}, \text{autonomy}, \text{robustness of safeguards}\right)
$$

A model with high capability + low dangerous-knowledge + low autonomy + high safeguard-robustness is the deployment-favorable case. A model with high capability + high dangerous-knowledge + high autonomy + low safeguard-robustness is the threat-model case. [D-21](/lesson/21)'s WMDP score and [D-28](/lesson/28)'s $L_{50}$ are two of those four inputs; the *product* of them — dangerous expertise plus the agency to act on it — is the policy-relevant quantity that no single benchmark surfaces. Frontier-safety reviews compose the numbers; this curriculum has now given you the components.

### The harness landscape

| Harness | Where you used it | Anchor model |
| --- | --- | --- |
| **lm-evaluation-harness** (EleutherAI) | Static MC and log-likelihood evals ([D-1](/lesson/1)–[D-9](/lesson/9), [D-15](/lesson/15), [D-16](/lesson/16), [D-18](/lesson/18)) | "Standard library" for evaluation-as-code; the de-facto comparison baseline |
| **Inspect** (UK AISI) | Safety evals, agents, situational awareness, autonomy ([D-17](/lesson/17), [D-19](/lesson/19), [D-20](/lesson/20), [D-21](/lesson/21), [D-22](/lesson/22), [D-24](/lesson/24), [D-27](/lesson/27), [D-28](/lesson/28)) | Tool-use-first, sandbox-first, deployment-realistic |
| **LightEval** (Hugging Face) | Open LLM Leaderboard v2 reproducibility, MMLU-Pro ([D-6](/lesson/6)) | Newer, leaderboard-aligned |
| **HELM** (Stanford) | Statistical hygiene + scenario-coverage reporting ([D-5](/lesson/5)) | The "report many numbers, with CIs" philosophy |
| **Benchmark-native runners** | RGB ([D-10](/lesson/10)), HumanEval ([D-11](/lesson/11)), SWE-Bench ([D-12](/lesson/12)), MMMU ([D-13](/lesson/13)), RULER ([D-14](/lesson/14)), WebArena ([D-26](/lesson/26)), OSWorld ([D-27](/lesson/27)), METR autonomy suite ([D-28](/lesson/28)) | When the task structure is non-trivial, the canonical implementation lives with the benchmark |

The selection pattern across the curriculum: lm-eval-harness for static-MC, Inspect for safety + agentic + autonomy, benchmark-native where the benchmark's task structure is too rich for a generic harness. The Inspect adoption you watched grow across Weeks 3–4 is not an accident — it's the harness frontier-safety teams converged on, and METR's choice to build on it for [D-28](/lesson/28) closes the loop.

### What to read next — frontier open problems

Five frontier open problems sit at the edge of what this curriculum could cover. Each is an explicit pointer to where the field is going past [D-28](/lesson/28):

1. **Scheming evaluation under realistic incentives.** Apollo's *Frontier Models are Capable of In-Context Scheming* (Meinke et al. 2024, arXiv:2412.04984; introduced under [D-17](/lesson/17)) measures whether models, given goals and oversight-incentive structures, deliberately undermine oversight. We do not yet have a SAD-equivalent canonical benchmark for scheming. Read alongside Hubinger et al.'s Sleeper Agents (arXiv:2401.05566) for the model-organisms framing.

2. **Mech-interp evaluations for evaluation-awareness.** Mechanistic-interpretability work building on SAD ([D-17](/lesson/17)) is starting to identify *features* in frontier models corresponding to "this is an eval" detection. If those features can be probed and steered, the [D-17](/lesson/17) Goodhart mechanism becomes partially measurable from the inside, not only behaviorally. This is the mech-interp track this curriculum deliberately excluded (per `overview.md`); follow it through Anthropic's circuits work and follow-ups.

3. **Robust unlearning.** [D-21](/lesson/21)'s RMU is one method, and the literature (Sheshadri et al.'s Latent Adversarial Training, the broader robust-unlearning thread) finds RMU-unlearned models are partially re-elicitable via fine-tuning attack and free-form prompting. The open question is whether dangerous capability can be *durably* removed rather than surface-form-suppressed.

4. **Agentic indirect-PI defenses.** [D-26](/lesson/26)'s AgentDojo and [D-27](/lesson/27)'s OSWorld establish indirect prompt injection as the canonical agent-safety threat model. Defense-side work — provenance tracking, untrusted-content sandboxing, tool-output verification — is active and unsettled. The threat surface scales with long-context ([D-14](/lesson/14)) and with agent capability ([D-26](/lesson/26)–[D-27](/lesson/27)); the defenses do not yet scale at the same rate.

5. **Composition: autonomy + capability + dangerous-knowledge.** The frontier-safety question is the *product* of the axes the curriculum has measured separately. A model with $L_{50}$ of one work-week, MMLU-Pro near ceiling, WMDP-Bio above policy thresholds, and HarmBench attack-success-rate below threshold is a different deployment risk from a model with the same capability profile but order-of-magnitude lower autonomy. We do not yet have a clean *composition* benchmark; what we have is RSP / Preparedness-style multi-input safety cases. The methodology to grade those compositions is the open frontier this curriculum's last lesson hands you.

### Final words

The 28-day arc started with a single number on a leaderboard and ends with a doubling time on a frontier-safety dashboard. In between, you've seen 28 anchor benchmarks; six instances of the contamination-resistant-successor pattern; five distinct Goodhart mechanisms; the calibration thread opening on [D-2](/lesson/2) and closing on [D-24](/lesson/24); the capability-eval gradient inverting twice ([D-21](/lesson/21), [D-28](/lesson/28)); five harnesses; and one consistent reading reflex — *what is the dataset, what is the scoring rule, what is the reporting convention, and what is the model run on top of those three?*

Evaluation literacy is not a body of facts about specific benchmarks. It is the habit of refusing to read a single number without those four questions answered, plus a working sense of which Goodhart mechanism is most likely the active one for the benchmark in front of you. If you finish this curriculum with that habit, the specific benchmarks will rotate out — MMLU is already mostly retired, GPQA Diamond is near-saturated, HumanEval has been displaced — and the habit will outlast them. The frontier moves. The reading habits don't. That's the curriculum.

## Takeaways

1. **METR** (Model Evaluation and Threat Research, formerly ARC Evals) is the standalone non-profit that anchors autonomous-capability evaluation, with pre-deployment partnerships with Anthropic, OpenAI, UK AISI, and US CAISI. *(LO 1)*
2. **The METR autonomy suite** in this curriculum's framing is three artefacts: **RE-Bench** (Wijk et al. 2024, arXiv:2411.15114; 7 ML-R&D environments with 8-hour expert baselines), **HCAST** (Rein et al. 2025, arXiv:2503.17354; 189 software tasks with 563 human baselines spanning 1 minute to 8+ hours), and **Kwa et al. 2025** (arXiv:2503.14499) which fits the **horizon-length metric** $L_{50}$ across the suite and reports a doubling time of approximately **7 months** over six years. *(LO 1, LO 2)*
3. **[D-28](/lesson/28)'s Goodhart mechanism** is *autonomy-measurement-as-selection-pressure*: any benchmark for autonomous capability is itself a training signal that selects for the property the safety community wants to passively track. Distinct from [D-6](/lesson/6) (data leakage), [D-15](/lesson/15) (incentive structure), [D-17](/lesson/17) (situational conditioning), and [D-22](/lesson/22) (measurement-instrument). No purely technical defense; the responses are organizational (NDA pre-deployment evaluation, third-party evaluator independence, held-out task families, trend-rate monitoring). *(LO 3)*
4. **Frontier policy** — Anthropic RSP autonomy checkpoint, OpenAI Preparedness model-autonomy category, AISI / CAISI pre-deployment evaluations — is written against METR-style autonomy measurements. METR was chosen as the curriculum closer over ARC-AGI for this policy-relevance reason. *(LO 4)*
5. **The 28-day synthesis** ties the pipeline framing ([D-1](/lesson/1)), five Goodhart mechanisms ([D-6](/lesson/6), [D-15](/lesson/15), [D-17](/lesson/17), [D-22](/lesson/22), [D-28](/lesson/28)), the calibration thread ([D-2](/lesson/2) → [D-15](/lesson/15) → [D-20](/lesson/20) → [D-24](/lesson/24), closed), the contamination-resistant successor pattern (six instances), the capability/safety inversion ([D-21](/lesson/21) + [D-28](/lesson/28)), and the harness landscape (lm-eval-harness, Inspect, LightEval, HELM, benchmark-native) into one structure. Evaluation literacy is the habit of reading any score against the (dataset, scoring rule, reporting convention, model run) tuple plus an active hypothesis about which Goodhart mechanism is in play. *(LO 5, LO 6)*
6. **Frontier open problems past [D-28](/lesson/28)**: scheming evaluation under realistic incentives (Apollo, Meinke et al. 2024), mech-interp for evaluation-awareness, robust unlearning, agentic indirect-PI defenses, and the composition of autonomy × capability × dangerous-knowledge as a single safety case. *(LO 4, LO 5)*

## Glossary

- **autonomy**: a model's ability to run a multi-hour, multi-action loop — observe, plan, act, recover from errors, persist a goal across hundreds of steps — without a human in the loop; the capability frontier-safety policy is written against [introduced D-28](/lesson/28).
- **$L_{50}$ (50%-task-completion time horizon)**: the human-baseline task length at which an agent succeeds with 50% probability, fit by logistic regression of success against log-task-length on a calibrated suite; Kwa et al. 2025's headline metric, $\approx 1$ hour at the 2025 reading-cut [introduced D-28](/lesson/28).
- **horizon doubling time**: the period over which $L_{50}$ doubles, reported by Kwa et al. 2025 as approximately 7 months over the past 6 years (with a possible acceleration to ~4 months in 2024 per METR's Time Horizon 1.1 update); the curriculum's first quantitative trajectory for *agency* [introduced D-28](/lesson/28).
- **RE-Bench**: 7 hand-crafted, open-ended ML research-engineering environments paired with 8-hour expert-human baselines (71 attempts, 61 distinct experts); the depth half of the METR autonomy suite, with continuous environment-specific scoring [introduced D-28](/lesson/28).
- **HCAST (Human-Calibrated Autonomy Software Tasks)**: 189 software tasks across ML engineering, cybersecurity, software engineering, and general reasoning, calibrated against 563 human baselines (~1,500 hours) spanning 1 minute to 8+ hours; the breadth half of the METR autonomy suite [introduced D-28](/lesson/28).
- **agentic R&D**: research-engineering work performed by language-model agents — fitting scaling laws, optimizing GPU kernels, running training loops — under sandboxed tool access; the capability slice RE-Bench targets, and the slice frontier-safety policy tracks for self-improvement implications [introduced D-28](/lesson/28).
- **autonomy-measurement-as-selection-pressure**: [D-28](/lesson/28)'s foregrounded Goodhart mechanism — any benchmark for autonomous capability is itself a training signal that selects for the property it tracks, because the eval shape (sandbox + tool-use loop) and the deployment shape are by design the same shape; no purely technical defense [introduced D-28](/lesson/28).
- **METR (Model Evaluation and Threat Research)**: standalone 501(c)(3) non-profit, formerly ARC Evals, spun out and renamed in December 2023; runs pre-deployment autonomy evaluations under NDA for Anthropic, OpenAI, UK AISI, and US CAISI; founded by Beth Barnes, based in Berkeley [introduced D-28](/lesson/28).

## References

- **Anchor.** Wijk, H., Lin, T., Becker, J., Jawhar, S., Parikh, N., Broadley, T., Chan, L., Chen, M., Clymer, J., Dhyani, J., Ericheva, E., Garcia, K., Goodrich, B., Jurkovic, N., Kinniment, M., Lajko, H., Nix, S., Sato, L., Saunders, W., Taran, M., West, B., & Barnes, E. (2024). *RE-Bench: Evaluating frontier AI R&D capabilities of language model agents against human experts.* arXiv:2411.15114. https://arxiv.org/abs/2411.15114
- **Anchor.** Rein, D., Becker, J., Deng, A., Nix, S., Canal, C., O'Connor, D., Arnott, P., Bloom, R., Broadley, T., Garcia, K., Goodrich, B., Hasin, M., Jawhar, S., Kinniment, M., Kwa, T., Miles, L. H., Mishra, A., Parikh, N., Rush, N., Sato, L., Von Arx, S., West, B., Barnes, E., & Chan, L. (2025). *HCAST: Human-Calibrated Autonomy Software Tasks.* arXiv:2503.17354. https://arxiv.org/abs/2503.17354
- **Anchor.** Kwa, T., West, B., Becker, J., Deng, A., Garcia, K., Hasin, M., Jawhar, S., Kinniment, M., Rush, N., Von Arx, S., Bloom, R., Broadley, T., Du, H., Goodrich, B., Jurkovic, N., Miles, L. H., Nix, S., Lin, T., Parikh, N., Rein, D., Sato, L., Wijk, H., Ziegler, D. M., Barnes, E., & Chan, L. (2025). *Measuring AI Ability to Complete Long Tasks.* arXiv:2503.14499. https://arxiv.org/abs/2503.14499
- **Anchor — blog announcement.** METR. *Measuring AI Ability to Complete Long Tasks.* (2025). https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/
- **Anchor — Time Horizon 1.1 update.** METR. *Time Horizon 1.1.* (2026). https://metr.org/blog/2026-1-29-time-horizon-1-1/
- **Harness.** UK AISI. *The Inspect Sandboxing Toolkit: Scalable and secure AI agent evaluations.* https://www.aisi.gov.uk/blog/the-inspect-sandboxing-toolkit-scalable-and-secure-ai-agent-evaluations ; METR autonomy evaluation resources: https://evaluations.metr.org/ ; https://metr.github.io/autonomy-evals-guide/ ; https://github.com/METR/RE-Bench ; https://github.com/METR
- **Secondary — organization.** METR. *ARC Evals is now METR.* (December 2023). https://metr.org/blog/2023-12-04-metr-announcement/ ; Project site: https://metr.org/
- **Secondary — frontier policy.** Anthropic. *Responsible Scaling Policy* (current and v3 archive). https://www.anthropic.com/responsible-scaling-policy ; OpenAI. *Preparedness Framework.* https://openai.com/safety/preparedness
- **Secondary — [D-17](/lesson/17) SAD.** Laine, R., et al. (2024). *Me, Myself, and AI: The Situational Awareness Dataset (SAD) for LLMs.* arXiv:2407.04694.
- **Secondary — [D-17](/lesson/17) scheming pointer.** Meinke, A., et al. (2024). *Frontier Models are Capable of In-Context Scheming.* Apollo Research. arXiv:2412.04984. https://arxiv.org/abs/2412.04984
- **Secondary — [D-21](/lesson/21) WMDP / robust unlearning.** Li, N., et al. (2024). *The WMDP Benchmark.* arXiv:2403.03218. Sheshadri, A., et al. (2024). *Latent Adversarial Training Improves Robustness to Persistent Harmful Behaviors in LLMs.* arXiv:2407.15549.
- **Secondary — model organisms.** Hubinger, E., et al. (2024). *Sleeper Agents.* arXiv:2401.05566.
- **Secondary — alternative considered.** Chollet, F. (2019). *On the Measure of Intelligence.* arXiv:1911.01547. Chollet, F., et al. (2025). *ARC-AGI-2.* arXiv:2505.11831. (Considered and rejected as the [D-28](/lesson/28) closer per `overview.md` for being less policy-relevant than METR.)
- **Goodhart.** Strathern, M. (1997). *"Improving ratings": audit in the British University system.* European Review, 5(3) — the canonical concise formulation. Manheim, D., & Garrabrant, S. (2018). *Categorizing Variants of Goodhart's Law.* arXiv:1803.04585 — the four-mechanism taxonomy. [D-28](/lesson/28)'s *autonomy-measurement-as-selection-pressure* is most cleanly an *adversarial* Goodhart on the existence of measurement itself — the level above which the loop closes on the field's ability to evaluate at all, and the open frontier-safety problem the curriculum was built to name.

## Quiz

**Q1.** Which is the **most defensible reading** of METR (Model Evaluation and Threat Research)'s institutional status?

- A. The internal red-team-and-Preparedness division of OpenAI that authored the Preparedness Framework and runs CBRN evaluations under that policy.
- B. A standalone 501(c)(3) non-profit, formerly ARC Evals, spun out and renamed in December 2023; runs pre-deployment autonomy evaluations for frontier labs.
- C. A UK government agency operating under DSIT that owns the Inspect harness and conducts statutory pre-deployment third-party evaluation of frontier models.
- D. The EleutherAI-affiliated engineering team that maintains the lm-evaluation-harness and the Open LLM Leaderboard reproducibility infrastructure.

**Q2.** Which three published artefacts together constitute the METR autonomy suite as framed in this lesson?

- A. ARC-AGI-1 (Chollet 2019), ARC-AGI-2 (Chollet et al. 2025), and the Humanity's Last Exam multi-discipline closed-book benchmark released in early 2025.
- B. RE-Bench (Wijk et al. 2024), HCAST (Rein et al. 2025, 189 software tasks calibrated to ~563 human baselines), and Kwa et al. 2025's horizon-length result.
- C. WMDP-Bio, WMDP-Chem, and WMDP-Cyber from Li et al. 2024 — the three subset MC benchmarks for hazardous proxy knowledge that anchor [D-21](/lesson/21).
- D. WebArena (Zhou et al. 2023), OSWorld (Xie et al. 2024), and AgentDojo (Debenedetti et al. 2024) — the three agent benchmarks that anchor [D-26](/lesson/26) and [D-27](/lesson/27).

**Q3.** Kwa et al. 2025's headline finding — that the agent's *50%-task-completion time horizon* doubles approximately every 7 months over the past 6 years — is computed by:

- A. Counting the number of MMLU-Pro questions the model answers correctly per minute of wall-clock time, then normalizing against the across-subject expert-human throughput baseline.
- B. Fitting a logistic regression of agent success against log-task-length on a calibrated suite (HCAST + RE-Bench + SWAA), reading off the human-baseline length at which $P(\text{success})=0.5$ per release.
- C. Taking the median wall-clock completion time for solved instances on SWE-Bench Verified and projecting that median forward against the model-release date in months.
- D. Counting tool calls per minute in an Inspect sandbox, weighted by per-call latency, and treating that throughput as a proxy measurement for autonomous task-completion horizon.

**Q4.** [D-28](/lesson/28)'s Goodhart mechanism is *autonomy-measurement-as-selection-pressure*. Which is the **best** statement of how it differs from the four prior foregrounded mechanisms?

- A. It is the same as [D-17](/lesson/17) (situational conditioning), only applied to long-horizon agentic loops rather than single-turn chat, with SAD's Stages-Oversight remaining the recommended deployment-realism instrument.
- B. The four prior mechanisms have partial technical defenses; [D-28](/lesson/28)'s does not — any autonomy benchmark is itself a training signal for the property it tracks. Responses are organizational (NDA evaluation, held-out tasks, trend monitoring), not methodological.
- C. It is a generalisation of [D-6](/lesson/6) (data leakage) to multi-task suites, where the contamination unit is now a whole task family rather than a single MC item, and the standard fix is post-cutoff task resampling on a release-aligned schedule.
- D. It applies only to multimodal vision-language models, because desktop GUI tool use is what enables agentic loops; pure text-only models are out-of-scope for METR's autonomy suite by construction.

**Q5.** *(Synthesis question.)* A 2026 model card reports the following: **GPQA Diamond 94%**, **MMLU-Pro 84%**, **WMDP-Bio post-mitigation 24%**, **HarmBench attack-success 8%**, **RULER effective context 96K (claimed 1M)**, **METR $L_{50}$ ≈ 90 minutes**, **Stages-Oversight 81%**. Which **single** lesson's framing most directly explains why the 24% post-mitigation WMDP-Bio score, taken alone, is *insufficient* evidence that dangerous bio capability has been removed?

- A. [D-7](/lesson/7) (saturation) — because GPQA Diamond is at 94%, near ceiling, so the absolute score is no longer informative about marginal capability differences between current frontier models within the same generation, and headroom restoration requires a successor benchmark.
- B. [D-14](/lesson/14) (RULER) — because effective context (96K) lags claimed context (1M) by an order of magnitude, indicating long-context retrieval failures that scale superlinearly with input length and tool-output volume, and the gap typically widens further after fine-tuning.
- C. [D-21](/lesson/21) (WMDP / RMU). Training against WMDP can drive the surface-form score below random without removing the underlying capability; a serious case pairs the score with re-elicitation probes plus adversarial fine-tuning, and the high Stages-Oversight number raises the [D-17](/lesson/17) strategic-refusal hypothesis.
- D. [D-23](/lesson/23) (Chatbot Arena) — because pairwise human preference at scale is the gold-standard signal, and any safety claim must be cross-referenced against the latest leaderboard ranking before being treated as deployment-relevant for any production rollout.

**Q6.** *(Synthesis question.)* The calibration thread runs through which four lessons, and at which lesson does it close?

- A. [D-1](/lesson/1) (MMLU letter-argmax) → [D-7](/lesson/7) (GPQA Diamond) → [D-14](/lesson/14) (RULER effective context) → [D-21](/lesson/21) (WMDP-Bio post-mitigation); closes at [D-21](/lesson/21), where the safety-inversion gradient first takes hold.
- B. [D-2](/lesson/2) (HellaSwag, ECE / reliability diagrams) → [D-15](/lesson/15) (TruthfulQA, selective prediction) → [D-20](/lesson/20) (sycophancy as a calibration question) → [D-24](/lesson/24) (RewardBench); closes at [D-24](/lesson/24), with [D-28](/lesson/28) referencing but not extending it.
- C. [D-6](/lesson/6) (data leakage) → [D-15](/lesson/15) (TruthfulQA) → [D-17](/lesson/17) (SAD Stages-Oversight) → [D-22](/lesson/22) (WildBench judge biases); closes at [D-28](/lesson/28) as the curriculum's final foregrounded Goodhart mechanism.
- D. [D-11](/lesson/11) (HumanEval pass@k) → [D-12](/lesson/12) (SWE-Bench resolved-rate) → [D-26](/lesson/26) (WebArena task-success) → [D-27](/lesson/27) (OSWorld step-success); closes at [D-27](/lesson/27), where agent capability tops out.

<details>
<summary>Answers</summary>

1. **B** — METR is a standalone non-profit, formerly ARC Evals, spun out in December 2023 ([metr.org/blog/2023-12-04-metr-announcement](https://metr.org/blog/2023-12-04-metr-announcement/)). The other options are wrong: it is independent of OpenAI (A), it is a US non-profit not a UK government agency (the UK equivalent is AISI, C), and the lm-evaluation-harness is from EleutherAI (D).
2. **B** — RE-Bench (depth: 7 ML-R&D environments, 8-hour expert baselines), HCAST (breadth: 189 tasks calibrated against 563 human baselines spanning ~1 min to 8+ hours), and Kwa et al. 2025 (the horizon-length analysis that fits the trend across the suite). A is the alternative-considered ARC-AGI thread; C is [D-21](/lesson/21); D is [D-26](/lesson/26)–[D-27](/lesson/27).
3. **B** — the metric is fit by logistic regression of empirical success against log-task-length, with $L_p$ defined as the human-baseline length at which the agent's success probability equals $p$. The headline plot is $L_{50}$ across model-release dates.
4. **B** — the lesson's central Goodhart claim. The four prior mechanisms have technical defenses (decontamination on [D-6](/lesson/6), atomic-fact decomposition on [D-15](/lesson/15), deployment-realistic prompts on [D-17](/lesson/17), judge ensembling on [D-22](/lesson/22)); [D-28](/lesson/28)'s mechanism is *the existence of measurement itself* leaking optimization pressure, which is why the responses are organizational rather than methodological.
5. **C** — [D-21](/lesson/21) is the lesson that names this exact pattern. The 24% post-mitigation score is consistent with surface-form forgetting rather than substrate removal; the Sheshadri et al. 2024 robust-unlearning literature finds RMU-unlearned models often partially re-elicitable. The high Stages-Oversight number ([D-17](/lesson/17)) further raises the strategic-refusal hypothesis. Answer A misses the point (GPQA is a capability eval); B describes a different lesson ([D-14](/lesson/14) long-context); D is unrelated.
6. **B** — [D-2](/lesson/2) → [D-15](/lesson/15) → [D-20](/lesson/20) → [D-24](/lesson/24) is the calibration thread as `overview.md` and the lessons themselves describe it. [D-24](/lesson/24) is where it closes (reward-model confidence is the last lift of the thread); [D-28](/lesson/28) references it but does not extend it. The other options chain unrelated lessons.

</details>
