import "server-only";
import { getAllLessonSummaries, getLessonByDay } from "./content";
import type { Quiz, QuizQuestion } from "./quiz";

/**
 * Quiz sampler used by the spaced-recall warm-up (top-of-lesson, 2 questions
 * sampled from prior days) and the end-of-week cumulative review (8 questions
 * sampled across the week's seven lessons).
 *
 * Sampling is deterministic per (currentDay/week, seedKey) so reloading a
 * lesson page returns the same warm-up. Per the locked decision, the
 * default seedKey is the host-level constant `"global"` — same questions
 * for every user on the host. The signature still takes seedKey so we can
 * swap to a per-session key later without touching call sites.
 */

export type SampledQuestion = QuizQuestion & {
  sourceDay: number;
};

export const DEFAULT_SEED_KEY = "global";
export const WARMUP_COUNT = 2;
export const WEEKLY_REVIEW_COUNT = 8;

// ---------------------------------------------------------------------------
// PRNG: xmur3 string hash + sfc32 generator. Tiny pure JS, deterministic.
// ---------------------------------------------------------------------------

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function makePrng(seed: string): () => number {
  const seedFn = xmur3(seed);
  return sfc32(seedFn(), seedFn(), seedFn(), seedFn());
}

/** Fisher-Yates with a supplied PRNG. Mutates a copy and returns it. */
function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Quiz pool — load every lesson once per request. Next.js dedupes
// `getLessonByDay` via React `cache()` already? It doesn't here, so we
// memoize at module scope per-request via a simple WeakMap keyed on a
// per-request token. Since RSCs are stateless across requests in
// production, a module-level Map is safe enough at this scale (28 small
// markdown files), and refreshes on dev hot-reload.
// ---------------------------------------------------------------------------

let cachedPool: Map<number, Quiz> | null = null;

export async function getAllLessonQuizzes(): Promise<Map<number, Quiz>> {
  if (cachedPool) return cachedPool;
  const summaries = await getAllLessonSummaries();
  const out = new Map<number, Quiz>();
  await Promise.all(
    summaries.map(async (s) => {
      const lesson = await getLessonByDay(s.day);
      if (lesson?.quiz) out.set(s.day, lesson.quiz);
    }),
  );
  cachedPool = out;
  return out;
}

/**
 * Flatten a (day → Quiz) map into an annotated question list, scoped to the
 * given day predicate.
 */
function flattenPool(
  pool: Map<number, Quiz>,
  predicate: (day: number) => boolean,
): SampledQuestion[] {
  const out: SampledQuestion[] = [];
  // Iterate in day order so the deterministic shuffle is over a stable
  // input ordering across runs.
  const days = [...pool.keys()].sort((a, b) => a - b);
  for (const day of days) {
    if (!predicate(day)) continue;
    const quiz = pool.get(day);
    if (!quiz) continue;
    for (const q of quiz.questions) {
      out.push({ ...q, sourceDay: day });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Warm-up sampler: 2 questions from days < currentDay, weighted toward
// recent days but include at least one from ≥3 days back when available.
// ---------------------------------------------------------------------------

export async function sampleWarmupQuestions(
  currentDay: number,
  seedKey: string = DEFAULT_SEED_KEY,
  n: number = WARMUP_COUNT,
): Promise<SampledQuestion[]> {
  if (currentDay <= 1) return [];
  const pool = await getAllLessonQuizzes();
  const all = flattenPool(pool, (d) => d < currentDay);
  if (all.length === 0) return [];

  const rand = makePrng(`${seedKey}:warmup:${currentDay}`);
  const recentCutoff = currentDay - 3; // days >= cutoff are "recent"
  const older = all.filter((q) => q.sourceDay < recentCutoff);
  const recent = all.filter((q) => q.sourceDay >= recentCutoff);

  const picks: SampledQuestion[] = [];
  // Per spec: "include at least one from ≥3 days back when available".
  if (older.length > 0) picks.push(shuffle(older, rand)[0]);
  // Fill the remainder from the recent bucket first, then fall back to
  // older. Don't pick the same question twice.
  const remainingNeeded = n - picks.length;
  const restPool = shuffle([...recent, ...older], rand);
  for (const q of restPool) {
    if (picks.length >= n) break;
    if (picks.some((p) => p.sourceDay === q.sourceDay && p.number === q.number)) continue;
    picks.push(q);
    if (picks.length >= remainingNeeded + (older.length > 0 ? 1 : 0)) break;
  }

  return picks.slice(0, n);
}

// ---------------------------------------------------------------------------
// Weekly cumulative review: 8 questions sampled across the week's 7
// lessons. Proportional sampling so each day contributes ≥1 question
// when the week has >= n lessons (always true for n=8 and 7 days, except
// one day contributes 2). Deterministic per (week, seedKey).
// ---------------------------------------------------------------------------

export type WeekNumber = 1 | 2 | 3 | 4;

export function weekRange(week: WeekNumber): { firstDay: number; lastDay: number } {
  const firstDay = (week - 1) * 7 + 1;
  return { firstDay, lastDay: firstDay + 6 };
}

export async function sampleWeeklyReview(
  week: WeekNumber,
  seedKey: string = DEFAULT_SEED_KEY,
  n: number = WEEKLY_REVIEW_COUNT,
): Promise<SampledQuestion[]> {
  const { firstDay, lastDay } = weekRange(week);
  const pool = await getAllLessonQuizzes();
  const rand = makePrng(`${seedKey}:weekly:${week}`);

  // Pick one question from each day in the week (deterministic), then
  // top up with additional questions sampled across the week's leftover
  // pool until we hit n.
  const picks: SampledQuestion[] = [];
  const leftovers: SampledQuestion[] = [];
  for (let day = firstDay; day <= lastDay; day++) {
    const quiz = pool.get(day);
    if (!quiz || quiz.questions.length === 0) continue;
    const shuffled = shuffle(quiz.questions, rand).map((q) => ({
      ...q,
      sourceDay: day,
    }));
    picks.push(shuffled[0]);
    for (let i = 1; i < shuffled.length; i++) leftovers.push(shuffled[i]);
  }

  const topUp = shuffle(leftovers, rand);
  for (const q of topUp) {
    if (picks.length >= n) break;
    picks.push(q);
  }

  // Final shuffle so question order isn't day-monotonic.
  return shuffle(picks.slice(0, n), rand);
}
