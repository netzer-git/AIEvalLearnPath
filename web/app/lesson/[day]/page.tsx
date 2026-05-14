import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllLessonDays, getLessonByDay } from "@/lib/content";
import { sampleWarmupQuestions } from "@/lib/quiz-pool";
import QuizSection from "@/components/Quiz";
import CompleteButton from "@/components/CompleteButton";
import SectionTracker from "@/components/SectionTracker";
import SectionProgress from "@/components/SectionProgress";
import LessonShortcuts from "@/components/LessonShortcuts";
import MermaidInit from "./MermaidInit";

export async function generateStaticParams() {
  const days = await getAllLessonDays();
  return days.map((day) => ({ day: String(day) }));
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day: dayStr } = await params;
  const day = Number.parseInt(dayStr, 10);
  if (Number.isNaN(day)) notFound();
  const lesson = await getLessonByDay(day);
  if (!lesson) notFound();

  const fm = lesson.frontmatter;
  const prevDay = fm.day > 1 ? fm.day - 1 : null;
  const nextDay = fm.day < 28 ? fm.day + 1 : null;

  // D1 has no prior material, so no warm-up. D2+ pulls 2 questions from
  // earlier days via the deterministic seeded sampler in quiz-pool.ts.
  const warmupQuestions =
    fm.day >= 2 ? await sampleWarmupQuestions(fm.day) : [];

  // Final lesson of each week → surface a "Week N review" card after the
  // prev/next nav (D7 = week 1, D14 = week 2, D21 = week 3, D28 = week 4).
  const isWeekEnd = fm.day % 7 === 0;
  const reviewWeek = isWeekEnd ? fm.day / 7 : null;

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
          Week {fm.week} &middot; {fm.week_theme}
        </p>
        <h1 className="lesson-title">
          <span className="lesson-day">Day {fm.day}</span>
          <span className="lesson-title-text">{fm.title}</span>
        </h1>
        <p className="lesson-meta">
          <span className="lesson-meta-anchor">{fm.anchor_benchmark}</span>
          <span className="lesson-meta-sep">&middot;</span>
          {fm.harness}
          <span className="lesson-meta-sep">&middot;</span>
          {fm.reading_time_minutes} min
        </p>
        {fm.prerequisites && fm.prerequisites.length > 0 && (
          <p className="lesson-prereq-strip">
            <span className="lesson-prereq-strip-label">Builds on</span>
            {fm.prerequisites.map((p) => (
              <Link
                key={p}
                href={`/lesson/${p}`}
                className="lesson-prereq-chip"
              >
                D{p}
              </Link>
            ))}
          </p>
        )}
      </header>
      {warmupQuestions.length > 0 && (
        <QuizSection variant="warmup" questions={warmupQuestions} />
      )}
      <article
        className="lesson-content"
        dangerouslySetInnerHTML={{ __html: lesson.html }}
      />
      <SectionTracker day={fm.day} />
      {lesson.quiz && <QuizSection quiz={lesson.quiz} />}
      <div className="lesson-complete">
        <SectionProgress />
        <CompleteButton day={fm.day} />
      </div>
      <nav className="lesson-nav">
        {prevDay ? (
          <Link href={`/lesson/${prevDay}`} className="lesson-nav-prev">
            &larr; Day {prevDay}
          </Link>
        ) : (
          <span />
        )}
        {nextDay ? (
          <Link href={`/lesson/${nextDay}`} className="lesson-nav-next">
            Day {nextDay} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </nav>
      {reviewWeek && (
        <Link href={`/review/${reviewWeek}`} className="lesson-week-review-card">
          <span className="lesson-week-review-eyebrow">
            End of Week {reviewWeek}
          </span>
          <span className="lesson-week-review-title">
            Take the Week {reviewWeek} cumulative review →
          </span>
          <span className="lesson-week-review-hint">
            8 questions sampled across Days {(reviewWeek - 1) * 7 + 1}–
            {reviewWeek * 7}.
          </span>
        </Link>
      )}
      <MermaidInit />
      <LessonShortcuts day={fm.day} />
    </div>
  );
}
