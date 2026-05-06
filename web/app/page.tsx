import Link from "next/link";
import { getAllLessonSummaries } from "@/lib/content";
import { loadProgress } from "@/lib/progress";
import { isAuthEnabled } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";

// Re-fetch progress on every request so completion state is always fresh.
// Safe for a single-user app; revisit if multi-user / multi-host.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [lessons, progress] = await Promise.all([
    getAllLessonSummaries(),
    loadProgress(),
  ]);
  const weeks = [1, 2, 3, 4] as const;
  const completedDays = new Set(
    Object.keys(progress.lessons).map((k) => Number.parseInt(k, 10)),
  );
  const completedCount = completedDays.size;

  // Average reading time across completed lessons (only counts where >0)
  const completedTimes = Object.values(progress.lessons)
    .map((l) => l.reading_seconds)
    .filter((s) => s > 0);
  const avgMinutes =
    completedTimes.length > 0
      ? Math.round(completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length / 60)
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="dashboard-header">
        <div className="dashboard-header-row">
          <h1 className="dashboard-title">AIEvalLearnPath</h1>
          {isAuthEnabled() && <LogoutButton />}
        </div>
        <p className="dashboard-subtitle">
          A 28-lesson curriculum on LLM evaluation. ~30 min/day.
        </p>
        <div className="dashboard-progress">
          <span className="dashboard-progress-count">
            <strong>{completedCount}</strong> / 28 completed
          </span>
          {avgMinutes != null && (
            <span className="dashboard-progress-avg">
              avg {avgMinutes} min / lesson
            </span>
          )}
        </div>
      </header>
      <div className="dashboard-weeks">
        {weeks.map((w) => {
          const wk = lessons.filter((l) => l.week === w);
          if (wk.length === 0) return null;
          const theme = wk[0].week_theme;
          const wkComplete = wk.filter((l) => completedDays.has(l.day)).length;
          return (
            <section key={w} className="dashboard-week">
              <header className="dashboard-week-header">
                <span className="dashboard-week-label">Week {w}</span>
                <span className="dashboard-week-theme">{theme}</span>
                <span className="dashboard-week-count">
                  {wkComplete} / {wk.length}
                </span>
              </header>
              <div className="dashboard-tiles">
                {wk.map((l) => {
                  const done = completedDays.has(l.day);
                  const dayKey = String(l.day);
                  const sectionsDone = Object.keys(
                    progress.sections[dayKey] ?? {},
                  ).length;
                  const sectionsTotal = l.section_count;
                  const inProgress =
                    !done && sectionsDone > 0 && sectionsTotal > 0;
                  const tileClass = done
                    ? "dashboard-tile dashboard-tile--done"
                    : inProgress
                      ? "dashboard-tile dashboard-tile--inprogress"
                      : "dashboard-tile";
                  return (
                    <Link
                      key={l.day}
                      href={`/lesson/${l.day}`}
                      className={tileClass}
                      aria-label={`Day ${l.day}: ${l.title}`}
                    >
                      <div className="dashboard-tile-head">
                        <span className="dashboard-tile-day">Day {l.day}</span>
                        {done ? (
                          <span className="dashboard-tile-check" aria-hidden>
                            ✓
                          </span>
                        ) : inProgress ? (
                          <span
                            className="dashboard-tile-progress"
                            aria-label={`${sectionsDone} of ${sectionsTotal} sections done`}
                          >
                            {sectionsDone}/{sectionsTotal}
                          </span>
                        ) : null}
                      </div>
                      <p className="dashboard-tile-topic">{l.title}</p>
                      <p className="dashboard-tile-anchor">
                        {l.anchor_benchmark}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
