import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllLessonDays, getLessonByDay } from "@/lib/content";
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
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Week {fm.week} &middot; {fm.week_theme}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Day {fm.day}: {fm.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Anchor: <span className="text-foreground">{fm.anchor_benchmark}</span>
          <span className="mx-2">&middot;</span>
          Harness: {fm.harness}
          <span className="mx-2">&middot;</span>
          {fm.reading_time_minutes} min
        </p>
      </header>
      <article
        className="lesson-content"
        dangerouslySetInnerHTML={{ __html: lesson.html }}
      />
      <nav className="mt-12 flex items-center justify-between border-t border-border pt-6">
        {prevDay ? (
          <Link
            href={`/lesson/${prevDay}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Day {prevDay}
          </Link>
        ) : (
          <span />
        )}
        {nextDay ? (
          <Link
            href={`/lesson/${nextDay}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
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
