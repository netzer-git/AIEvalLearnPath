"use client";
import { useEffect, useRef, useState } from "react";

type Status =
  | { kind: "loading" }
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
  const [status, setStatus] = useState<Status>({ kind: "loading" });
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
        if (!cancelled) setStatus({ kind: "incomplete" });
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

  if (status.kind === "loading") {
    return <div className="complete-strip complete-strip--loading">…</div>;
  }

  if (status.kind === "complete") {
    return (
      <div className="complete-strip complete-strip--done">
        <span className="complete-strip-icon" aria-hidden>✓</span>
        <span className="complete-strip-text">
          Completed {formatDate(status.completedAt)}
          {status.readingSeconds > 0 && (
            <> · took {formatMinutes(status.readingSeconds)}</>
          )}
        </span>
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
        {submitting ? "Saving…" : "Mark complete"}
      </button>
      {error && <span className="complete-error">{error}</span>}
    </div>
  );
}
