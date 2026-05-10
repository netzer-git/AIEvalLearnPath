import { notFound } from "next/navigation";
import Link from "next/link";
import {
  sampleWeeklyReview,
  weekRange,
  type WeekNumber,
} from "@/lib/quiz-pool";
import { getAllLessonSummaries } from "@/lib/content";
import { loadProgress } from "@/lib/progress";
import QuizSection from "@/components/Quiz";

export async function generateStaticParams() {
  return [{ week: "1" }, { week: "2" }, { week: "3" }, { week: "4" }];
}

// The locked/unlocked state and previous-attempt readout come from the
// per-host JSON store, so render dynamically instead of caching.
export const dynamic = "force-dynamic";

const WEEK_THEMES: Record<WeekNumber, string> = {
  1: "Foundations of LLM evaluation",
  2: "Capability benchmarks",
  3: "Alignment, safety, robustness",
  4: "Frontier evaluation methods",
};

export default async function WeekReviewPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week: weekStr } = await params;
  const week = Number.parseInt(weekStr, 10);
  if (week !== 1 && week !== 2 && week !== 3 && week !== 4) notFound();
  const w = week as WeekNumber;
  const { firstDay, lastDay } = weekRange(w);

  const [questions, summaries, progress] = await Promise.all([
    sampleWeeklyReview(w),
    getAllLessonSummaries(),
    loadProgress(),
  ]);

  const weekLessons = summaries.filter(
    (s) => s.day >= firstDay && s.day <= lastDay,
  );
  const completedDays = new Set(
    Object.keys(progress.lessons).map((k) => Number.parseInt(k, 10)),
  );
  const completedInWeek = weekLessons.filter((l) =>
    completedDays.has(l.day),
  ).length;
  const locked = completedInWeek < weekLessons.length;
  const previousAttempt = progress.weekly[String(w)] ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Dashboard
      </Link>
      <header className="lesson-header">
        <p className="lesson-eyebrow">
          Week {w} review &middot; {WEEK_THEMES[w]}
        </p>
        <h1 className="lesson-title">
          <span className="lesson-day">Cumulative review</span>
          <span className="lesson-title-text">
            Days {firstDay}–{lastDay}
          </span>
        </h1>
        <p className="lesson-meta">
          {questions.length} questions sampled across the week ·{" "}
          {completedInWeek} / {weekLessons.length} lessons complete
        </p>
      </header>
      <QuizSection
        variant="weekly"
        week={w}
        questions={questions}
        locked={locked}
        previousAttempt={previousAttempt}
      />
    </div>
  );
}
