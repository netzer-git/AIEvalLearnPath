"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Status =
  | { kind: "incomplete" }
  | { kind: "complete"; completedAt: string; readingSeconds: number };

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m === 0) return `<1 min`;
  return `${m} min`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CompleteButton({ day }: { day: number }) {
  // Default to "incomplete" so the SSR'd HTML ships the actual button.
  // The useEffect below upgrades to "complete" if the lesson is already
  // marked complete server-side. Brief flicker on already-completed
  // lessons (~hydration latency) is fine — far better than the user
  // seeing only a "…" loading ellipsis if hydration stalls.
  const [status, setStatus] = useState<Status>({ kind: "incomplete" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active reading time tracking. Counts only when the document is visible.
  const accumulatedMsRef = useRef(0);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/progress")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const lesson = data?.lessons?.[String(day)];
        if (lesson?.completed_at) {
          setStatus({
            kind: "complete",
            completedAt: lesson.completed_at,
            readingSeconds: Number(lesson.reading_seconds ?? 0),
          });
        } else {
          setStatus({ kind: "incomplete" });
        }
      })
      .catch(() => {
        // Stay in the incomplete state on fetch error — better UX than
        // hiding the button. The user can still attempt to complete;
        // the POST will surface any persistent failure inline.
      });
    return () => {
      cancelled = true;
    };
  }, [day]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        accumulatedMsRef.current += now - lastTickRef.current;
      }
      lastTickRef.current = now;
    };
    const onVisibility = () => {
      tick();
    };
    const id = window.setInterval(tick, 5000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    // Final flush of the timer.
    const now = Date.now();
    if (document.visibilityState === "visible") {
      accumulatedMsRef.current += now - lastTickRef.current;
      lastTickRef.current = now;
    }
    const elapsedSeconds = Math.round(accumulatedMsRef.current / 1000);
    try {
      const res = await fetch(`/api/progress/lesson/${day}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reading_seconds: elapsedSeconds }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const entry = await res.json();
      setStatus({
        kind: "complete",
        completedAt: entry.completed_at,
        readingSeconds: Number(entry.reading_seconds ?? 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (status.kind === "complete") {
    return (
      <div className="complete-strip-group">
        <div className="complete-strip complete-strip--done">
          <span className="complete-strip-icon" aria-hidden>✓</span>
          <span className="complete-strip-text">
            Completed {formatDate(status.completedAt)}
            {status.readingSeconds > 0 && (
              <> · took {formatMinutes(status.readingSeconds)}</>
            )}
          </span>
        </div>
        <Link href="/" className="complete-back-link">
          ← Back to lesson index
        </Link>
      </div>
    );
  }

  return (
    <div className="complete-strip">
      <button
        type="button"
        className="complete-button"
        onClick={handleComplete}
        disabled={submitting}
      >
        {submitting ? "Saving…" : "Complete"}
      </button>
      {error && <span className="complete-error">{error}</span>}
    </div>
  );
}
