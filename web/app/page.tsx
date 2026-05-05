import Link from "next/link";
import { getAllLessonSummaries } from "@/lib/content";

export default async function Home() {
  const lessons = await getAllLessonSummaries();
  const weeks = [1, 2, 3, 4] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          AIEvalLearnPath
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A 28-lesson curriculum on LLM evaluation. ~30 min/day.
        </p>
      </header>
      <div className="space-y-8">
        {weeks.map((w) => {
          const wk = lessons.filter((l) => l.week === w);
          if (wk.length === 0) return null;
          const theme = wk[0].week_theme;
          return (
            <section key={w}>
              <h2 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                Week {w} &middot; {theme}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {wk.map((l) => (
                  <Link
                    key={l.day}
                    href={`/lesson/${l.day}`}
                    className="group rounded-md border border-border bg-card p-3 transition-colors hover:bg-accent"
                  >
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Day {l.day}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
                      {l.anchor_benchmark}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
