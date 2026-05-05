import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllLessonDays, getLessonByDay } from "@/lib/content";
import QuizSection from "@/components/Quiz";
import CompleteButton from "@/components/CompleteButton";
import SectionTracker from "@/components/SectionTracker";
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
      </header>
      <article
        className="lesson-content"
        dangerouslySetInnerHTML={{ __html: lesson.html }}
      />
      <SectionTracker day={fm.day} />
      {lesson.quiz && <QuizSection quiz={lesson.quiz} />}
      <div className="lesson-complete">
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
      <MermaidInit />
    </div>
  );
}
